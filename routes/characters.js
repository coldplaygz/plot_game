const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 获取所有角色（玩家可见）
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM characters WHERE is_hidden = 0 ORDER BY sort_order ASC'
    );
    res.json({ characters: rows });
  } catch (err) {
    console.error('[Characters] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取所有角色（含隐藏 - 管理员）
router.get('/all', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM characters ORDER BY sort_order ASC');
    res.json({ characters: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个角色详情 + 好感度（需登录）
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '角色不存在' });

    // 获取玩家对该角色的好感度
    const [affection] = await pool.query(
      `SELECT sa.value FROM saves s
       LEFT JOIN save_affection sa ON s.id = sa.save_id AND sa.character_id = ?
       WHERE s.user_id = ? ORDER BY s.updated_at DESC LIMIT 1`,
      [req.params.id, req.user.id]
    );

    // 获取角色相关的结局
    const [endings] = await pool.query(
      'SELECT id, title, type FROM endings WHERE character_id = ?',
      [req.params.id]
    );

    res.json({
      character: rows[0],
      affection: affection.length > 0 ? affection[0].value : 0,
      endings
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建/更新角色（管理员）
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, avatar, avatar_pic, description, personality, color, sort_order, is_hidden, voice_actor, birthday } = req.body;
    if (!name) return res.status(400).json({ error: '角色名不能为空' });

    const [result] = await pool.query(
      `INSERT INTO characters (name, avatar, avatar_pic, description, personality, color, sort_order, is_hidden, voice_actor, birthday)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, avatar || null, avatar_pic || null, description || '', personality || null, color || '#e91e63', sort_order || 0, is_hidden ? 1 : 0, voice_actor || null, birthday || null]
    );
    res.status(201).json({ message: '角色创建成功', character: { id: result.insertId, name } });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, avatar, avatar_pic, description, personality, color, sort_order, is_hidden, voice_actor, birthday } = req.body;
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (avatar_pic !== undefined) { fields.push('avatar_pic = ?'); values.push(avatar_pic); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (personality !== undefined) { fields.push('personality = ?'); values.push(personality); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order)); }
    if (is_hidden !== undefined) { fields.push('is_hidden = ?'); values.push(is_hidden ? 1 : 0); }
    if (voice_actor !== undefined) { fields.push('voice_actor = ?'); values.push(voice_actor); }
    if (birthday !== undefined) { fields.push('birthday = ?'); values.push(birthday); }

    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    values.push(req.params.id);
    await pool.query(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '角色更新成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
