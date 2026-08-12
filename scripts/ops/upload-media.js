/**
 * 为视频上传多语言音轨和字幕
 * 用法: cd 项目根目录 && node scripts/ops/upload-media.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = 'http://localhost:3000';
const MEDIA = 'uploads/media';

const LANGS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

function apiPost(url, token, formData) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const chunks = [];

    for (const [key, val] of Object.entries(formData)) {
      if (val instanceof Object && val.filePath) {
        const fileContent = fs.readFileSync(val.filePath);
        const filename = path.basename(val.filePath);
        chunks.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
        ));
        chunks.push(fileContent);
        chunks.push(Buffer.from('\r\n'));
      } else {
        chunks.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
        ));
      }
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(chunks);
    const req = http.request(u, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function login() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const r = JSON.parse(data);
        if (r.token) resolve(r.token);
        else reject(new Error('登录失败: ' + JSON.stringify(r)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const token = await login();
  console.log('登录成功, token=', token.slice(0, 20) + '...');

  for (const vid of [63, 64]) {
    const files = fs.readdirSync(MEDIA).filter(f => f.startsWith(`v${vid}-`));
    const audios = files.filter(f => f.endsWith('.mp3'));
    const subtitles = files.filter(f => f.endsWith('.vtt'));

    for (const f of audios) {
      const lang = f.split('-')[1];
      const cfg = LANGS.find(l => l.code === lang);
      const label = cfg ? cfg.label : lang;
      const filePath = path.join(MEDIA, f);
      console.log(`上传音轨: video=${vid} lang=${lang} label=${label} file=${f}`);
      try {
        const r = await apiPost(`${BASE}/api/media/${vid}/audios`, token, {
          file: { filePath },
          language: lang,
          label: label,
          is_default: '0',
        });
        console.log('  ->', r.message || r);
      } catch(e) { console.error('  -> 失败:', e.message); }
    }

    for (const f of subtitles) {
      const lang = f.split('-')[1];
      const cfg = LANGS.find(l => l.code === lang);
      const label = cfg ? cfg.label : lang;
      const filePath = path.join(MEDIA, f);
      console.log(`上传字幕: video=${vid} lang=${lang} label=${label} file=${f}`);
      try {
        const r = await apiPost(`${BASE}/api/media/${vid}/subtitles`, token, {
          file: { filePath },
          language: lang,
          label: label,
          is_default: '0',
        });
        console.log('  ->', r.message || r);
      } catch(e) { console.error('  -> 失败:', e.message); }
    }
  }

  console.log('\n上传完成！HLS 自动重建中...');
  for (const vid of [63, 64]) {
    try {
      const r = await apiPost(`${BASE}/api/videos/${vid}/rebuild-hls`, token, {});
      console.log(`触发 HLS 重建 video=${vid}:`, r.message || r);
    } catch(e) { console.error('HLS重建失败:', e.message); }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
