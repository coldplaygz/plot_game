const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'plot_game_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '72h';

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(409).json({ error: '用户名已存在' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)',
      [username, passwordHash, nickname || username, 'player']
    );

    const token = jwt.sign({ id: result.insertId, username, role: 'player' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({
      token,
      user: { id: result.insertId, username, nickname: nickname || username, role: 'player' }
    });
  } catch (err) {
    console.error('[Auth] 注册失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role, nickname FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
    if (rows.length === 0) return res.status(401).json({ error: '用户名或密码错误' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: '用户名或密码错误' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, nickname: user.nickname }
    });
  } catch (err) {
    console.error('[Auth] 登录失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取当前用户
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, nickname, role, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
