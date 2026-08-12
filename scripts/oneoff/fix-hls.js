// 一次性修复脚本 — 修复 HLS 音轨/字幕
// 注意：已归档，hls-transcode.js 已重构为增量重建模式
const { addSubtitleHLS } = require('../../utils/hls-transcode');
const pool = require('../../config/db');

(async () => {
  for (const vid of [64, 63]) {
    const [subs] = await pool.query(
      'SELECT id, language FROM video_subtitles WHERE video_id = ? AND hls_status != ?',
      [vid, 'done']
    );
    if (subs.length === 0) {
      console.log(`Video ${vid}: 字幕全部 done`);
      continue;
    }
    console.log(`Video ${vid}: 处理 ${subs.length} 个字幕...`);
    for (const s of subs) {
      console.log(`  字幕 ${s.language} (#${s.id})...`);
      await new Promise((resolve) => {
        addSubtitleHLS(vid, s.id);
        const check = setInterval(async () => {
          const [rows] = await pool.query(
            'SELECT hls_status FROM video_subtitles WHERE id = ?', [s.id]
          );
          if (rows[0]?.hls_status === 'done') {
            clearInterval(check);
            console.log(`    -> done`);
            resolve();
          }
        }, 500);
        setTimeout(() => { clearInterval(check); console.log('    -> timeout'); resolve(); }, 30000);
      });
    }
  }

  console.log('\n=== 最终状态 ===');
  const [a] = await pool.query('SELECT video_id, language, hls_status FROM video_audios WHERE video_id IN (63,64) ORDER BY video_id, id');
  console.log('音轨:'); a.forEach(r => console.log(`  v${r.video_id} ${r.language}=${r.hls_status}`));
  const [s] = await pool.query('SELECT video_id, language, hls_status FROM video_subtitles WHERE video_id IN (63,64) ORDER BY video_id, id');
  console.log('字幕:'); s.forEach(r => console.log(`  v${r.video_id} ${r.language}=${r.hls_status}`));
  
  pool.end();
})();
