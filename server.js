const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const sceneRoutes = require('./routes/scenes');
const choiceRoutes = require('./routes/choices');
const videoRoutes = require('./routes/videos');
const saveRoutes = require('./routes/saves');
const playRoutes = require('./routes/play');
const mediaRoutes = require('./routes/media');
const gameRoutes = require('./routes/games');
const configRoutes = require('./routes/config');
const userRoutes = require('./routes/users');
const rechargeRoutes = require('./routes/recharge');
const pointsRoutes = require('./routes/points');
const propRoutes = require('./routes/props');

const { uploadHeaders, spaHeaders } = require('./config/static');

const app = express();
const PORT = process.env.PORT || 3000;

// === UTF-8 编码修复 ===
// 强制所有请求体按 UTF-8 解析
app.use(express.json({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));
// 全局 UTF-8（不覆盖静态文件的 Content-Type）
app.use((req, res, next) => {
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
  maxAge: '365d',
  immutable: true,
  setHeaders: uploadHeaders
}));

// Vue 前端 SPA (生产构建产物)
// 缓存策略：hash 资源长期缓存，index.html 不缓存
app.use('/assets', express.static(path.join(__dirname, 'client/dist/assets'), { maxAge: '365d', immutable: true }));
app.use(express.static(path.join(__dirname, 'client/dist'), {
  setHeaders: spaHeaders
}));

// HLS 对比测试页（照搬 hls.js demo 实现，用于对比验证音轨切换）
app.get('/hls-test', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public/hls-test.html'));
});
// 暴露 hls.js dist 目录供测试页引用
app.use('/hls.js', express.static(path.join(__dirname, 'client/node_modules/hls.js/dist')));

// SPA fallback — 所有非 /api 非 /uploads 的路径返回 Vue index.html
app.get(/^(?!\/(api|uploads|hls-test|hls\.js))/, (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: '互动影像游戏', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/scenes', sceneRoutes);
app.use('/api/choices', choiceRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api/play', playRoutes);
app.use('/api/media', mediaRoutes);  // 音轨/字幕
app.use('/api/games', gameRoutes);   // 游戏分类
app.use('/api/config', configRoutes); // 系统配置
app.use('/api/users', userRoutes);    // 用户管理
app.use('/api/recharge', rechargeRoutes); // 充值管理
app.use('/api/points', pointsRoutes);  // 积分
app.use('/api/props', propRoutes);     // 道具

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
  console.log('  长城AI互动短剧平台 - 后台服务');
  console.log('  端口: ' + PORT + '  绑定: ' + HOST);
  console.log('  本机: http://localhost:' + PORT);
  console.log('  管理后台: http://localhost:' + PORT + '/admin');
  console.log('  游戏入口: http://localhost:' + PORT);
  console.log('='.repeat(50));
});

const initDB = require('./config/init-db');
const { recoverPendingHLS } = require('./utils/hls-transcode');
initDB().then(() => {
  console.log('[Server] 数据库初始化完成，服务已就绪');
  // 启动时恢复中断的 HLS 转码任务
  recoverPendingHLS();
}).catch(err => {
  console.error('[Server] 数据库初始化失败:', err.message);
});

module.exports = app;
