/**
 * 游戏管理 API - 游戏分类系统
 * 支持游戏 CRUD、封面图上传、按游戏过滤视频/场景
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// ============ Multer 配置 (封面图上传) ============
const COVERS_DIR = process.env.COVERS_UPLOAD_DIR || 'uploads/covers';
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, COVERS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB（图片通常 <5MB）
  fileFilter: (req, file, cb) => {
    // 仅支持图片；视频封面必须走 /api/videos 上传（自动进 H.264 转码队列）
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext) && allowedMime.includes(file.mimetype)) cb(null, true);
    else cb(new Error('封面图片仅支持 JPG/PNG/GIF/WebP；视频封面请使用"上传视频"（自动 H.264 转码）'));
  }
});

// ============ 路由 ============

// 多语言翻译辅助函数
function translate(str) {
  try { return str ? JSON.parse(str) : {}; } catch { return {}; }
}
function translateGame(game, lang) {
  if (game.title_i18n) {
    const t = translate(game.title_i18n);
    if (t[lang]) game.title = t[lang];
  }
  if (game.description_i18n) {
    const t = translate(game.description_i18n);
    if (t[lang]) game.description = t[lang];
  }
}

// 获取所有游戏列表（公开，首页展示用，仅返回已发布游戏的基本信息）
router.get('/', async (req, res) => {
  try {
    const publishedOnly = req.query.published_only !== 'false';
    const lang = req.query.lang || '';
    let sql = `
      SELECT g.*,
        (SELECT COUNT(*) FROM videos v WHERE v.game_id = g.id AND v.category = 'scene') AS video_count,
        (SELECT COUNT(*) FROM scenes s WHERE s.game_id = g.id) AS scene_count,
        cv.file_path AS cover_video_path,
        cv.transcode_status AS cover_transcode_status
      FROM games g
      LEFT JOIN videos cv ON g.cover_video_id = cv.id
    `;
    const params = [];
    if (publishedOnly) {
      sql += ' WHERE g.is_published = 1';
    }
    sql += ' ORDER BY g.sort_order ASC, g.created_at DESC';

    const [rows] = await pool.query(sql, params);

    // 多语言翻译
    if (lang && lang !== 'zh') {
      for (const game of rows) {
        translateGame(game, lang);
      }
    }

    res.json({ games: rows });
  } catch (err) {
    console.error('[Games] 获取列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取可用作封面的视频列表（category='cover'，管理员/编辑者使用）
router.get('/covers/list', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, file_path, duration, file_size, transcode_status, created_at
       FROM videos
       WHERE category = 'cover'
       ORDER BY created_at DESC`
    );
    res.json({ covers: rows });
  } catch (err) {
    console.error('[Games] 获取封面视频列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个游戏详情（需登录）
router.get('/:id', authenticate, async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);

    const [rows] = await pool.query(
      `SELECT g.*,
        (SELECT COUNT(*) FROM videos v WHERE v.game_id = g.id) AS video_count,
        (SELECT COUNT(*) FROM scenes s WHERE s.game_id = g.id) AS scene_count,
        cv.file_path AS cover_video_path,
        cv.transcode_status AS cover_transcode_status,
        ct.style_config AS theme_config,
        ct.name AS theme_name
       FROM games g
       LEFT JOIN videos cv ON g.cover_video_id = cv.id
       LEFT JOIN choice_themes ct ON g.theme_id = ct.id
       WHERE g.id = ?`,
      [gameId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    const game = rows[0];
    // 解析主题样式 JSON
    if (game.theme_config) {
      try { game.theme_config = JSON.parse(game.theme_config); } catch {}
    }

    // 获取关联的视频列表
    const [videos] = await pool.query(
      `SELECT v.*, u.username AS uploaded_by_name
       FROM videos v
       LEFT JOIN users u ON v.uploaded_by = u.id
       WHERE v.game_id = ?
       ORDER BY v.created_at DESC`,
      [gameId]
    );
    game.videos = videos;

    // 获取关联的场景列表
    const [scenes] = await pool.query(
      `SELECT s.*, v.title AS video_title, v.file_path, v.duration,
        (SELECT COUNT(*) FROM choices c WHERE c.scene_id = s.id) AS choice_count
       FROM scenes s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE s.game_id = ?
       ORDER BY s.sort_order ASC`,
      [gameId]
    );
    game.scenes = scenes;

    res.json({ game });
  } catch (err) {
    console.error('[Games] 获取详情失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建游戏（管理员/编辑者）
router.post('/', authenticate, authorize('admin', 'editor'), coverUpload.single('cover_image'), async (req, res) => {
  try {
    const { title, description, category, sort_order, is_published } = req.body;
    if (!title) {
      // 清理已上传的封面
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '游戏标题不能为空' });
    }

    let coverImage = null;
    if (req.file) {
      coverImage = req.file.path.replace(/\\/g, '/');
    }

    // 封面视频 ID（优先于 cover_image，二者可同时存在但前端优先用视频）
    const coverVideoId = req.body.cover_video_id ? parseInt(req.body.cover_video_id) : null;

    const [result] = await pool.query(
      `INSERT INTO games (title, title_i18n, cover_image, cover_video_id, description, description_i18n, category, sort_order, is_published, intro_tail_seconds, menu_position, theme_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, req.body.title_i18n || null, coverImage, coverVideoId, description || '', req.body.description_i18n || null, category || null, parseInt(sort_order) || 0, is_published !== undefined ? (is_published ? 1 : 0) : 1,
       Number.isFinite(parseInt(req.body.intro_tail_seconds)) ? parseInt(req.body.intro_tail_seconds) : 3,
       req.body.menu_position || 'center',
       req.body.theme_id ? parseInt(req.body.theme_id) : null]
    );

    res.status(201).json({
      message: '游戏创建成功',
      game: { id: result.insertId, title, cover_image: coverImage, cover_video_id: coverVideoId }
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Games] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新游戏（管理员/编辑者）
router.put('/:id', authenticate, authorize('admin', 'editor'), coverUpload.single('cover_image'), async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const [existing] = await pool.query('SELECT * FROM games WHERE id = ?', [gameId]);
    if (existing.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: '游戏不存在' });
    }

    const oldGame = existing[0];
    const { title, description, category, sort_order, is_published } = req.body;

    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order)); }
    if (is_published !== undefined) { fields.push('is_published = ?'); values.push(is_published ? 1 : 0); }
    if (req.body.intro_tail_seconds !== undefined) { fields.push('intro_tail_seconds = ?'); values.push(parseInt(req.body.intro_tail_seconds) || 0); }
    if (req.body.menu_position !== undefined) { fields.push('menu_position = ?'); values.push(req.body.menu_position); }
    if (req.body.theme_id !== undefined) { fields.push('theme_id = ?'); values.push(req.body.theme_id ? parseInt(req.body.theme_id) : null); }

    // 处理封面图
    if (req.file) {
      const coverImage = req.file.path.replace(/\\/g, '/');
      fields.push('cover_image = ?');
      values.push(coverImage);
      // 删除旧封面图
      if (oldGame.cover_image) {
        try { if (fs.existsSync(oldGame.cover_image)) fs.unlinkSync(oldGame.cover_image); }
        catch (e) { console.warn('[Games] 删除旧封面失败:', e.message); }
      }
    }

    // 处理封面视频 ID（显式传入即可更新，支持置空：传空字符串表示清除）
    if (req.body.cover_video_id !== undefined) {
      const vid = req.body.cover_video_id ? parseInt(req.body.cover_video_id) : null;
      fields.push('cover_video_id = ?');
      values.push(vid);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(gameId);
    await pool.query(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: '游戏更新成功' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Games] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除游戏（仅管理员，级联删除关联的视频和场景）
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const [existing] = await pool.query('SELECT * FROM games WHERE id = ?', [gameId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    const game = existing[0];

    // 获取该游戏所有视频（用于删除文件）
    const [videos] = await pool.query('SELECT * FROM videos WHERE game_id = ?', [gameId]);

    // 删除关联的场景
    for (const video of videos) {
      // 删除场景关联的 choices -> affection_rules -> conditions
      const [scenes] = await pool.query('SELECT id FROM scenes WHERE video_id = ?', [video.id]);
      for (const scene of scenes) {
        await pool.query('DELETE FROM conditions WHERE target_type = "choice" AND target_id IN (SELECT id FROM choices WHERE scene_id = ?)', [scene.id]);
        await pool.query('DELETE FROM affection_rules WHERE choice_id IN (SELECT id FROM choices WHERE scene_id = ?)', [scene.id]);
        await pool.query('DELETE FROM choices WHERE scene_id = ?', [scene.id]);
        await pool.query('DELETE FROM conditions WHERE target_type = "scene" AND target_id = ?', [scene.id]);
      }
      await pool.query('DELETE FROM scenes WHERE video_id = ?', [video.id]);
    }

    // 删除视频文件 + 数据库记录
    for (const video of videos) {
      try { if (fs.existsSync(video.file_path)) fs.unlinkSync(video.file_path); }
      catch (e) { console.warn('[Games] 删除视频文件失败:', e.message); }
    }
    await pool.query('DELETE FROM videos WHERE game_id = ?', [gameId]);

    // 删除直接关联的场景（game_id 直接关联）
    await pool.query('DELETE FROM scenes WHERE game_id = ?', [gameId]);

    // 删除封面图
    if (game.cover_image) {
      try { if (fs.existsSync(game.cover_image)) fs.unlinkSync(game.cover_image); }
      catch (e) { console.warn('[Games] 删除封面失败:', e.message); }
    }

    // 删除游戏自身
    await pool.query('DELETE FROM games WHERE id = ?', [gameId]);

    res.json({ message: '游戏及关联数据已删除' });
  } catch (err) {
    console.error('[Games] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
