/**
 * 游戏属性 API（每游戏自定义属性 + 对白选项影响值管理）
 * 播放中属性值由前端维护（session 级），服务端 /play/dialogue-choice 结算并返回新值
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 某游戏的属性列表（附每个属性被多少选项引用）
router.get('/game/:gameId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ga.*, (SELECT COUNT(*) FROM dialogue_option_effects e WHERE e.attr_id = ga.id) AS effect_count
       FROM game_attributes ga WHERE ga.game_id = ? ORDER BY ga.sort_order ASC, ga.id ASC`,
      [req.params.gameId]
    );
    res.json({ attributes: rows });
  } catch (err) {
    console.error('[GameAttributes] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建属性
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { game_id, name, attr_key, default_value, sort_order } = req.body;
    if (!game_id || !name) return res.status(400).json({ error: '游戏ID和属性名不能为空' });

    // attr_key 未填时自动从 name 生成（非ASCII字符用 attr+序号）
    let key = (attr_key || '').trim();
    if (!key) {
      if (/^[a-zA-Z0-9_]+$/.test(name)) key = name.toLowerCase();
      else {
        const [cnt] = await pool.query('SELECT COUNT(*) c FROM game_attributes WHERE game_id = ?', [game_id]);
        key = 'attr_' + (cnt[0].c + 1);
      }
    } else if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      return res.status(400).json({ error: '属性键只能包含英文/数字/下划线' });
    }

    const [g] = await pool.query('SELECT id FROM games WHERE id = ?', [game_id]);
    if (g.length === 0) return res.status(400).json({ error: '游戏不存在' });

    try {
      const [result] = await pool.query(
        'INSERT INTO game_attributes (game_id, attr_key, name, default_value, sort_order) VALUES (?, ?, ?, ?, ?)',
        [game_id, key, name.trim(), parseInt(default_value) || 0, parseInt(sort_order) || 0]
      );
      res.status(201).json({ message: '属性创建成功', attribute: { id: result.insertId } });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '属性键已存在: ' + key });
      throw e;
    }
  } catch (err) {
    console.error('[GameAttributes] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新属性
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { name, default_value, sort_order, attr_key } = req.body;
    const [rows] = await pool.query('SELECT id, game_id, attr_key FROM game_attributes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '属性不存在' });

    // 有选项引用时禁止改键（会导致已存影响失效）
    if (attr_key !== undefined && attr_key !== rows[0].attr_key) {
      const [used] = await pool.query('SELECT COUNT(*) c FROM dialogue_option_effects WHERE attr_id = ?', [req.params.id]);
      if (used[0].c > 0) return res.status(400).json({ error: '该属性已被选项引用，不能修改属性键' });
    }
    const fields = []; const values = [];
    if (name !== undefined && name.trim()) { fields.push('name = ?'); values.push(name.trim()); }
    if (attr_key !== undefined && /^[a-zA-Z0-9_]+$/.test(attr_key)) { fields.push('attr_key = ?'); values.push(attr_key); }
    if (default_value !== undefined) { fields.push('default_value = ?'); values.push(parseInt(default_value) || 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order) || 0); }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(req.params.id);
    await pool.query(`UPDATE game_attributes SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '更新成功' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '属性键已存在' });
    console.error('[GameAttributes] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除属性（引用它的选项影响级联删除）
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM game_attributes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '属性不存在' });
    res.json({ message: '已删除（关联的选项影响也已移除）' });
  } catch (err) {
    console.error('[GameAttributes] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 某场景全部选项的影响计数（dialogue_id → count），对白树按钮角标用
router.get('/scene-effects-count/:sceneId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.dialogue_id, COUNT(*) AS cnt
       FROM dialogue_option_effects e
       JOIN dialogues d ON e.dialogue_id = d.id
       WHERE d.scene_id = ?
       GROUP BY e.dialogue_id`,
      [req.params.sceneId]
    );
    const counts = {};
    for (const r of rows) counts[r.dialogue_id] = r.cnt;
    res.json({ counts });
  } catch (err) {
    console.error('[GameAttributes] 计数失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============ 选项影响值管理 ============
// 某对白选项的影响列表
router.get('/effects/:dialogueId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, ga.name AS attr_name, ga.attr_key
       FROM dialogue_option_effects e
       JOIN game_attributes ga ON e.attr_id = ga.id
       WHERE e.dialogue_id = ? ORDER BY ga.sort_order ASC`,
      [req.params.dialogueId]
    );
    res.json({ effects: rows });
  } catch (err) {
    console.error('[GameAttributes] 影响获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 设置某选项的影响（全量替换：body { effects: [{attr_id, delta}, ...] }）
// 校验：attr 必须属于该选项场景所属的游戏（防跨游戏引用）
router.put('/effects/:dialogueId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { effects } = req.body;
    const dialogueId = req.params.dialogueId;
    await conn.beginTransaction();

    const [dRows] = await conn.query(
      'SELECT d.id, s.game_id FROM dialogues d JOIN scenes s ON d.scene_id = s.id WHERE d.id = ?',
      [dialogueId]);
    if (dRows.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: '对白节点不存在' }); }
    const gameId = dRows[0].game_id;

    const list = Array.isArray(effects) ? effects : [];
    const valid = [];
    for (const e of list) {
      if (!e.attr_id) continue;
      const [a] = await conn.query('SELECT id FROM game_attributes WHERE id = ? AND game_id = ?', [e.attr_id, gameId]);
      if (a.length === 0) { await conn.rollback(); conn.release(); return res.status(400).json({ error: '属性不存在或不属于该游戏' }); }
      valid.push([dialogueId, e.attr_id, parseInt(e.delta) || 0]);
    }

    await conn.query('DELETE FROM dialogue_option_effects WHERE dialogue_id = ?', [dialogueId]);
    if (valid.length) {
      await conn.query('INSERT INTO dialogue_option_effects (dialogue_id, attr_id, delta) VALUES ?', [valid]);
    }
    await conn.commit();
    conn.release();
    res.json({ message: `已保存 ${valid.length} 项属性影响` });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    console.error('[GameAttributes] 影响保存失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
