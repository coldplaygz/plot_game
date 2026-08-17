const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate, JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { setHlsCookie } = require('../middleware/hlsAuth');
require('dotenv').config();

const router = express.Router();

// 严格限流：登录每 IP 每 15 分钟最多 10 次（防暴力破解）
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: '登录尝试过于频繁，请 15 分钟后再试' });
// 严格限流：注册每 IP 每小时最多 5 次（防批量注册）
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: '注册请求过于频繁，请 1 小时后再试' });

// 维护模式中间件
async function maintenanceCheck(req, res, next) {
  // 登录和注册始终允许（管理员需登录进入系统，注册由 reg_enabled 单独控制）
  if (req.path === '/login' || req.path === '/register') return next();

  try {
    const [rows] = await pool.query("SELECT config_value FROM system_config WHERE config_key='maintenance_mode'");
    if (rows[0]?.config_value === '1') {
      // 管理员仍可访问
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded.role === 'admin') return next();
        } catch (e) { /* token invalid, fall through */ }
      }
      return res.status(503).json({ error: '系统维护中，请稍后再试' });
    }
  } catch (e) { /* ignore */ }
  next();
}

// 应用到需要拦截的路由
router.use(maintenanceCheck);

// 用户对象精选字段
function pickUser(u) {
  return {
    id: u.id, username: u.username, nickname: u.nickname, role: u.role,
    gender: u.gender, age: u.age, preferences: u.preferences, avatar: u.avatar,
    points: u.points || 0
  };
}

// 注册
router.post('/register', registerLimiter, async (req, res) => {
  try {
    // 检查是否开放注册
    const [cfg] = await pool.query("SELECT config_value FROM system_config WHERE config_key='reg_enabled'");
    if (cfg[0]?.config_value === '0') return res.status(403).json({ error: '暂不开放注册' });

    const { username, password, nickname, gender, age, preferences } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(409).json({ error: '用户名已存在' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, nickname, gender, age, preferences, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, nickname || username, gender || null, age ? parseInt(age) : null, preferences || null, 'player']
    );

    const token = jwt.sign({ id: result.insertId, role: 'player' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setHlsCookie(res, result.insertId);
    res.status(201).json({
      token,
      user: { id: result.insertId, username, nickname: nickname || username, role: 'player', gender: gender || null, age: age ? parseInt(age) : null, preferences: preferences || null, points: 0 }
    });
  } catch (err) {
    console.error('[Auth] 注册失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
    if (rows.length === 0) return res.status(401).json({ error: '用户名或密码错误' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: '用户名或密码错误' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setHlsCookie(res, user.id);
    res.json({ token, user: pickUser(user) });
  } catch (err) {
    console.error('[Auth] 登录失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取当前用户
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: pickUser(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新用户资料
router.put('/me', authenticate, async (req, res) => {
  try {
    const { nickname, gender, age, preferences } = req.body;
    const fields = [], values = [];
    if (nickname !== undefined) { fields.push('nickname=?'); values.push(nickname); }
    if (gender !== undefined) { fields.push('gender=?'); values.push(gender || null); }
    if (age !== undefined) { fields.push('age=?'); values.push(age ? parseInt(age) : null); }
    if (preferences !== undefined) { fields.push('preferences=?'); values.push(preferences || null); }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);

    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    res.json({ user: pickUser(rows[0]), message: '资料已更新' });
  } catch (err) {
    console.error('[Auth] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
