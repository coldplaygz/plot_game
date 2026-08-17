const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// 安全：JWT_SECRET 必须由环境变量提供，禁止使用弱默认值
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('[Auth] 安全错误: JWT_SECRET 未设置或长度不足 16 字符，请在 .env 中配置强随机字符串');
  console.error('[Auth] 可用命令生成: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// 同时缩短过期时间：72h → 24h（配合后续 refresh token 改造）
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// HLS token 生成（与 hlsAuth.js 一致，避免循环依赖直接内联）
function generateHlsToken(userId) {
  const sig = crypto.createHmac('sha256', JWT_SECRET).update('hls:' + userId).digest('hex');
  return `${userId}.${sig}`;
}

// 解析 Cookie 头
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(item => {
    const eqIdx = item.indexOf('=');
    if (eqIdx > 0) {
      cookies[item.substring(0, eqIdx).trim()] = item.substring(eqIdx + 1).trim();
    }
  });
  return cookies;
}

// 验证 hls_token 是否合法
function verifyHlsToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return false;
  const userId = token.substring(0, dotIdx);
  const sig = token.substring(dotIdx + 1);
  const expected = crypto.createHmac('sha256', JWT_SECRET).update('hls:' + userId).digest('hex');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// 自动补发 hls_token cookie（兼容旧登录态：用户在加 HLS 鉴权前已登录）
function ensureHlsCookie(req, res, userId) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.hls_token && verifyHlsToken(cookies.hls_token)) return; // 已有合法 cookie
  // 补发 cookie
  const token = generateHlsToken(userId);
  const isProduction = process.env.NODE_ENV === 'production';
  const flags = ['httponly', 'samesite=lax', 'path=/', `max-age=${24 * 3600}`];
  if (isProduction) flags.push('secure');
  res.setHeader('Set-Cookie', `hls_token=${token}; ${flags.join('; ')}`);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    // 兼容旧登录态：JWT 合法但浏览器没有 hls_token cookie（HLS 鉴权新增前的登录）
    // 自动补发，避免旧用户被 HLS 中间件拦截、需重新登录
    ensureHlsCookie(req, res, decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '请先登录' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET, JWT_EXPIRES_IN };
