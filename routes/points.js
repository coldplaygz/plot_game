/**
 * 积分系统 API
 * GET /api/points/balance    - 获取当前用户积分余额
 * GET /api/points/log        - 积分流水(当前用户)
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// 管理员查看所有积分记录
router.get('/admin/log', authorize('admin', 'editor'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
    const type = req.query.type || null;

    let where = [];
    const params = [];
    if (userId) { where.push('pl.user_id = ?'); params.push(userId); }
    if (type) { where.push('pl.type = ?'); params.push(type); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [countR] = await pool.query(`SELECT COUNT(*) AS total FROM points_log pl ${whereStr}`, params);
    const [rows] = await pool.query(
      `SELECT pl.*, u.username, u.nickname, ou.username AS operator_name
       FROM points_log pl LEFT JOIN users u ON pl.user_id = u.id
       LEFT JOIN users ou ON pl.operator_id = ou.id
       ${whereStr} ORDER BY pl.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      logs: rows,
      pagination: { page, limit, total: countR[0].total, totalPages: Math.ceil(countR[0].total / limit) }
    });
  } catch (err) {
    console.error('[Points] 管理日志查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取积分余额
router.get('/balance', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT points FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ user_id: req.user.id, points: rows[0].points });
  } catch (err) {
    console.error('[Points] 余额查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 积分流水
router.get('/log', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM points_log WHERE user_id = ?',
      [req.user.id]
    );
    const total = countResult[0].total;

    const [rows] = await pool.query(
      `SELECT * FROM points_log WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    res.json({
      logs: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Points] 流水查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
