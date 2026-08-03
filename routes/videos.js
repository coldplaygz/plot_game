const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { enqueueHLS } = require('../utils/hls-transcode');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// ffprobe: 优先用系统路径，否则用npm包
const sysFfprobePaths = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe'];
let ffprobeFound = false;
for (const p of sysFfprobePaths) {
  if (fs.existsSync(p)) { ffmpeg.setFfprobePath(p); ffprobeFound = true; break; }
}
if (!ffprobeFound) {
  const localFfprobe = path.join(path.dirname(ffmpegPath), 'ffprobe');
  if (fs.existsSync(localFfprobe)) ffmpeg.setFfprobePath(localFfprobe);
}
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

// ─── 转码队列（串行，一次一个） ───
const transcodeQueue = [];
let isTranscodingNow = false;

function enqueueTranscode(videoId, filePath) {
  const transcodedPath = filePath.replace(/(\.[^.]+)$/, '_transcoded$1');
  // 清理可能因上次崩溃残留的临时文件
  try { if (fs.existsSync(transcodedPath)) fs.unlinkSync(transcodedPath); } catch(e) {}
  transcodeQueue.push({ videoId, filePath, transcodedPath });
  console.log(`[Transcode] 入队 #${videoId}, 队列长度=${transcodeQueue.length}`);
  processQueue();
}

// 启动时恢复中断的转码任务
async function recoverPendingTranscodes() {
  try {
    const [rows] = await pool.query(
      "SELECT id, file_path FROM videos WHERE transcode_status IN ('queued', 'transcoding')"
    );
    if (rows.length === 0) return;
    console.log(`[Transcode] 恢复 ${rows.length} 个未完成的转码任务`);
    for (const row of rows) {
      if (fs.existsSync(row.file_path)) {
        // 清理上次转码可能留下的 _transcoded 临时文件
        const tmp = row.file_path.replace(/(\.[^.]+)$/, '_transcoded$1');
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch(e) {}
        // 重新设为 queued 并入队
        await pool.query('UPDATE videos SET transcode_status=? WHERE id=?', ['queued', row.id]);
        enqueueTranscode(row.id, row.file_path);
      } else {
        console.warn(`[Transcode] 恢复失败: 文件不存在, 标记为失败 #${row.id}`);
        await pool.query('UPDATE videos SET transcode_status=? WHERE id=?', ['failed', row.id]);
      }
    }
  } catch (e) {
    console.warn('[Transcode] 恢复检查失败:', e.message);
  }
}

function processQueue() {
  if (isTranscodingNow || transcodeQueue.length === 0) return;
  isTranscodingNow = true;
  const { videoId, filePath, transcodedPath } = transcodeQueue.shift();
  console.log(`[Transcode] 开始处理 #${videoId}, 剩余=${transcodeQueue.length}`);

  // 更新状态为「正在转码」
  pool.query('UPDATE videos SET transcode_status=? WHERE id=?', ['transcoding', videoId]).catch(() => {});

  transcodeVideo(filePath, transcodedPath).then(() => {
    if (fs.existsSync(transcodedPath)) {
      fs.unlinkSync(filePath);
      fs.renameSync(transcodedPath, filePath);
      const newStats = fs.statSync(filePath);
      pool.query('UPDATE videos SET file_size=?, transcode_status=? WHERE id=?', [newStats.size, 'done', videoId]).catch(() => {});
    }
    console.log(`[Transcode] #${videoId} 完成, 触发 HLS 转码`);
    // mp4 转码完成后自动触发 HLS 多音轨转码
    enqueueHLS(videoId);
    isTranscodingNow = false;
    processQueue();
  }).catch(e => {
    console.warn(`[Transcode] #${videoId} 失败:`, e.message);
    pool.query('UPDATE videos SET transcode_status=? WHERE id=?', ['failed', videoId]).catch(() => {});
    isTranscodingNow = false;
    processQueue();
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
    // 先检测编码，已是H.264则跳过
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      if (!err && meta && meta.streams) {
        const vStream = meta.streams.find(s => s.codec_type === 'video');
        if (vStream && vStream.codec_name === 'h264') {
          console.log('[FFmpeg] 已是H.264，跳过转码:', inputPath);
          return resolve();
        }
      }

      console.log('[FFmpeg] 开始转码:', inputPath);
      const startTime = Date.now();
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-profile:v main', '-pix_fmt yuv420p', '-preset fast', '-crf 23', '-movflags +faststart'])
        .output(outputPath)
        .on('end', () => { console.log('[FFmpeg] 转码完成 (', ((Date.now() - startTime) / 1000).toFixed(1), 's)'); resolve(); })
        .on('error', (err) => { console.error('[FFmpeg] 失败:', err.message); reject(err); })
        .run();
    });
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
    const gameId = req.query.game_id ? parseInt(req.query.game_id) : null;

    let whereClause = '';
    const params = [];
    if (gameId) {
      whereClause = ' WHERE v.game_id = ?';
      params.push(gameId);
    }

    const [countResult] = await pool.query('SELECT COUNT(*) AS total FROM videos v' + whereClause, params);
    const [rows] = await pool.query(
      `SELECT v.*, u.username AS uploaded_by_name,
        (SELECT COUNT(*) FROM scenes s WHERE s.video_id = v.id) AS scene_count,
        g.title AS game_title
       FROM videos v LEFT JOIN users u ON v.uploaded_by = u.id
       LEFT JOIN games g ON v.game_id = g.id
       ${whereClause}
       ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ videos: rows, pagination: { page, limit, total: countResult[0].total, totalPages: Math.ceil(countResult[0].total / limit) } });
  } catch (err) {
    console.error('[Videos] 获取列表失败:', err);
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

    const stats = fs.statSync(filePath);
    const duration = await getVideoDuration(filePath);
    const gameId = req.body.game_id ? parseInt(req.body.game_id) : null;
    const [result] = await pool.query(
      `INSERT INTO videos (title, description, filename, file_path, file_size, duration, mime_type, transcode_status, uploaded_by, game_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      [title, req.body.description || '', fixFilename(req.file.originalname), filePath, stats.size, duration, req.file.mimetype || 'video/mp4', req.user.id, gameId]
    );
    const responseData = { message: '视频上传成功', video: { id: result.insertId, title }, warning: '视频正在后台转码为 H.264 兼容格式，转码完成前播放可能出现兼容性问题' };

    // 自动创建场景
    if (req.body.auto_create_scene === '1' && gameId) {
      try {
        const [sceneR] = await pool.query(
          'INSERT INTO scenes (video_id, title, chapter, is_start, game_id) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, title, '', 0, gameId]
        );
        responseData.scene = { id: sceneR.insertId, title };
      } catch (e) { console.warn('[Videos] 自动创建场景失败:', e.message); }
    }

    res.status(201).json(responseData);

    // 加入转码队列（不阻塞响应）
    enqueueTranscode(result.insertId, filePath);

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || '上传失败' });
  }
});

// 批量上传视频
router.post('/batch', authorize('admin', 'editor'), upload.array('videos', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请选择至少一个视频文件' });
    }

    const gameId = req.body.game_id ? parseInt(req.body.game_id) : null;
    if (!gameId) {
      // 清理已上传文件
      req.files.forEach(f => { try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch(e) {} });
      return res.status(400).json({ error: '请指定游戏ID (game_id)' });
    }

    // 验证游戏是否存在
    const [gameRows] = await pool.query('SELECT id FROM games WHERE id = ?', [gameId]);
    if (gameRows.length === 0) {
      req.files.forEach(f => { try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch(e) {} });
      return res.status(404).json({ error: '指定的游戏不存在' });
    }

    const autoCreateScenes = req.body.auto_create_scenes === 'true' || req.body.auto_create_scenes === true;

    const videos = [];
    const scenes = [];
    const errors = [];

    for (const file of req.files) {
      try {
        let filePath = file.path.replace(/\\/g, '/');
        const origPath = filePath;
        const transcodedPath = filePath.replace(/(\.[^.]+)$/, '_transcoded$1');
        try {
          await transcodeVideo(origPath, transcodedPath);
          fs.unlinkSync(origPath);
          fs.renameSync(transcodedPath, origPath);
        } catch (e) { console.warn('[Videos] 批量转码失败，保留原始:', e.message); }

        const stats = fs.statSync(origPath);
        const duration = await getVideoDuration(origPath);

        // 使用文件名(不含扩展名)作为标题
        const title = path.parse(file.originalname).name;

        const [result] = await pool.query(
          `INSERT INTO videos (title, description, filename, file_path, file_size, duration, mime_type, uploaded_by, game_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [title, '', fixFilename(file.originalname), filePath, stats.size, duration, file.mimetype || 'video/mp4', req.user.id, gameId]
        );

        const videoRecord = { id: result.insertId, title, file_path: filePath };
        videos.push(videoRecord);

        // 批量上传已同步完成 mp4 转码，直接触发 HLS
        enqueueHLS(result.insertId);

        // 如果开启自动创建场景
        if (autoCreateScenes) {
          const [sceneResult] = await pool.query(
            `INSERT INTO scenes (video_id, title, description, game_id, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [result.insertId, title, '', gameId, 0]
          );
          scenes.push({ id: sceneResult.insertId, video_id: result.insertId, title, game_id: gameId });
        }
      } catch (fileErr) {
        console.error('[Videos] 批量上传文件失败:', file.originalname, fileErr.message);
        errors.push({ filename: file.originalname, error: fileErr.message });
        // 清理失败的文件
        try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e) {}
      }
    }

    res.status(201).json({
      message: `批量上传完成: ${videos.length} 个视频, ${scenes.length} 个场景, ${errors.length} 个失败`,
      videos,
      scenes,
      errors
    });
  } catch (err) {
    // 清理所有已上传文件
    if (req.files) {
      req.files.forEach(f => { try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch(e) {} });
    }
    console.error('[Videos] 批量上传失败:', err);
    res.status(500).json({ error: err.message || '批量上传失败' });
  }
});

// 编辑视频元数据（标题、归属游戏）
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const videoId = parseInt(req.params.id);
    const { title, game_id } = req.body;

    const [rows] = await pool.query('SELECT id, title, game_id FROM videos WHERE id = ?', [videoId]);
    if (rows.length === 0) return res.status(404).json({ error: '视频不存在' });

    const fields = [];
    const values = [];
    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ error: '标题不能为空' });
      fields.push('title = ?'); values.push(String(title).trim());
    }
    if (game_id !== undefined) {
      const newGameId = game_id ? parseInt(game_id) : null;
      // 校验游戏存在（非空时）
      if (newGameId) {
        const [gRows] = await pool.query('SELECT id FROM games WHERE id = ?', [newGameId]);
        if (gRows.length === 0) return res.status(400).json({ error: '目标游戏不存在' });
      }
      fields.push('game_id = ?'); values.push(newGameId);
    }

    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    values.push(videoId);
    await pool.query(`UPDATE videos SET ${fields.join(', ')} WHERE id = ?`, values);

    // 若修改了 game_id，同步关联场景的 game_id（保持归属一致）
    if (game_id !== undefined) {
      const newGameId = game_id ? parseInt(game_id) : null;
      await pool.query('UPDATE scenes SET game_id = ? WHERE video_id = ?', [newGameId, videoId]);
      console.log(`[Videos] #${videoId} game_id 变更为 ${newGameId}，已同步关联场景`);
    }

    res.json({ message: '视频更新成功' });
  } catch (err) {
    console.error('[Videos] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除视频
router.delete('/:id', authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_path, hls_dir FROM videos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '视频不存在' });
    if (fs.existsSync(rows[0].file_path)) fs.unlinkSync(rows[0].file_path);
    // 清理 HLS 切片目录
    if (rows[0].hls_dir && fs.existsSync(rows[0].hls_dir)) {
      try { fs.rmSync(rows[0].hls_dir, { recursive: true, force: true }); } catch(e) {}
    }
    await pool.query('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ message: '视频已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 批量删除视频（关联场景、选项、音轨、字幕通过外键级联删除）
router.post('/batch-delete', authorize('admin', 'editor'), async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请选择要删除的视频' });
    const validIds = ids.map(id => parseInt(id)).filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) return res.status(400).json({ error: '无效的视频ID' });

    const placeholders = validIds.map(() => '?').join(',');
    // 查所有视频文件路径 + HLS 目录
    const [rows] = await pool.query(
      `SELECT id, file_path, hls_dir FROM videos WHERE id IN (${placeholders})`, validIds
    );
    for (const row of rows) {
      if (fs.existsSync(row.file_path)) { try { fs.unlinkSync(row.file_path); } catch(e) {} }
      if (row.hls_dir && fs.existsSync(row.hls_dir)) {
        try { fs.rmSync(row.hls_dir, { recursive: true, force: true }); } catch(e) {}
      }
    }
    // 删除视频（scenes/choices/audios/subtitles 外键级联）
    const [delResult] = await pool.query(`DELETE FROM videos WHERE id IN (${placeholders})`, validIds);
    res.json({ message: `已删除 ${delResult.affectedRows} 个视频`, deleted: delResult.affectedRows });
  } catch (err) {
    console.error('[Videos] 批量删除失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 查询 HLS 转码状态（同时返回 transcode_status，供前端列表响应式轮询）
router.get('/:id/hls-status', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT transcode_status, hls_status, hls_master_path, hls_dir FROM videos WHERE id = ?', [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '视频不存在' });
    const [audios] = await pool.query(
      'SELECT id, language, label, hls_status FROM video_audios WHERE video_id = ?', [req.params.id]
    );
    const [subs] = await pool.query(
      'SELECT id, language, label, hls_status FROM video_subtitles WHERE video_id = ?', [req.params.id]
    );
    res.json({
      transcode_status: rows[0].transcode_status,
      hls_status: rows[0].hls_status,
      hls_master_path: rows[0].hls_master_path,
      hls_dir: rows[0].hls_dir,
      audios,
      subtitles: subs
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 手动重建 HLS（一键重建按钮）
router.post('/:id/rebuild-hls', authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, file_path FROM videos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '视频不存在' });
    if (!fs.existsSync(rows[0].file_path)) {
      return res.status(400).json({ error: '视频源文件不存在，无法重建' });
    }
    // 重置音轨/字幕 HLS 状态，强制重建
    await pool.query('UPDATE video_audios SET hls_status=? WHERE video_id=?', ['none', req.params.id]);
    await pool.query('UPDATE video_subtitles SET hls_status=? WHERE video_id=?', ['none', req.params.id]);
    enqueueHLS(parseInt(req.params.id));
    res.json({ message: 'HLS 重建任务已加入队列', video_id: parseInt(req.params.id) });
  } catch (err) {
    console.error('[Videos] 重建 HLS 失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 批量重建 HLS（一键重建所有存量视频）
router.post('/rebuild-hls-all', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM videos WHERE file_path IS NOT NULL ORDER BY id ASC"
    );
    let count = 0;
    for (const row of rows) {
      enqueueHLS(row.id);
      count++;
    }
    res.json({ message: `已加入 ${count} 个视频到 HLS 重建队列`, total: count });
  } catch (err) {
    console.error('[Videos] 批量重建 HLS 失败:', err);
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

    // 新文件路径
    let filePath = req.file.path.replace(/\\\\/g, '/');

    const stats = fs.statSync(filePath);
    const duration = await getVideoDuration(filePath);

    // 更新数据库
    const safeFilename = fixFilename(req.file.originalname);
    await pool.query(
      `UPDATE videos SET filename = ?, file_path = ?, file_size = ?, duration = ?, mime_type = ?, transcode_status = 'queued' WHERE id = ?`,
      [safeFilename, filePath, stats.size, duration, req.file.mimetype || 'video/mp4', videoId]
    );

    res.json({ message: '视频已替换', video: { id: videoId, title: safeFilename }, warning: '新视频正在后台转码为 H.264 兼容格式，转码完成前播放可能出现兼容性问题' });

    // 加入转码队列（不阻塞响应）
    enqueueTranscode(videoId, filePath);

  } catch (err) {
    console.error('[Videos] 替换视频失败:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;

// 启动时自动恢复未完成的转码任务
recoverPendingTranscodes();
