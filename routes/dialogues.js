/**
 * 场景对白管理 API
 * 树状结构：parent_id 指向父对白节点；choice_id 指向选项（该选择后才显示此分支，NULL=总是显示）
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 获取某场景的对白（平铺，前端组装树）
router.get('/scene/:sceneId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, c.text AS choice_text
      FROM dialogues d
      LEFT JOIN choices c ON d.choice_id = c.id
      WHERE d.scene_id = ?
      ORDER BY d.sort_order ASC, d.id ASC
    `, [req.params.sceneId]);
    res.json({ dialogues: rows });
  } catch (err) {
    console.error('[Dialogues] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建对白节点
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { scene_id, parent_id, node_type, character_id, min_attr_id, min_value, speaker, text, text_i18n, show_time, duration, sort_order } = req.body;
    if (!scene_id || !text) return res.status(400).json({ error: '场景ID和对白文本不能为空' });
    const nType = node_type === 'option' ? 'option' : 'line';

    // 校验 parent_id 属于该场景
    if (parent_id) {
      const [pRows] = await pool.query('SELECT id FROM dialogues WHERE id = ? AND scene_id = ?', [parent_id, scene_id]);
      if (pRows.length === 0) return res.status(400).json({ error: '父对白节点不存在或不属于该场景' });
    }

    // 门槛校验：门槛属性必须属于该场景的游戏
    const [sGame] = await pool.query('SELECT game_id FROM scenes WHERE id = ?', [scene_id]);
    if (sGame.length === 0) return res.status(400).json({ error: '场景不存在' });
    let finalGateAttr = null, finalGateVal = 0;
    if (min_attr_id) {
      const [ga] = await pool.query('SELECT id FROM game_attributes WHERE id = ? AND game_id = ?', [min_attr_id, sGame[0].game_id]);
      if (ga.length === 0) return res.status(400).json({ error: '门槛属性不存在或不属于该场景的游戏' });
      finalGateAttr = min_attr_id;
      finalGateVal = Math.max(0, parseInt(min_value) || 0);
    }

    // 选了角色且没手写说话人 → speaker 默认取角色名
    let finalSpeaker = speaker || null;
    if (character_id) {
      // 通过 scene_id 反查所属游戏, 再确认角色属于该游戏
      const [sRows] = await pool.query(
        'SELECT game_id FROM scenes WHERE id = ?',
        [scene_id]);
      if (sRows.length === 0) return res.status(400).json({ error: '场景不存在' });
      const [cRows] = await pool.query(
        'SELECT id, name FROM characters WHERE id = ? AND game_id = ?',
        [character_id, sRows[0].game_id]);
      if (cRows.length === 0) return res.status(400).json({ error: '角色不存在或不属于该场景的游戏' });
      if (!finalSpeaker) finalSpeaker = cRows[0].name;
    }

    const [result] = await pool.query(
      `INSERT INTO dialogues (scene_id, parent_id, node_type, character_id, min_attr_id, min_value, speaker, text, text_i18n, show_time, duration, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scene_id, parent_id || null, nType, character_id || null, finalGateAttr, finalGateVal, finalSpeaker, text,
       text_i18n || null, parseInt(show_time) || 0, parseInt(duration) || 4, parseInt(sort_order) || 0]
    );
    res.status(201).json({ message: '对白创建成功', dialogue: { id: result.insertId } });
  } catch (err) {
    console.error('[Dialogues] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新对白节点
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { parent_id, node_type, character_id, min_attr_id, min_value, speaker, text, text_i18n, show_time, duration, sort_order } = req.body;

    const [rows] = await pool.query('SELECT id, scene_id FROM dialogues WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '对白不存在' });
    const sceneId = rows[0].scene_id;

    // 防止把自己挂到自己的子孙节点下（成环）
    if (parent_id) {
      if (parseInt(parent_id) === parseInt(req.params.id)) {
        return res.status(400).json({ error: '父节点不能是自己' });
      }
      const [pRows] = await pool.query('SELECT id, parent_id FROM dialogues WHERE id = ? AND scene_id = ?', [parent_id, sceneId]);
      if (pRows.length === 0) return res.status(400).json({ error: '父对白节点不存在或不属于该场景' });
      // 向上遍历祖先链，发现环则拒绝
      let cursor = pRows[0];
      while (cursor && cursor.parent_id) {
        if (parseInt(cursor.parent_id) === parseInt(req.params.id)) {
          return res.status(400).json({ error: '不能把节点挂到自己的子孙节点下' });
        }
        const [next] = await pool.query('SELECT id, parent_id FROM dialogues WHERE id = ?', [cursor.parent_id]);
        cursor = next[0];
      }
    }

    const fields = []; const values = [];
    if (parent_id !== undefined) { fields.push('parent_id = ?'); values.push(parent_id || null); }
    if (node_type !== undefined) { fields.push('node_type = ?'); values.push(node_type === 'option' ? 'option' : 'line'); }
    // 门槛（min_attr_id 变更时校验属性归属; 传 null 清除门槛）
    if (min_attr_id !== undefined || min_value !== undefined) {
      let gateAttr = null, gateVal = 0;
      if (min_attr_id) {
        const [ga] = await pool.query(
          'SELECT ga.id FROM game_attributes ga JOIN dialogues d ON d.id = ? JOIN scenes s ON d.scene_id = s.id WHERE ga.id = ? AND ga.game_id = s.game_id',
          [req.params.id, min_attr_id]);
        if (ga.length === 0) return res.status(400).json({ error: '门槛属性不存在或不属于该场景的游戏' });
        gateAttr = min_attr_id;
        gateVal = Math.max(0, parseInt(min_value) || 0);
      }
      fields.push('min_attr_id = ?'); values.push(gateAttr);
      fields.push('min_value = ?'); values.push(gateVal);
    }
    if (character_id !== undefined) {
      if (character_id) {
        // 对白已存在 → 用自身 scene_id 反查游戏, 再确认角色属于该游戏
        const [cRows] = await pool.query(
          'SELECT c.id, c.name FROM dialogues d JOIN scenes s ON d.scene_id = s.id JOIN characters c ON c.game_id = s.game_id WHERE d.id = ? AND c.id = ?',
          [req.params.id, character_id]);
        if (cRows.length === 0) return res.status(400).json({ error: '角色不存在或不属于该场景的游戏' });
      }
      fields.push('character_id = ?'); values.push(character_id || null);
      // 选角色且未手写 speaker → 跟随角色名；清空角色 → 保留原 speaker 文本
      if (character_id && speaker === undefined) {
        const [cName] = await pool.query('SELECT name FROM characters WHERE id = ?', [character_id]);
        fields.push('speaker = ?'); values.push(cName[0].name);
      }
    }
    if (speaker !== undefined) { fields.push('speaker = ?'); values.push(speaker || null); }
    if (text !== undefined) { fields.push('text = ?'); values.push(text); }
    if (text_i18n !== undefined) { fields.push('text_i18n = ?'); values.push(text_i18n); }
    if (show_time !== undefined) { fields.push('show_time = ?'); values.push(parseInt(show_time) || 0); }
    if (duration !== undefined) { fields.push('duration = ?'); values.push(parseInt(duration) || 4); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order) || 0); }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(req.params.id);
    await pool.query(`UPDATE dialogues SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '对白更新成功' });
  } catch (err) {
    console.error('[Dialogues] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除对白节点（子节点外键级联删除）
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM dialogues WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '对白不存在' });
    res.json({ message: '对白已删除' });
  } catch (err) {
    console.error('[Dialogues] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
