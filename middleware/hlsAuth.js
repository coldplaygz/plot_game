/**
 * HLS 防盗链中间件
 *
 * 策略：Cookie 鉴权（主） + URL Token（备用） + Referer 校验 + 速率限制
 *
 * 工作原理：
 * 1. 用户登录时签发 hls_token cookie（httpOnly，浏览器自动随请求发送）
 *    cookie 值 = {userId}.{HMAC签名}，自包含 userId 供验签
 * 2. hls.js 请求 m3u8/ts 分片时浏览器自动带 cookie，无需前端改 URL
 * 3. 同时支持 URL ?token=xxx 参数（用于非浏览器场景或跨域）
 * 4. Referer 校验防止第三方站点嵌入
 * 5. 单 IP 速率限制防止批量抓取
 */
const crypto = require('crypto');

// 复用 JWT_SECRET 作为 HMAC 密钥
const HLS_SECRET = process.env.JWT_SECRET;
if (!HLS_SECRET) {
  console.error('[HlsAuth] JWT_SECRET 未配置');
}

// Cookie 有效期（秒），与 JWT_EXPIRES_IN 对齐
const COOKIE_MAX_AGE = 24 * 3600;

// === 允许的 Referer 域名（从 CORS 白名单提取） ===
const DEFAULT_HOSTS = ['localhost:3000', 'localhost:5173', '127.0.0.1:3000', '127.0.0.1:5173', 'sp.yy388.xyz'];
const ALLOWED_HOSTS = (process.env.CORS_ALLOWED_ORIGINS)
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => {
      try { return new URL(s.trim()).host; } catch { return null; }
    }).filter(Boolean)
  : DEFAULT_HOSTS;

// === 速率限制（基于 IP，每分钟最多 600 次请求，约 10 个并发视频） ===
const HLS_RATE_MAX = 600;
const rateMap = new Map(); // ip -> { count, resetAt }
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (entry.resetAt < now) rateMap.delete(ip);
  }
}, 60 * 1000).unref();

function checkRate(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + 60 * 1000 };
    rateMap.set(ip, entry);
    return true;
  }
  entry.count++;
  return entry.count <= HLS_RATE_MAX;
}

// === 签发 / 验证 token ===

/**
 * 生成 HLS token（自包含 userId）
 * 格式：{userId}.{HMAC签名}
 */
function generateToken(userId) {
  const sig = crypto.createHmac('sha256', HLS_SECRET).update('hls:' + userId).digest('hex');
  return `${userId}.${sig}`;
}

/**
 * 验证 token 是否合法
 * @param {string} token - 格式 {userId}.{sig}
 * @returns {boolean}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return false;
  const userId = token.substring(0, dotIdx);
  const sig = token.substring(dotIdx + 1);
  const expected = crypto.createHmac('sha256', HLS_SECRET).update('hls:' + userId).digest('hex');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/**
 * 手动解析 Cookie 头（避免引入 cookie-parser 依赖）
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(item => {
    const eqIdx = item.indexOf('=');
    if (eqIdx > 0) {
      const key = item.substring(0, eqIdx).trim();
      cookies[key] = item.substring(eqIdx + 1).trim();
    }
  });
  return cookies;
}

/**
 * 在响应中设置 hls_token cookie
 * @param {import('express').Response} res
 * @param {number} userId
 */
function setHlsCookie(res, userId) {
  const token = generateToken(userId);
  const isProduction = process.env.NODE_ENV === 'production';
  const flags = ['httponly', 'samesite=lax', 'path=/', `max-age=${COOKIE_MAX_AGE}`];
  if (isProduction) flags.push('secure');
  res.setHeader('Set-Cookie', `hls_token=${token}; ${flags.join('; ')}`);
}

/**
 * 从请求中提取并验证 HLS 凭证（Cookie 优先，URL token 备用）
 * @returns {boolean}
 */
function verifyRequest(req) {
  // 1. 尝试 Cookie（浏览器播放时自动携带）
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.hls_token && verifyToken(cookies.hls_token)) return true;

  // 2. 尝试 URL token（非浏览器场景或跨域）
  const urlToken = req.query.token;
  if (urlToken && verifyToken(urlToken)) return true;

  return false;
}

/**
 * Referer / Origin 校验（防盗链）
 */
function checkReferer(req) {
  const referer = req.headers.referer || req.headers.referrer || '';
  const origin = req.headers.origin || '';
  // 无 Referer 且无 Origin：同源请求（如浏览器地址栏直接访问），允许
  if (!referer && !origin) return true;
  const urlStr = referer || origin;
  try {
    const host = new URL(urlStr).host;
    return ALLOWED_HOSTS.includes(host);
  } catch {
    return false;
  }
}

/**
 * HLS 鉴权中间件
 * 用于 /uploads/videos/ 路径，保护 HLS 流和原始视频文件
 */
function hlsAuthMiddleware(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  // 1. 速率限制
  if (!checkRate(ip)) {
    return res.status(429).json({ error: '请求过于频繁' });
  }

  // 2. Referer 校验
  if (!checkReferer(req)) {
    return res.status(403).json({ error: '禁止外部引用' });
  }

  // 3. 凭证校验（Cookie 或 URL token）
  if (!verifyRequest(req)) {
    return res.status(403).json({ error: '无访问权限' });
  }

  next();
}

module.exports = { hlsAuthMiddleware, setHlsCookie, generateToken, verifyToken };
