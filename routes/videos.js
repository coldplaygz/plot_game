const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config();

// 探测视频时长
function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata || !metadata.format) { resolve(0); return; }
      resolve(parseFloat(metadata.format.duration) || 0);
    });
  });
}

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads/videos';

// multer 接收的文件名是 Latin-1 编码，需转为 UTF-8
function fixFilename(name) {
  if (!name) return name;
  try {
    // 标准修复: multer 用 latin1 解析 multipart 文件名，转为 utf8
    const buf = Buffer.from(name, 'latin1');
    const result = buf.toString('utf8');
    // 验证是否确实是误编码（如果转后含替换字符则回退）
    if (result.includes('\uFFFD')) return name;
    return result;
  } catch (e) { return name; }
}

// 转码视频为 H.264 兼容格式
function transcodeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log('[FFmpeg] 开始转码:', inputPath);
    const startTime = Date.now();
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-profile:v baseline', '-level 3.0', '-pix_fmt yuv420p', '-preset fast', '-crf 23', '-movflags +faststart'])
      .output(outputPath)
      .on('end', () => { console.log('[FFmpeg] 转码完成 (', ((Date.now() - startTime) / 1000).toFixed(1), 's)'); resolve(); })
      .on('error', (err) => { console.error('[FFmpeg] 失败:', err.message); reject(err); })
      .run();
  });
}

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('不支持的文件格式: ' + allowed.join(', ')));
  }
});

router.use(authenticate);

// 获取视频列表
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const [countResult] = await pool.query('SELECT COUNT(*) AS total FROM videos');
    const [rows] = await pool.query(
      `SELECT v.*, u.username AS uploaded_by_name,
        (SELECT COUNT(*) FROM scenes s WHERE s.video_id = v.id) AS scene_count
       FROM videos v LEFT JOIN users u ON v.uploaded_by = u.id
       ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ videos: rows, pagination: { page, limit, total: countResult[0].total, totalPages: Math.ceil(countResult[0].total / limit) } });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 上传视频
router.post('/', authorize('admin', 'editor'), upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择视频文件' });
    const { title } = req.body;
    if (!title) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: '视频标题不能为空' }); }

    let filePath = req.file.path.replace(/\\\\/g, '/');
    const origPath = filePath;
    const transcodedPath = filePath.replace(/(\\.[^.]+)$/, '_transcoded$1');
    try {
      await transcodeVideo(origPath, transcodedPath);
      fs.unlinkSync(origPath);
      fs.renameSync(transcodedPath, origPath);
    } catch (e) { console.warn('[Videos] 转码失败，保留原始:', e.message); }

    const stats = fs.statSync(origPath);
    const duration = await getVideoDuration(origPath);
    const [result] = await pool.query(
      `INSERT INTO videos (title, description, filename, file_path, file_size, duration, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, req.body.description || '', fixFilename(req.file.originalname), filePath, stats.size, duration, req.file.mimetype || 'video/mp4', req.user.id]
    );
    res.status(201).json({ message: '视频上传成功', video: { id: result.insertId, title } });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || '上传失败' });
  }
});

// 删除视频
router.delete('/:id', authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_path FROM videos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '视频不存在' });
    if (fs.existsSync(rows[0].file_path)) fs.unlinkSync(rows[0].file_path);
    await pool.query('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ message: '视频已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 替换视频文件（保留ID和关联）
router.put('/:id/replace', authorize('admin', 'editor'), upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择新视频文件' });

    const videoId = parseInt(req.params.id);
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: '视频不存在' });
    }

    const oldVideo = rows[0];

    // 删除旧文件
    try { if (fs.existsSync(oldVideo.file_path)) fs.unlinkSync(oldVideo.file_path); }
    catch (e) { console.warn('[Videos] 删除旧文件失败:', e.message); }

    // 新文件路径处理 + 转码
    let filePath = req.file.path.replace(/\\/g, '/');
    const origPath = filePath;
    const transcodedPath = filePath.replace(/(\.[^.]+)$/, '_transcoded$1');
    try {
      await transcodeVideo(origPath, transcodedPath);
      fs.unlinkSync(origPath);
      fs.renameSync(transcodedPath, origPath);
    } catch (e) { console.warn('[Videos] 转码失败，保留原始:', e.message); }

    const stats = fs.statSync(origPath);
    const duration = await getVideoDuration(origPath);

    // 更新数据库
    const safeFilename = fixFilename(req.file.originalname);
    await pool.query(
      `UPDATE videos SET filename = ?, file_path = ?, file_size = ?, duration = ?, mime_type = ? WHERE id = ?`,
      [safeFilename, filePath, stats.size, duration, req.file.mimetype || 'video/mp4', videoId]
    );

    res.json({
      message: '视频已替换',
      video: {
        id: videoId,
        title: oldVideo.title,
        filename: safeFilename,
        file_path: filePath,
        file_size: stats.size
      }
    });
  } catch (err) {
    console.error('[Videos] 替换视频失败:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
