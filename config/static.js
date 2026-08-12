/**
 * 静态文件 MIME + 缓存策略统一配置
 * 供 server.js 的 express.static setHeaders 使用
 */

// 上传文件（uploads 目录）的 MIME + 缓存策略
function uploadHeaders(res, filePath) {
  if (filePath.endsWith('.m3u8')) {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
  } else if (filePath.endsWith('.ts')) {
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Accept-Ranges', 'bytes');
    // HLS 分片文件重建后 URL 不变但内容变化，必须验证（否则浏览器用缓存的旧分片）
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  } else if (filePath.endsWith('.mp4')) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
  } else if (filePath.endsWith('.webm')) {
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Accept-Ranges', 'bytes');
  } else if (filePath.endsWith('.mov')) {
    res.setHeader('Content-Type', 'video/quicktime');
    res.setHeader('Accept-Ranges', 'bytes');
  } else if (filePath.endsWith('.mp3') || filePath.endsWith('.m4a')) {
    res.setHeader('Content-Type', 'audio/mpeg');
  } else if (filePath.endsWith('.vtt')) {
    res.setHeader('Content-Type', 'text/vtt');
  }
}

// Vue SPA 构建产物的缓存策略
function spaHeaders(res, filePath) {
  if (filePath.endsWith('index.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}

module.exports = { uploadHeaders, spaHeaders };
