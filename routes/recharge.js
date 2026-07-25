/**
 * 充值管理 API (管理员)
 * GET    /api/recharge          - 充值记录列表
 * POST   /api/recharge          - 创建充值
 * PUT    /api/recharge/:id      - 更新充值状态
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// 用户自助充值（无需管理员权限）
router.post('/self', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: '请输入有效金额' });

    const points = Math.floor(amount * 10); // ¥1 = 10积分
    const userId = req.user.id;

    await conn.beginTransaction();

    // 插入充值记录
    const [rec] = await conn.query(
      'INSERT INTO recharge_records (user_id, amount, points, payment_method, status, remark) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, amount, points, 'self', 'completed', '用户自助充值']
    );

    // 更新用户积分
    await conn.query('UPDATE users SET points = points + ? WHERE id = ?', [points, userId]);

    // 积分日志
    const [[user]] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
    await conn.query(
      'INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, userId, points, 'recharge', rec.insertId, user.points, `充值¥${amount}得${points}积分`]
    );

    await conn.commit();
    res.json({ points: user.points, added: points, message: '充值成功' });
  } catch (err) {
    await conn.rollback();
    console.error('[Recharge] 自助充值失败:', err);
    res.status(500).json({ error: '充值失败' });
  } finally { conn.release(); }
});

router.use(authorize('admin', 'editor'));

// 充值记录列表
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
    const status = req.query.status || null;

    let whereClauses = [];
    const params = [];
    if (userId) { whereClauses.push('rr.user_id = ?'); params.push(userId); }
    if (status) { whereClauses.push('rr.status = ?'); params.push(status); }
    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM recharge_records rr ${whereStr}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await pool.query(
      `SELECT rr.*, u.username, u.nickname, op.username AS operator_name
       FROM recharge_records rr
       LEFT JOIN users u ON rr.user_id = u.id
       LEFT JOIN users op ON rr.operator_id = op.id
       ${whereStr}
       ORDER BY rr.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      records: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Recharge] 列表查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建充值
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { user_id, amount, points, payment_method, remark } = req.body;

    if (!user_id || !amount || !points) {
      return res.status(400).json({ error: '请提供 user_id, amount, points' });
    }

    const userId = parseInt(user_id);
    const amt = parseFloat(amount);
    const pts = parseInt(points);

    if (isNaN(userId) || amt <= 0 || pts <= 0) {
      return res.status(400).json({ error: '参数无效' });
    }

    // 检查用户是否存在
    const [userRows] = await conn.query('SELECT id, points FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await conn.beginTransaction();

    // 1. 创建充值记录
    const [result] = await conn.query(
      `INSERT INTO recharge_records (user_id, amount, points, payment_method, status, operator_id, remark)
       VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
      [userId, amt, pts, payment_method || 'manual', req.user.id, remark || null]
    );

    // 2. 更新用户积分
    const newBalance = userRows[0].points + pts;
    await conn.query('UPDATE users SET points = ? WHERE id = ?', [newBalance, userId]);

    // 3. 积分流水
    await conn.query(
      `INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark)
       VALUES (?, ?, ?, 'recharge', ?, ?, ?)`,
      [userId, req.user.id, pts, result.insertId, newBalance, remark || '充值获得']
    );

    await conn.commit();

    res.status(201).json({
      id: result.insertId,
      user_id: userId,
      amount: amt,
      points: pts,
      balance: newBalance,
      message: '充值成功'
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Recharge] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  } finally {
    conn.release();
  }
});

// 更新充值状态
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const [rows] = await pool.query('SELECT * FROM recharge_records WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '记录不存在' });

    await pool.query('UPDATE recharge_records SET status = ? WHERE id = ?', [status, req.params.id]);

    res.json({ id: parseInt(req.params.id), status, message: '状态已更新' });
  } catch (err) {
    console.error('[Recharge] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
