const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const MEDIA_DIR = 'uploads/media';

if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // 音频 + 字幕格式
    const allowed = ['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.srt', '.vtt', '.ass', '.ssa'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('不支持的文件格式'));
  }
});

router.use(authenticate);

// ============ 音轨 ============

// 获取视频的所有音轨
router.get('/:videoId/audios', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM video_audios WHERE video_id = ? ORDER BY is_default DESC, id ASC',
      [req.params.videoId]
    );
    res.json({ audios: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 上传音轨
router.post('/:videoId/audios', authorize('admin', 'editor'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const { language, label, is_default } = req.body;
    if (!language || !label) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '语言和标签不能为空' });
    }

    const filePath = req.file.path.replace(/\\/g, '/');
    if (is_default === '1') {
      await pool.query('UPDATE video_audios SET is_default = 0 WHERE video_id = ?', [req.params.videoId]);
    }

    const [result] = await pool.query(
      'INSERT INTO video_audios (video_id, language, label, file_path, file_size, is_default) VALUES (?,?,?,?,?,?)',
      [req.params.videoId, language, label, filePath, req.file.size, is_default === '1' ? 1 : 0]
    );
    res.status(201).json({ message: '音轨上传成功', audio: { id: result.insertId, language, label } });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除音轨
router.delete('/:videoId/audios/:audioId', authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_path FROM video_audios WHERE id = ? AND video_id = ?',
      [req.params.audioId, req.params.videoId]);
    if (rows.length === 0) return res.status(404).json({ error: '音轨不存在' });
    if (fs.existsSync(rows[0].file_path)) fs.unlinkSync(rows[0].file_path);
    await pool.query('DELETE FROM video_audios WHERE id = ?', [req.params.audioId]);
    res.json({ message: '音轨已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============ 字幕 ============

// 获取视频的所有字幕
router.get('/:videoId/subtitles', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM video_subtitles WHERE video_id = ? ORDER BY is_default DESC, id ASC',
      [req.params.videoId]
    );
    res.json({ subtitles: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 上传字幕
router.post('/:videoId/subtitles', authorize('admin', 'editor'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const { language, label, is_default } = req.body;
    if (!language || !label) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '语言和标签不能为空' });
    }

    const filePath = req.file.path.replace(/\\/g, '/');
    if (is_default === '1') {
      await pool.query('UPDATE video_subtitles SET is_default = 0 WHERE video_id = ?', [req.params.videoId]);
    }

    const [result] = await pool.query(
      'INSERT INTO video_subtitles (video_id, language, label, file_path, file_size, is_default) VALUES (?,?,?,?,?,?)',
      [req.params.videoId, language, label, filePath, req.file.size, is_default === '1' ? 1 : 0]
    );
    res.status(201).json({ message: '字幕上传成功', subtitle: { id: result.insertId, language, label } });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除字幕
router.delete('/:videoId/subtitles/:subId', authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_path FROM video_subtitles WHERE id = ? AND video_id = ?',
      [req.params.subId, req.params.videoId]);
    if (rows.length === 0) return res.status(404).json({ error: '字幕不存在' });
    if (fs.existsSync(rows[0].file_path)) fs.unlinkSync(rows[0].file_path);
    await pool.query('DELETE FROM video_subtitles WHERE id = ?', [req.params.subId]);
    res.json({ message: '字幕已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
