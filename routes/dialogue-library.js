/**
 * 对白库 API（平铺素材池）+ 角色下拉数据
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 某游戏的全部库条目（平铺, 带角色名便于前端显示）
router.get('/game/:gameId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dl.*, c.name AS character_name, c.avatar AS character_avatar
       FROM dialogue_library dl
       LEFT JOIN characters c ON dl.character_id = c.id
       WHERE dl.game_id = ? ORDER BY dl.sort_order ASC, dl.id ASC`,
      [req.params.gameId]
    );
    res.json({ dialogues: rows });
  } catch (err) {
    console.error('[DialogueLibrary] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建库条目
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { game_id, node_type, character_id, speaker_override, text, text_i18n, show_time, sort_order } = req.body;
    if (!game_id || !text) return res.status(400).json({ error: '游戏ID和文本不能为空' });
    const nType = node_type === 'option' ? 'option' : 'line';

    let speaker = speaker_override || null;
    if (character_id) {
      const [c] = await pool.query('SELECT id, name FROM characters WHERE id = ? AND game_id = ?', [character_id, game_id]);
      if (c.length === 0) return res.status(400).json({ error: '角色不存在或不属于该游戏' });
      if (!speaker) speaker = c[0].name;  // 默认说话人 = 角色名
    }

    const [result] = await pool.query(
      `INSERT INTO dialogue_library (game_id, node_type, character_id, speaker, text, text_i18n, show_time, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [game_id, nType, character_id || null, speaker, text,
       text_i18n || null, parseInt(show_time) || 0, parseInt(sort_order) || 0]
    );
    res.status(201).json({ message: '创建成功', dialogue: { id: result.insertId } });
  } catch (err) {
    console.error('[DialogueLibrary] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新库条目
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { node_type, character_id, speaker_override, text, text_i18n, show_time, sort_order } = req.body;
    const [rows] = await pool.query('SELECT id, game_id, character_id FROM dialogue_library WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '对白不存在' });
    const gameId = rows[0].game_id;

    const fields = []; const values = [];
    if (node_type !== undefined) { fields.push('node_type = ?'); values.push(node_type === 'option' ? 'option' : 'line'); }
    if (character_id !== undefined) {
      if (character_id) {
        const [c] = await pool.query('SELECT id, name FROM characters WHERE id = ? AND game_id = ?', [character_id, gameId]);
        if (c.length === 0) return res.status(400).json({ error: '角色不存在或不属于该游戏' });
      }
      fields.push('character_id = ?'); values.push(character_id || null);
      // 选了角色且没有自定义说话人 → speaker 跟随角色名
      if (character_id) {
        const [c] = await pool.query('SELECT name FROM characters WHERE id = ?', [character_id]);
        fields.push('speaker = ?'); values.push(speaker_override || c[0].name);
      } else if (speaker_override !== undefined) {
        fields.push('speaker = ?'); values.push(speaker_override || null);
      }
    } else if (speaker_override !== undefined) {
      fields.push('speaker = ?'); values.push(speaker_override || null);
    }
    if (text !== undefined) { fields.push('text = ?'); values.push(text); }
    if (text_i18n !== undefined) { fields.push('text_i18n = ?'); values.push(text_i18n); }
    if (show_time !== undefined) { fields.push('show_time = ?'); values.push(parseInt(show_time) || 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order) || 0); }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(req.params.id);
    await pool.query(`UPDATE dialogue_library SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('[DialogueLibrary] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除库条目
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM dialogue_library WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '对白不存在' });
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('[DialogueLibrary] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 从库导入一条到场景（复制单条, 带角色关联）
router.post('/import', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { scene_id, library_node_id, parent_id: targetParentId } = req.body;
    if (!scene_id || !library_node_id) {
      return res.status(400).json({ error: '场景ID和库条目ID不能为空' });
    }

    const [sceneRows] = await pool.query('SELECT id, game_id FROM scenes WHERE id = ?', [scene_id]);
    if (sceneRows.length === 0) return res.status(404).json({ error: '场景不存在' });

    const [libRows] = await pool.query('SELECT * FROM dialogue_library WHERE id = ?', [library_node_id]);
    if (libRows.length === 0) return res.status(404).json({ error: '库对白不存在' });
    if (libRows[0].game_id !== sceneRows[0].game_id) {
      return res.status(400).json({ error: '库对白与场景不属于同一个游戏' });
    }

    if (targetParentId) {
      const [tRows] = await pool.query('SELECT id FROM dialogues WHERE id = ? AND scene_id = ?', [targetParentId, scene_id]);
      if (tRows.length === 0) return res.status(400).json({ error: '目标父节点不存在或不属于该场景' });
    }

    const lib = libRows[0];
    const [ins] = await pool.query(
      `INSERT INTO dialogues (scene_id, parent_id, node_type, character_id, speaker, text, text_i18n, show_time, duration, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4, ?)`,
      [scene_id, targetParentId || null, lib.node_type, lib.character_id, lib.speaker, lib.text, lib.text_i18n,
       targetParentId ? 0 : (lib.show_time || 0), lib.sort_order || 0]
    );
    res.status(201).json({ message: '已导入到场景', dialogue_id: ins.insertId });
  } catch (err) {
    console.error('[DialogueLibrary] 导入失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
