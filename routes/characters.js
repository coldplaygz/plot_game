/**
 * 角色管理 API（每游戏独立的对白角色：命名 + 形象图）
 * 形象图存 uploads/avatars（公开静态，播放器对白立绘直接 <img> 显示）
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ============ Multer 配置 (头像上传) ============
const AVATARS_DIR = process.env.AVATARS_UPLOAD_DIR || 'uploads/avatars';
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext) && allowedMime.includes(file.mimetype)) cb(null, true);
    else cb(new Error('形象图仅支持 JPG/PNG/GIF/WebP'));
  }
});

// latin1 → utf8 文件名修复（multer 中文文件名乱码）
function fixFilename(name) {
  try { return Buffer.from(name, 'latin1').toString('utf8'); } catch { return name; }
}

// 某游戏的全部角色（含对白引用计数 + 表情列表解析 + 主角标记）
router.get('/game/:gameId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ch.id, ch.game_id, ch.name, ch.avatar, ch.expressions, ch.color, ch.sort_order, ch.is_protagonist, ch.created_at,
              (SELECT COUNT(*) FROM dialogues d WHERE d.character_id = ch.id) AS dialogue_count
       FROM characters ch
       WHERE ch.game_id = ? ORDER BY ch.sort_order ASC, ch.id ASC`,
      [req.params.gameId]
    );
    // expressions JSON → 数组（坏数据降级为空数组）
    for (const ch of rows) {
      try { ch.expressions = ch.expressions ? JSON.parse(ch.expressions) : []; }
      catch { ch.expressions = []; }
      if (!Array.isArray(ch.expressions)) ch.expressions = [];
    }
    res.json({ characters: rows });
  } catch (err) {
    console.error('[Characters] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 上传/更新角色表情头像（multipart: image 字段; body: key, label）
// 同 key 覆盖（旧文件删除），key 格式：字母数字下划线
router.post('/:id/expressions', authenticate, authorize('admin', 'editor'), avatarUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传表情图片' });
    const key = (req.body.key || '').trim();
    const label = (req.body.label || '').trim();
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(key)) return res.status(400).json({ error: '表情key只能包含英文/数字/下划线(1-30字符)' });
    if (!label) return res.status(400).json({ error: '请填写表情名称(如: 生气)' });

    const [rows] = await pool.query('SELECT id, expressions FROM characters WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '角色不存在' });

    let list = [];
    try { list = rows[0].expressions ? JSON.parse(rows[0].expressions) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];

    const newAvatar = (req.file.destination + '/' + req.file.filename).replace(/\\/g, '/');
    // 同 key 覆盖：删除旧文件
    const old = list.find(e => e.key === key);
    if (old && old.avatar && fs.existsSync(old.avatar)) { try { fs.unlinkSync(old.avatar); } catch {} }
    if (old) {
      old.avatar = newAvatar;
      old.label = label;
    } else {
      list.push({ key, label, avatar: newAvatar });
    }

    await pool.query('UPDATE characters SET expressions = ? WHERE id = ?', [JSON.stringify(list), req.params.id]);
    res.json({ message: `表情「${label}」已保存`, expressions: list });
  } catch (err) {
    console.error('[Characters] 表情保存失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除角色表情
router.delete('/:id/expressions/:key', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT expressions FROM characters WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '角色不存在' });
    let list = [];
    try { list = rows[0].expressions ? JSON.parse(rows[0].expressions) : []; } catch { list = []; }
    const target = list.find(e => e.key === req.params.key);
    if (!target) return res.status(404).json({ error: '表情不存在' });
    // 仍在被对白引用的表情不允许删除（否则对白头像失效）
    const [used] = await pool.query(
      'SELECT COUNT(*) c FROM dialogues WHERE character_id = ? AND expression = ?',
      [req.params.id, req.params.key]);
    if (used[0].c > 0) return res.status(400).json({ error: `该表情被 ${used[0].c} 条对白引用，先在对白中取消使用再删除` });
    if (target.avatar && fs.existsSync(target.avatar)) { try { fs.unlinkSync(target.avatar); } catch {} }
    list = list.filter(e => e.key !== req.params.key);
    await pool.query('UPDATE characters SET expressions = ? WHERE id = ?', [JSON.stringify(list), req.params.id]);
    res.json({ message: '表情已删除', expressions: list });
  } catch (err) {
    console.error('[Characters] 表情删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建角色（可带头像 multipart: avatar; 可直接标记为主角——同游戏旧主角自动让位）
router.post('/', authenticate, authorize('admin', 'editor'), avatarUpload.single('avatar'), async (req, res) => {
  try {
    const { game_id, name, color, sort_order } = req.body;
    if (!game_id || !name) return res.status(400).json({ error: '游戏ID和角色名不能为空' });

    const [g] = await pool.query('SELECT id FROM games WHERE id = ?', [game_id]);
    if (g.length === 0) return res.status(400).json({ error: '游戏不存在' });

    const isProtagonist = (req.body.is_protagonist === '1' || req.body.is_protagonist === 1 || req.body.is_protagonist === 'true') ? 1 : 0;
    const avatar = req.file ? (req.file.destination + '/' + req.file.filename).replace(/\\/g, '/') : null;
    const [result] = await pool.query(
      'INSERT INTO characters (game_id, name, avatar, color, sort_order, is_protagonist) VALUES (?, ?, ?, ?, ?, ?)',
      [game_id, name.trim(), avatar, color || '#e91e63', parseInt(sort_order) || 0, isProtagonist]
    );
    // 主角唯一：清掉同游戏其他主角
    if (isProtagonist) {
      await pool.query('UPDATE characters SET is_protagonist = 0 WHERE game_id = ? AND id != ?', [game_id, result.insertId]);
    }
    res.status(201).json({ message: '角色创建成功', character: { id: result.insertId, avatar } });
  } catch (err) {
    console.error('[Characters] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新角色（可替换头像; 可设置/取消主角——设为主角时同游戏旧主角自动取消）
router.put('/:id', authenticate, authorize('admin', 'editor'), avatarUpload.single('avatar'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, game_id, avatar FROM characters WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '角色不存在' });
    const old = rows[0];

    const fields = []; const values = [];
    const { name, color, sort_order } = req.body;
    if (name !== undefined && name.trim()) { fields.push('name = ?'); values.push(name.trim()); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color || '#e91e63'); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order) || 0); }
    // 主角标记：'1'/'true'/1 = 设为主角, '0'/0 = 取消（multipart 里是字符串）
    let setProtagonist = null;
    if (req.body.is_protagonist !== undefined) {
      const flag = (req.body.is_protagonist === '1' || req.body.is_protagonist === 1 || req.body.is_protagonist === 'true') ? 1 : 0;
      fields.push('is_protagonist = ?'); values.push(flag);
      setProtagonist = flag;
    }
    if (req.file) {
      fields.push('avatar = ?');
      values.push((req.file.destination + '/' + req.file.filename).replace(/\\/g, '/'));
      // 删除旧头像文件
      if (old.avatar && fs.existsSync(old.avatar)) { try { fs.unlinkSync(old.avatar); } catch {} }
    }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(req.params.id);
    await pool.query(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`, values);
    // 主角唯一：设为主角时清掉同游戏其他主角（本行除外）
    if (setProtagonist === 1) {
      await pool.query('UPDATE characters SET is_protagonist = 0 WHERE game_id = ? AND id != ?', [old.game_id, old.id]);
    }
    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('[Characters] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除角色（对白仍保留 speaker 文本, character_id 由引用处置空）
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 先看头像
    const [rows] = await conn.query('SELECT avatar FROM characters WHERE id = ?', [req.params.id]);
    if (rows.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: '角色不存在' }); }
    // 引用处置空（不级联删对白）
    await conn.query('UPDATE dialogues SET character_id = NULL WHERE character_id = ?', [req.params.id]);
    await conn.query('UPDATE dialogue_library SET character_id = NULL WHERE character_id = ?', [req.params.id]);
    await conn.query('DELETE FROM characters WHERE id = ?', [req.params.id]);
    await conn.commit();
    conn.release();
    if (rows[0].avatar && fs.existsSync(rows[0].avatar)) { try { fs.unlinkSync(rows[0].avatar); } catch {} }
    res.json({ message: '已删除（相关对白保留, 角色关联已解除）' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    console.error('[Characters] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
