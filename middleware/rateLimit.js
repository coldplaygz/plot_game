/**
 * 速率限制中间件（内存版，无外部依赖）
 * 用于保护登录、注册、充值等敏感接口免受暴力破解
 *
 * 策略：基于 IP + 路径的滑动窗口计数
 */

// 内存存储：Map<key, { count, resetAt }>
const store = new Map();

// 定期清理过期条目（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * 创建速率限制中间件
 * @param {Object} opts
 * @param {number} opts.windowMs - 时间窗口（毫秒）
 * @param {number} opts.max - 窗口内最大请求数
 * @param {string} opts.message - 超限错误消息
 */
function rateLimit(opts = {}) {
  const windowMs = opts.windowMs || 15 * 60 * 1000;  // 默认 15 分钟
  const max = opts.max || 100;
  const message = opts.message || '请求过于频繁，请稍后再试';

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      // 新窗口或已过期
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: message, retry_after: retryAfter });
    }

    next();
  };
}

module.exports = { rateLimit };
