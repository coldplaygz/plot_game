const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const characterRoutes = require('./routes/characters');
const sceneRoutes = require('./routes/scenes');
const choiceRoutes = require('./routes/choices');
const endingRoutes = require('./routes/endings');
const videoRoutes = require('./routes/videos');
const saveRoutes = require('./routes/saves');
const playRoutes = require('./routes/play');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 3000;

// === UTF-8 编码修复 ===
// 强制所有请求体按 UTF-8 解析
app.use(express.json({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));
// 强制所有响应头为 UTF-8
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
// JSON 响应使用正确 charset
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return oldJson.call(this, data);
  };
  next();
});

app.use(cors());
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, filePath) => {
    // 视频文件设置正确的 MIME 和缓存头
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (filePath.endsWith('.mov')) {
      res.setHeader('Content-Type', 'video/quicktime');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));
app.use(express.static('public'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: '互动影像游戏', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/scenes', sceneRoutes);
app.use('/api/choices', choiceRoutes);
app.use('/api/endings', endingRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api/play', playRoutes);
app.use('/api/videos', mediaRoutes);  // 音轨/字幕 挂载在同路径下

// 404
app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[Server] 全局错误:', err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '文件大小超过限制(最大500MB)' });
    return res.status(400).json({ error: '文件上传错误: ' + err.message });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log('  互动影像游戏 - 后台服务');
  console.log('  端口: ' + PORT + '  绑定: ' + HOST);
  console.log('  本机: http://localhost:' + PORT);
  console.log('  管理后台: http://localhost:' + PORT + '/admin.html');
  console.log('  游戏入口: http://localhost:' + PORT);
  console.log('='.repeat(50));
});

const initDB = require('./config/init-db');
initDB().then(() => {
  console.log('[Server] 数据库初始化完成，服务已就绪');
}).catch(err => {
  console.error('[Server] 数据库初始化失败:', err.message);
});

module.exports = app;
