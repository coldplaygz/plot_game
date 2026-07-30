// fix-hls-subs.js — 直接复制字幕 VTT + 手动 regenMaster
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

function buildMasterPlaylist(audios, subs, bandwidth) {
  const bw = Math.max(parseInt(bandwidth) || 1500000, 500000);
  const lines = ['#EXTM3U', '#EXT-X-VERSION:6'];
  const okAudios = audios.filter(a => a.hls_status === 'done');
  const okSubs = subs.filter(s => s.hls_status === 'done');
  const audioGroupId = 'audio-group';
  okAudios.forEach((a) => {
    const def = a.is_default ? 'YES' : 'NO';
    const lang = a.language || ('audio' + a.id);
    lines.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="${audioGroupId}",NAME="${a.label}",LANGUAGE="${lang}",DEFAULT=${def},AUTOSELECT=${def},URI="audio_${lang}.m3u8"`);
  });
  const subGroupId = 'sub-group';
  okSubs.forEach((s) => {
    const def = s.is_default ? 'YES' : 'NO';
    const lang = s.language || ('sub' + s.id);
    lines.push(`#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${subGroupId}",NAME="${s.label}",LANGUAGE="${lang}",DEFAULT=${def},AUTOSELECT=${def},FORCED=NO,URI="sub_${lang}.vtt"`);
  });
  let streamInf = `#EXT-X-STREAM-INF:BANDWIDTH=${bw}`;
  if (okAudios.length > 0) streamInf += `,AUDIO="${audioGroupId}"`;
  if (okSubs.length > 0) streamInf += `,SUBTITLES="${subGroupId}"`;
  lines.push(streamInf);
  lines.push('video.m3u8');
  return lines.join('\n') + '\n';
}

(async () => {
  for (const vid of [64, 63]) {
    const hlsDir = `uploads/videos/${vid}_hls`;
    if (!fs.existsSync(hlsDir)) { console.log(`Video ${vid}: HLS目录不存在`); continue; }

    const [subs] = await pool.query('SELECT * FROM video_subtitles WHERE video_id = ?', [vid]);
    // 复制所有未 done 的字幕
    for (const sub of subs) {
      if (sub.hls_status === 'done') continue;
      if (!fs.existsSync(sub.file_path)) {
        console.log(`  v${vid} ${sub.language}: 文件不存在 ${sub.file_path}`);
        continue;
      }
      const dest = path.join(hlsDir, `sub_${sub.language}.vtt`);
      fs.copyFileSync(sub.file_path, dest);
      await pool.query('UPDATE video_subtitles SET hls_status=?, hls_playlist_path=? WHERE id=?',
        ['done', `uploads/videos/${vid}_hls/sub_${sub.language}.vtt`, sub.id]);
      console.log(`  v${vid} ${sub.language}: done`);
    }

    // regenMaster
    const [audios] = await pool.query('SELECT * FROM video_audios WHERE video_id = ?', [vid]);
    const [doneSubs] = await pool.query('SELECT * FROM video_subtitles WHERE video_id = ? AND hls_status=?', [vid, 'done']);
    const content = buildMasterPlaylist(audios, doneSubs, 1500000);
    fs.writeFileSync(path.join(hlsDir, 'master.m3u8'), content, 'utf8');
    console.log(`Video ${vid}: master.m3u8 已更新 (${audios.filter(a=>a.hls_status==='done').length}音轨, ${doneSubs.length}字幕)`);
  }

  pool.end();
})();
