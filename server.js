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
const themeRoutes = require('./routes/themes');
const dialogueRoutes = require('./routes/dialogues');
const dialogueLibraryRoutes = require('./routes/dialogue-library');

const { uploadHeaders, spaHeaders } = require('./config/static');
const { hlsAuthMiddleware } = require('./middleware/hlsAuth');
const { rateLimit } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// 生产环境经 Nginx 反代时取真实客户端 IP（否则 req.ip 永远是 127.0.0.1，速率限制失效）
app.set('trust proxy', 1);

// ============ CORS 白名单 ============
// 默认允许本地开发各端口 + 生产域名；生产环境务必通过 CORS_ALLOWED_ORIGINS 显式配置
const DEFAULT_ORIGINS = [
  'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173',
  'http://sp.yy388.xyz', 'https://sp.yy388.xyz'
];
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS)
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

const corsOptions = {
  origin(origin, cb) {
    // 允许同源请求（origin 为 undefined，如 curl/同源页面）以及白名单来源
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};
// 局域网 IP / 自定义主机名直访：Origin 与请求 Host 一致时视为同源，跳过白名单
// （Vite 模块脚本以 CORS 模式加载，同源也会带 Origin 头；
//   若不放行，通过 192.168.x.x 等非白名单地址访问时静态资源会被 403 拒绝）
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && req.headers.host) {
    try { if (new URL(origin).host === req.headers.host) delete req.headers.origin; }
    catch (_) { /* 非法 Origin，交由 cors 白名单处理 */ }
  }
  next();
});
app.use(cors(corsOptions));

// ============ 安全 HTTP 头 ============
// 不依赖 helmet，手动设置核心安全头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');            // 防止点击劫持
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // HSTS 仅在 HTTPS 下生效
  if (req.protocol === 'https' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// 全局 API 速率限制：每个 IP 每分钟最多 120 次请求（防止接口滥用）
const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, message: 'API 请求过于频繁，请稍后再试' });
app.use('/api/', globalLimiter);

// === UTF-8 编码修复 ===
// 强制所有请求体按 UTF-8 解析
app.use(express.json({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));
// JSON 响应使用正确 charset
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return oldJson.call(this, data);
  };
  next();
});

// 封面图：公开（首页游戏列表展示需要）
app.use('/uploads/covers', express.static('uploads/covers', {
  maxAge: '7d',
  setHeaders: uploadHeaders
}));
// 视频/HLS/音轨/字幕：需 HLS 鉴权（Cookie 或 URL Token）
app.use('/uploads', hlsAuthMiddleware, express.static('uploads', {
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

// 健康检查（去除可识别信息，仅暴露状态）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
app.use('/api/themes', themeRoutes);   // 选项主题
app.use('/api/dialogues', dialogueRoutes); // 场景对白
app.use('/api/dialogue-library', dialogueLibraryRoutes); // 对白库

// 404
app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

// 全局错误处理
app.use((err, req, res, next) => {
  // CORS 错误（origin 不在白名单）
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: '来源不在允许列表' });
  }
  console.error('[Server] 全局错误:', err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '文件大小超过限制(最大500MB)' });
    return res.status(400).json({ error: '文件上传错误' });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

// ============ 进程级异常兜底（防止崩溃后无日志静默退出） ============
process.on('uncaughtException', (err) => {
  console.error('[Process] uncaughtException:', err);
  // 不立即退出，记录后让现有连接自然结束；严重错误由 PM2 重启
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process] unhandledRejection:', reason);
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
