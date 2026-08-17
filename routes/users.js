/**
 * 用户管理 API (管理员)
 * GET    /api/users          - 用户列表(分页+搜索)
 * GET    /api/users/:id      - 用户详情
 * PUT    /api/users/:id      - 更新用户信息
 * PATCH  /api/users/:id/toggle - 启用/禁用用户
 * GET    /api/users/:id/points-log - 积分流水
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'editor'));

// 用户列表
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    let whereClause = '';
    const params = [];
    if (search) {
      whereClause = 'WHERE (username LIKE ? OR nickname LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await pool.query(
      `SELECT id, username, nickname, role, gender, age, preferences, points, is_active, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      users: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Users] 列表查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户详情
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, nickname, role, gender, age, preferences, points, is_active, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[Users] 详情查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { nickname, gender, age, preferences, role, points, remark } = req.body;

    // 禁止修改自己角色(防止降级)
    if (userId === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }
    // 只有 admin 可以修改角色
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有超级管理员可以修改角色' });
    }

    const fields = [], values = [];
    if (nickname !== undefined) { fields.push('nickname=?'); values.push(nickname); }
    if (gender !== undefined) { fields.push('gender=?'); values.push(gender || null); }
    if (age !== undefined) { fields.push('age=?'); values.push(age ? parseInt(age) : null); }
    if (preferences !== undefined) { fields.push('preferences=?'); values.push(preferences || null); }
    if (role !== undefined) { fields.push('role=?'); values.push(role); }

    // 手动修改积分（记录日志）
    if (points !== undefined && req.user.role === 'admin') {
      const [oldUser] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
      if (oldUser.length > 0) {
        const delta = parseInt(points) - oldUser[0].points;
        fields.push('points=?'); values.push(parseInt(points));
        if (delta !== 0) {
          await pool.query(
            'INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, req.user.id, delta, 'admin', null, parseInt(points), remark || '管理员手动调整']
          );
        }
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);

    const [rows] = await pool.query(
      `SELECT id, username, nickname, role, gender, age, preferences, points, is_active, created_at, updated_at
       FROM users WHERE id = ?`, [userId]
    );
    res.json({ user: rows[0], message: '用户信息已更新' });
  } catch (err) {
    console.error('[Users] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 启用/禁用用户
router.patch('/:id/toggle', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (userId === req.user.id) {
      return res.status(400).json({ error: '不能禁用自己' });
    }
    const [rows] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    const newStatus = rows[0].is_active ? 0 : 1;
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);

    res.json({
      id: userId,
      is_active: !!newStatus,
      message: newStatus ? '用户已启用' : '用户已禁用'
    });
  } catch (err) {
    console.error('[Users] 状态切换失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户积分流水
router.get('/:id/points-log', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM points_log WHERE user_id = ?', [userId]
    );
    const total = countResult[0].total;

    const [rows] = await pool.query(
      `SELECT * FROM points_log WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({
      logs: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Users] 积分流水查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
