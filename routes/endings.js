const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 获取所有结局
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, c.name AS character_name, c.color
      FROM endings e
      LEFT JOIN characters c ON e.character_id = c.id
      ORDER BY e.sort_order ASC
    `);
    res.json({ endings: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取玩家已解锁结局
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, c.name AS character_name, c.color, pe.unlocked_at
      FROM player_endings pe
      JOIN endings e ON pe.ending_id = e.id
      LEFT JOIN characters c ON e.character_id = c.id
      WHERE pe.user_id = ?
      ORDER BY pe.unlocked_at DESC
    `, [req.user.id]);
    res.json({ endings: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 结局图鉴统计
router.get('/gallery', authenticate, async (req, res) => {
  try {
    const [allEndings] = await pool.query('SELECT COUNT(*) AS total FROM endings');
    const [unlocked] = await pool.query(
      'SELECT COUNT(*) AS total FROM player_endings WHERE user_id = ?',
      [req.user.id]
    );
    const [byType] = await pool.query(`
      SELECT e.type, COUNT(*) AS total,
        (SELECT COUNT(*) FROM player_endings pe JOIN endings e2 ON pe.ending_id = e2.id WHERE pe.user_id = ? AND e2.type = e.type) AS unlocked
      FROM endings e GROUP BY e.type
    `, [req.user.id]);

    res.json({
      total_endings: allEndings[0].total,
      unlocked: unlocked[0].total,
      by_type: byType
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建结局
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { title, description, image, type, character_id, unlock_condition, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: '结局标题不能为空' });

    const [result] = await pool.query(
      `INSERT INTO endings (title, description, image, type, character_id, unlock_condition, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description || '', image || null, type || 'normal', character_id || null, unlock_condition || null, sort_order || 0]
    );
    res.status(201).json({ message: '结局创建成功', ending: { id: result.insertId, title } });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 解锁结局（游戏内触发）
router.post('/:id/unlock', authenticate, async (req, res) => {
  try {
    await pool.query(
      'INSERT IGNORE INTO player_endings (user_id, ending_id) VALUES (?, ?)',
      [req.user.id, req.params.id]
    );
    res.json({ message: '结局已解锁' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新结局
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, description, image, type, character_id, unlock_condition, sort_order } = req.body;
    const fields = []; const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (image !== undefined) { fields.push('image = ?'); values.push(image); }
    if (type !== undefined) { fields.push('type = ?'); values.push(type); }
    if (character_id !== undefined) { fields.push('character_id = ?'); values.push(character_id); }
    if (unlock_condition !== undefined) { fields.push('unlock_condition = ?'); values.push(unlock_condition); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order)); }
    if (fields.length === 0) return res.status(400).json({ error: '未提供更新字段' });
    values.push(req.params.id);
    await pool.query(`UPDATE endings SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '结局更新成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
