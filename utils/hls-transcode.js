/**
 * HLS 多音轨转码模块（单码率 + 增量重建）
 *
 * 产物结构：
 *   uploads/videos/{videoId}_hls/
 *   ├── master.m3u8          # 主播放列表（串联视频/音频/字幕）
 *   ├── video.m3u8           # 视频播放列表（无外挂音轨时含原声）
 *   ├── seg_v_000.ts ...     # 视频分片
 *   ├── audio_{lang}.m3u8    # 每条音轨子播放列表（独立）
 *   ├── seg_a_{lang}_*.ts    # 音轨分片
 *   └── sub_{lang}.vtt       # 字幕（直接引用 WebVTT，不分片）
 *
 * 重建策略：
 *   - 全量重建：视频上传/手动重建 → 重切视频+所有音轨+字幕
 *   - 增量-音轨：上传/替换音轨 → 只切该条音轨 + regenMaster
 *   - 增量-字幕：上传字幕 → 只复制 vtt + regenMaster
 *   - 删除-音轨：删对应 audio_{lang}.* 分片 + regenMaster
 *   - 删除-字幕：删对应 sub_{lang}.vtt + regenMaster
 */
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// ffprobe 路径探测：优先系统，否则 npm 包同目录
const sysFfprobePaths = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe'];
let ffprobeFound = false;
for (const p of sysFfprobePaths) {
  if (fs.existsSync(p)) { ffmpeg.setFfprobePath(p); ffprobeFound = true; break; }
}
if (!ffprobeFound) {
  const localFfprobe = path.join(path.dirname(ffmpegPath), 'ffprobe');
  if (fs.existsSync(localFfprobe)) ffmpeg.setFfprobePath(localFfprobe);
}

const pool = require('../config/db');

// ─── per-video 互斥锁：同一视频的操作串行，不同视频可并行 ───
const videoLocks = new Map(); // videoId -> Promise chain

function withVideoLock(videoId, fn) {
  const prev = videoLocks.get(videoId) || Promise.resolve();
  // 无论前一个任务成功/失败，都继续执行下一个
  const next = prev.then(fn, fn);
  videoLocks.set(videoId, next);
  next.finally(() => {
    if (videoLocks.get(videoId) === next) videoLocks.delete(videoId);
  });
  return next;
}

// ─── 探测视频编码 ───
function probeVideoCodec(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err || !meta || !meta.streams) { resolve({ codec: null, bandwidth: 1500000 }); return; }
      const v = meta.streams.find(s => s.codec_type === 'video');
      const bandwidth = v && v.bit_rate ? parseInt(v.bit_rate) : 1500000;
      resolve({ codec: v ? v.codec_name : null, bandwidth });
    });
  });
}

// ─── HLS 目录路径辅助 ───
function getHlsDir(videoId) {
  return path.join('uploads', 'videos', `${videoId}_hls`);
}

// ─── 全量 HLS 转码（视频上传/手动重建） ───
async function transcodeVideoToHLS(videoId) {
  const [vRows] = await pool.query('SELECT * FROM videos WHERE id = ?', [videoId]);
  if (vRows.length === 0) throw new Error('视频不存在');
  const video = vRows[0];
  if (!fs.existsSync(video.file_path)) throw new Error('视频源文件不存在: ' + video.file_path);

  const [audios] = await pool.query(
    'SELECT * FROM video_audios WHERE video_id = ? ORDER BY is_default DESC, id ASC', [videoId]
  );
  const [subs] = await pool.query(
    'SELECT * FROM video_subtitles WHERE video_id = ? ORDER BY is_default DESC, id ASC', [videoId]
  );

  const hlsDir = getHlsDir(videoId);
  // 清理旧目录（重建场景）
  if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true, force: true });
  fs.mkdirSync(hlsDir, { recursive: true });

  const hlsDirAbs = path.resolve(hlsDir);

  // ── 1. 视频分片 ──
  // 有外挂音轨时去掉原音轨（-an），音轨单独切片；无外挂音轨时保留原音轨（AAC 编码）
  const { codec, bandwidth } = await probeVideoCodec(video.file_path);
  const hasAltAudio = audios.length > 0;
  const videoCodecOpt = codec === 'h264' ? '-c:v copy' : '-c:v libx264 -profile:v main -pix_fmt yuv420p -preset fast -crf 23';
  const audioOpt = hasAltAudio ? ['-an'] : ['-c:a', 'aac', '-b:a', '128k'];
  console.log(`[HLS] #${videoId} 视频编码=${codec || 'unknown'}, 使用=${codec === 'h264' ? 'copy' : 'libx264'}, 外挂音轨=${hasAltAudio ? '有(去原音)' : '无(保留原音)'}`);

  await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['transcoding', videoId]);
  await new Promise((resolve, reject) => {
    ffmpeg(video.file_path)
      .outputOptions([
        videoCodecOpt,
        ...audioOpt,
        '-hls_time', '6',
        '-hls_list_size', '0',
        '-hls_segment_filename', path.join(hlsDirAbs, 'seg_v_%03d.ts')
      ])
      .output(path.join(hlsDirAbs, 'video.m3u8'))
      .on('start', cmd => console.log(`[HLS] #${videoId} 视频分片启动`))
      .on('end', () => { console.log(`[HLS] #${videoId} 视频分片完成`); resolve(); })
      .on('error', (err) => reject(new Error('视频分片失败: ' + err.message)))
      .run();
  });

  // ── 2. 每条音轨分片（AAC 128k） ──
  for (const audio of audios) {
    await sliceAudioTrack(videoId, audio, hlsDirAbs, hlsDir);
  }

  // ── 3. 字幕：复制 .vtt 到 hls 目录 ──
  for (const sub of subs) {
    await copySubtitle(videoId, sub, hlsDirAbs, hlsDir);
  }

  // ── 4. 生成 master.m3u8 ──
  await regenMaster(videoId, bandwidth);

  await pool.query('UPDATE videos SET hls_master_path=?, hls_dir=?, hls_status=? WHERE id=?',
    [path.join(hlsDir, 'master.m3u8').replace(/\\/g, '/'), hlsDir.replace(/\\/g, '/'), 'done', videoId]);
  console.log(`[HLS] #${videoId} 全量转码完成`);
}

// ─── 单条音轨切片（全量/增量共用） ───
async function sliceAudioTrack(videoId, audio, hlsDirAbs, hlsDir) {
  if (!fs.existsSync(audio.file_path)) {
    console.warn(`[HLS] #${videoId} 音轨文件不存在，跳过: #${audio.id} ${audio.file_path}`);
    await pool.query('UPDATE video_audios SET hls_status=? WHERE id=?', ['failed', audio.id]);
    return;
  }
  const lang = audio.language || ('audio' + audio.id);
  const playListName = `audio_${lang}.m3u8`;
  const segPattern = `seg_a_${lang}_%03d.ts`;
  try {
    // 增量场景：先清理该音轨的旧分片
    removeAudioFiles(hlsDirAbs, lang);
    await new Promise((resolve, reject) => {
      ffmpeg(audio.file_path)
        .outputOptions([
          '-vn',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-hls_time', '6',
          '-hls_list_size', '0',
          '-hls_segment_filename', path.join(hlsDirAbs, segPattern)
        ])
        .output(path.join(hlsDirAbs, playListName))
        .on('end', () => { console.log(`[HLS] #${videoId} 音轨分片完成: ${lang}`); resolve(); })
        .on('error', (err) => reject(new Error(`音轨 ${lang} 分片失败: ` + err.message)))
        .run();
    });
    const playListPath = path.join(hlsDir, playListName).replace(/\\/g, '/');
    await pool.query('UPDATE video_audios SET hls_playlist_path=?, hls_status=? WHERE id=?',
      [playListPath, 'done', audio.id]);
  } catch (e) {
    console.warn(`[HLS] #${videoId} 音轨 ${lang} 转码失败:`, e.message);
    await pool.query('UPDATE video_audios SET hls_status=? WHERE id=?', ['failed', audio.id]);
  }
}

// ─── 单条字幕复制（全量/增量共用） ───
// 复制 .vtt 到 HLS 目录，并生成对应的 .m3u8 子播放列表（HLS 规范要求 EXT-X-MEDIA:SUBTITLES 的 URI 指向 m3u8，不是 vtt）
async function copySubtitle(videoId, sub, hlsDirAbs, hlsDir) {
  if (!fs.existsSync(sub.file_path)) {
    console.warn(`[HLS] #${videoId} 字幕文件不存在，跳过: #${sub.id}`);
    await pool.query('UPDATE video_subtitles SET hls_status=? WHERE id=?', ['failed', sub.id]);
    return;
  }
  const lang = sub.language || ('sub' + sub.id);
  const vttName = `sub_${lang}.vtt`;
  const m3u8Name = `sub_${lang}.m3u8`;
  try {
    fs.copyFileSync(sub.file_path, path.join(hlsDirAbs, vttName));

    // 生成字幕子播放列表（单分片，引用 .vtt 文件）
    // hls.js 会加载这个 m3u8，再加载其中的 .vtt 分片
    const m3u8Content = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:30',
    // 不设 END-LIST：字幕流是动态的，hls.js 会持续拉取（这里视频短，直接 END-LIST 也可以）
    // 为了简单和兼容，这里用 END-LIST 表示字幕就这一段
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:30.000,',
      vttName,
      '#EXT-X-ENDLIST'
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(hlsDirAbs, m3u8Name), m3u8Content, 'utf8');

    // hls_playlist_path 指向 .m3u8（master.m3u8 引用它）
    const m3u8Path = path.join(hlsDir, m3u8Name).replace(/\\/g, '/');
    await pool.query('UPDATE video_subtitles SET hls_playlist_path=?, hls_status=? WHERE id=?',
      [m3u8Path, 'done', sub.id]);
    console.log(`[HLS] #${videoId} 字幕复制完成: ${lang} (vtt + m3u8)`);
  } catch (e) {
    console.warn(`[HLS] #${videoId} 字幕 ${lang} 复制失败:`, e.message);
    await pool.query('UPDATE video_subtitles SET hls_status=? WHERE id=?', ['failed', sub.id]);
  }
}

// ─── 删除指定音轨的分片文件 ───
function removeAudioFiles(hlsDirAbs, lang) {
  const playList = path.join(hlsDirAbs, `audio_${lang}.m3u8`);
  if (fs.existsSync(playList)) fs.unlinkSync(playList);
  // 删除该音轨所有 ts 分片
  if (fs.existsSync(hlsDirAbs)) {
    const files = fs.readdirSync(hlsDirAbs);
    for (const f of files) {
      if (f.startsWith(`seg_a_${lang}_`) && f.endsWith('.ts')) {
        fs.unlinkSync(path.join(hlsDirAbs, f));
      }
    }
  }
}

// ─── 删除指定字幕文件（.vtt + .m3u8） ───
function removeSubtitleFile(hlsDirAbs, lang) {
  const vtt = path.join(hlsDirAbs, `sub_${lang}.vtt`);
  if (fs.existsSync(vtt)) fs.unlinkSync(vtt);
  const m3u8 = path.join(hlsDirAbs, `sub_${lang}.m3u8`);
  if (fs.existsSync(m3u8)) fs.unlinkSync(m3u8);
}

// ─── 重生成 master.m3u8（从 DB 读取最新状态） ───
async function regenMaster(videoId, bandwidth) {
  const [vRows] = await pool.query('SELECT hls_dir FROM videos WHERE id = ?', [videoId]);
  if (vRows.length === 0) throw new Error('视频不存在');
  const hlsDir = vRows[0].hls_dir || getHlsDir(videoId);
  const hlsDirAbs = path.resolve(hlsDir);

  if (!fs.existsSync(hlsDirAbs)) {
    throw new Error('HLS 目录不存在，需先全量转码');
  }

  const [audios] = await pool.query(
    'SELECT * FROM video_audios WHERE video_id = ? ORDER BY is_default DESC, id ASC', [videoId]
  );
  const [subs] = await pool.query(
    'SELECT * FROM video_subtitles WHERE video_id = ? ORDER BY is_default DESC, id ASC', [videoId]
  );

  const masterContent = buildMasterPlaylist(audios, subs, bandwidth || 1500000);
  fs.writeFileSync(path.join(hlsDirAbs, 'master.m3u8'), masterContent, 'utf8');
  console.log(`[HLS] #${videoId} master.m3u8 已重新生成`);
}

// ─── 生成 master.m3u8 内容 ───
// 只包含 hls_status === 'done' 的音轨/字幕，避免引用不存在的子播放列表
function buildMasterPlaylist(audios, subs, bandwidth) {
  const bw = Math.max(parseInt(bandwidth) || 1500000, 500000);
  const lines = ['#EXTM3U', '#EXT-X-VERSION:6'];

  const okAudios = audios.filter(a => a.hls_status === 'done');
  const okSubs = subs.filter(s => s.hls_status === 'done');

  const audioGroupId = 'audio-group';
  okAudios.forEach((a) => {
    const isDefault = a.is_default ? 'YES' : 'NO';
    const lang = a.language || ('audio' + a.id);
    lines.push(
      `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="${audioGroupId}",NAME="${a.label}",LANGUAGE="${lang}",DEFAULT=${isDefault},AUTOSELECT=${isDefault},URI="audio_${lang}.m3u8"`
    );
  });

  const subGroupId = 'sub-group';
  okSubs.forEach((s) => {
    const isDefault = s.is_default ? 'YES' : 'NO';
    const lang = s.language || ('sub' + s.id);
    // URI 指向 .m3u8（HLS 规范），不是 .vtt
    lines.push(
      `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${subGroupId}",NAME="${s.label}",LANGUAGE="${lang}",DEFAULT=${isDefault},AUTOSELECT=${isDefault},FORCED=NO,URI="sub_${lang}.m3u8"`
    );
  });

  let streamInf = `#EXT-X-STREAM-INF:BANDWIDTH=${bw}`;
  if (okAudios.length > 0) streamInf += `,AUDIO="${audioGroupId}"`;
  if (okSubs.length > 0) streamInf += `,SUBTITLES="${subGroupId}"`;
  lines.push(streamInf);
  lines.push('video.m3u8');

  return lines.join('\n') + '\n';
}

// ============ 增量重建 API ============

// 全量重建入队（视频上传/手动重建/批量重建）
function enqueueHLS(videoId) {
  pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['queued', videoId]).catch(() => {});
  withVideoLock(videoId, async () => {
    console.log(`[HLS] 全量重建开始 #${videoId}`);
    await transcodeVideoToHLS(videoId);
  }).catch(e => {
    console.warn(`[HLS] 全量重建失败 #${videoId}:`, e.message);
    pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['failed', videoId]).catch(() => {});
  });
}

// 增量：重建单条音轨（上传/替换音轨后调用）
function rebuildAudioTrackHLS(videoId, audioId) {
  withVideoLock(videoId, async () => {
    const [vRows] = await pool.query('SELECT hls_dir, hls_status FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];

    // HLS 目录不存在或视频未转码 → 降级全量
    if (!video.hls_dir || !fs.existsSync(video.hls_dir) || !fs.existsSync(path.join(video.hls_dir, 'video.m3u8'))) {
      console.log(`[HLS] #${videoId} HLS 目录不存在，降级全量重建`);
      await transcodeVideoToHLS(videoId);
      return;
    }

    // 视频从「无外挂音轨」变「有外挂音轨」时，需重切视频（去原音轨）
    const [aRows] = await pool.query('SELECT COUNT(*) as cnt FROM video_audios WHERE video_id = ?', [videoId]);
    const audioCount = aRows[0].cnt;
    const [audioRows] = await pool.query('SELECT * FROM video_audios WHERE id = ?', [audioId]);
    if (audioRows.length === 0) return;
    const audio = audioRows[0];

    // 检查 video.m3u8 是否已去音轨（通过文件名特征无法判断，改用：第一条音轨且 video.m3u8 含音轨时重切）
    // 简化策略：如果是第一条音轨，重切视频去掉原音轨
    if (audioCount === 1) {
      console.log(`[HLS] #${videoId} 首条音轨，重切视频去原音`);
      const { bandwidth } = await probeVideoCodec((await pool.query('SELECT file_path FROM videos WHERE id = ?', [videoId]))[0][0].file_path);
      await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['transcoding', videoId]);
      const hlsDirAbs = path.resolve(video.hls_dir);
      const [vRow] = await pool.query('SELECT file_path FROM videos WHERE id = ?', [videoId]);
      await new Promise((resolve, reject) => {
        ffmpeg(vRow[0].file_path)
          .outputOptions([
            '-c:v', 'copy',
            '-an',
            '-hls_time', '6',
            '-hls_list_size', '0',
            '-hls_segment_filename', path.join(hlsDirAbs, 'seg_v_%03d.ts')
          ])
          .output(path.join(hlsDirAbs, 'video.m3u8'))
          .on('end', () => resolve())
          .on('error', (err) => reject(new Error('视频重切失败: ' + err.message)))
          .run();
      });
      await sliceAudioTrack(videoId, audio, hlsDirAbs, video.hls_dir);
      await regenMaster(videoId, bandwidth);
      await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['done', videoId]);
      console.log(`[HLS] #${videoId} 首条音轨增量完成`);
      return;
    }

    // 已有多条音轨，只切这一条 + regenMaster
    console.log(`[HLS] #${videoId} 增量切音轨: ${audio.language}`);
    const hlsDirAbs = path.resolve(video.hls_dir);
    await sliceAudioTrack(videoId, audio, hlsDirAbs, video.hls_dir);
    await regenMaster(videoId);
  }).catch(e => {
    console.warn(`[HLS] 增量音轨失败 #${videoId}:`, e.message);
  });
}

// 增量：删除音轨（删除音轨后调用）
function removeAudioTrackHLS(videoId, audioId) {
  withVideoLock(videoId, async () => {
    const [vRows] = await pool.query('SELECT hls_dir FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];
    if (!video.hls_dir || !fs.existsSync(video.hls_dir)) return;

    // 音轨已从 DB 删除，这里只能拿到 audioId，无法查 language
    // 由调用方传入 lang 更好，但为保持接口简单，从文件系统匹配 audioId 对应的分片
    // 实际上 removeAudioTrackHLS 应在删除 DB 记录前调用以获取 lang
    // 这里作为兜底：由 media.js 传入 lang
    console.log(`[HLS] #${videoId} 音轨删除（由 media.js 处理文件清理）`);
    await regenMaster(videoId);

    // 如果删完音轨后没有外挂音轨了，需重切视频恢复原音轨
    const [aRows] = await pool.query('SELECT COUNT(*) as cnt FROM video_audios WHERE video_id = ?', [videoId]);
    if (aRows[0].cnt === 0) {
      console.log(`[HLS] #${videoId} 无外挂音轨，重切视频恢复原音`);
      const [vRow] = await pool.query('SELECT file_path FROM videos WHERE id = ?', [videoId]);
      if (fs.existsSync(vRow[0].file_path)) {
        const hlsDirAbs = path.resolve(video.hls_dir);
        await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['transcoding', videoId]);
        await new Promise((resolve, reject) => {
          ffmpeg(vRow[0].file_path)
            .outputOptions([
              '-c:v', 'copy',
              '-c:a', 'aac', '-b:a', '128k',
              '-hls_time', '6',
              '-hls_list_size', '0',
              '-hls_segment_filename', path.join(hlsDirAbs, 'seg_v_%03d.ts')
            ])
            .output(path.join(hlsDirAbs, 'video.m3u8'))
            .on('end', () => resolve())
            .on('error', (err) => reject(new Error('视频重切失败: ' + err.message)))
            .run();
        });
        await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['done', videoId]);
        await regenMaster(videoId);
      }
    }
  }).catch(e => {
    console.warn(`[HLS] 删除音轨失败 #${videoId}:`, e.message);
  });
}

// 增量：删除音轨（带 lang 参数，用于清理分片文件）
function removeAudioTrackByLangHLS(videoId, lang) {
  withVideoLock(videoId, async () => {
    const [vRows] = await pool.query('SELECT hls_dir FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];
    if (!video.hls_dir || !fs.existsSync(video.hls_dir)) return;

    // 删除该音轨的分片文件
    const hlsDirAbs = path.resolve(video.hls_dir);
    removeAudioFiles(hlsDirAbs, lang);
    console.log(`[HLS] #${videoId} 已删除音轨 ${lang} 分片文件`);

    await regenMaster(videoId);

    // 如果删完音轨后没有外挂音轨了，需重切视频恢复原音轨
    const [aRows] = await pool.query('SELECT COUNT(*) as cnt FROM video_audios WHERE video_id = ?', [videoId]);
    if (aRows[0].cnt === 0) {
      console.log(`[HLS] #${videoId} 无外挂音轨，重切视频恢复原音`);
      const [vRow] = await pool.query('SELECT file_path FROM videos WHERE id = ?', [videoId]);
      if (fs.existsSync(vRow[0].file_path)) {
        await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['transcoding', videoId]);
        await new Promise((resolve, reject) => {
          ffmpeg(vRow[0].file_path)
            .outputOptions([
              '-c:v', 'copy',
              '-c:a', 'aac', '-b:a', '128k',
              '-hls_time', '6',
              '-hls_list_size', '0',
              '-hls_segment_filename', path.join(hlsDirAbs, 'seg_v_%03d.ts')
            ])
            .output(path.join(hlsDirAbs, 'video.m3u8'))
            .on('end', () => resolve())
            .on('error', (err) => reject(new Error('视频重切失败: ' + err.message)))
            .run();
        });
        await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['done', videoId]);
        await regenMaster(videoId);
      }
    }
  }).catch(e => {
    console.warn(`[HLS] 删除音轨失败 #${videoId}:`, e.message);
  });
}

// 增量：添加/替换字幕（上传字幕后调用）
function addSubtitleHLS(videoId, subId) {
  return withVideoLock(videoId, async () => {
    const [vRows] = await pool.query('SELECT hls_dir, hls_status FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];

    // HLS 目录不存在或视频未转码 → 降级全量
    if (!video.hls_dir || !fs.existsSync(video.hls_dir) || !fs.existsSync(path.join(video.hls_dir, 'video.m3u8'))) {
      console.log(`[HLS] #${videoId} HLS 目录不存在，降级全量重建`);
      await transcodeVideoToHLS(videoId);
      return;
    }

    const [subRows] = await pool.query('SELECT * FROM video_subtitles WHERE id = ?', [subId]);
    if (subRows.length === 0) return;
    const sub = subRows[0];

    const hlsDirAbs = path.resolve(video.hls_dir);
    await copySubtitle(videoId, sub, hlsDirAbs, video.hls_dir);
    await regenMaster(videoId);
    console.log(`[HLS] #${videoId} 增量字幕完成: ${sub.language}`);
  }).catch(e => {
    console.warn(`[HLS] 增量字幕失败 #${videoId}:`, e.message);
  });
}

// 增量：删除字幕（删除字幕后调用，需先传入 lang 清理文件）
function removeSubtitleByLangHLS(videoId, lang) {
  withVideoLock(videoId, async () => {
    const [vRows] = await pool.query('SELECT hls_dir FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];
    if (!video.hls_dir || !fs.existsSync(video.hls_dir)) return;

    const hlsDirAbs = path.resolve(video.hls_dir);
    removeSubtitleFile(hlsDirAbs, lang);
    console.log(`[HLS] #${videoId} 已删除字幕 ${lang} 文件`);
    await regenMaster(videoId);
  }).catch(e => {
    console.warn(`[HLS] 删除字幕失败 #${videoId}:`, e.message);
  });
}

// ─── 启动时恢复中断的全量 HLS 转码任务 ───
async function recoverPendingHLS() {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM videos WHERE hls_status IN ('queued', 'transcoding')"
    );
    if (rows.length === 0) return;
    console.log(`[HLS] 恢复 ${rows.length} 个未完成的 HLS 转码任务`);
    for (const row of rows) {
      await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['queued', row.id]);
      enqueueHLS(row.id);
    }
  } catch (e) {
    console.warn('[HLS] 恢复检查失败:', e.message);
  }
}

module.exports = {
  enqueueHLS,
  recoverPendingHLS,
  transcodeVideoToHLS,
  rebuildAudioTrackHLS,
  removeAudioTrackByLangHLS,
  addSubtitleHLS,
  removeSubtitleByLangHLS
};
