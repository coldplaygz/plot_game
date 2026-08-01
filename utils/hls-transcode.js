/**
 * HLS 多音轨转码模块（单码率 + 增量重建）
 *
 * 独立音轨模式：视频切片不含音频，每条音轨独立切片为 audio_{lang}.m3u8，
 * master.m3u8 中 EXT-X-MEDIA:TYPE=AUDIO 通过 URI 引用独立音轨播放列表。
 * hls.js 切换音轨时会发起独立网络请求下载对应音轨分片。
 *
 * 产物结构：
 *   uploads/videos/{videoId}_hls/
 *   ├── master.m3u8          # 主播放列表（EXT-X-MEDIA 引用独立音轨/字幕）
 *   ├── video.m3u8           # 视频播放列表（有外挂音轨时纯视频，无外挂时含原音）
 *   ├── seg_v_000.ts ...     # 视频分片
 *   ├── audio_{lang}.m3u8    # 每条音轨独立子播放列表
 *   ├── seg_a_{lang}_*.ts    # 音轨分片
 *   ├── sub_{lang}.m3u8      # 字幕子播放列表（引用 sub_{lang}.vtt）
 *   └── sub_{lang}.vtt       # 字幕文件
 *
 * 重建策略：
 *   - 全量重建：视频上传/手动重建 → 重切视频(纯视频)+所有音轨+字幕
 *   - 增量-音轨：上传/替换音轨 → 只切该条音轨 + regenMaster（无需重切视频）
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

// ─── 探测视频编码 + 时长 ───
function probeVideoCodec(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err || !meta || !meta.streams) { resolve({ codec: null, bandwidth: 1500000, duration: 0 }); return; }
      const v = meta.streams.find(s => s.codec_type === 'video');
      const bandwidth = v && v.bit_rate ? parseInt(v.bit_rate) : 1500000;
      const duration = meta.format && meta.format.duration ? parseFloat(meta.format.duration) : 0;
      resolve({ codec: v ? v.codec_name : null, bandwidth, duration });
    });
  });
}

// ─── HLS 目录路径辅助 ───
function getHlsDir(videoId) {
  return path.join('uploads', 'videos', `${videoId}_hls`);
}

// ─── 读取 m3u8 的总时长（#EXTINF 累加）───
function readM3u8Duration(m3u8Path) {
  try {
    if (!fs.existsSync(m3u8Path)) return 0;
    const content = fs.readFileSync(m3u8Path, 'utf8');
    const matches = content.match(/#EXTINF:([\d.]+)/g);
    if (!matches || matches.length === 0) return 0;
    return matches.reduce((sum, s) => sum + parseFloat(s.match(/[\d.]+/)[0]), 0);
  } catch (e) {
    return 0;
  }
}

// ─── 全量 HLS 转码（视频上传/手动重建） ───
// 方案B：把所有音轨 mux 进 video.m3u8 的每个 ts 分片，不再独立切片音轨
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

  // ── 1. 视频切片（独立音轨模式：有外挂音轨时视频切片不含音频，每条音轨独立切片） ──
  const { codec, bandwidth, duration } = await probeVideoCodec(video.file_path);
  const hasAltAudio = audios.length > 0;
  const videoCodecOpt = codec === 'h264' ? '-c:v copy' : '-c:v libx264 -profile:v main -pix_fmt yuv420p -preset fast -crf 23';
  console.log(`[HLS] #${videoId} 视频编码=${codec || 'unknown'}, 时长=${duration.toFixed(2)}s, 外挂音轨=${hasAltAudio ? audios.length + '条(独立切片)' : '无(保留原音)'}`);

  await pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['transcoding', videoId]);

  // 过滤出文件存在的有效外挂音轨
  const validAudios = [];
  for (const audio of audios) {
    if (!fs.existsSync(audio.file_path)) {
      console.warn(`[HLS] #${videoId} 音轨文件不存在，跳过: #${audio.id} ${audio.file_path}`);
      await pool.query('UPDATE video_audios SET hls_status=? WHERE id=?', ['failed', audio.id]);
      continue;
    }
    validAudios.push(audio);
  }

  const useIndependentAudio = hasAltAudio && validAudios.length > 0;

  // 视频切片：有外挂音轨则纯视频(-an)，无外挂音轨则保留原音
  const videoOutputOpts = [
    '-map', '0:v',
    // 独立音轨模式：-an 禁用音频（不指定 -c:a，否则 ffmpeg 报 aac: Invalid argument）
    // 含原音模式：-map 0:a? 映射音频 + aac 编码
    ...(useIndependentAudio ? ['-an'] : ['-map', '0:a?', '-c:a', 'aac', '-b:a', '128k']),
    videoCodecOpt,
    '-hls_time', '6',
    '-hls_list_size', '0',
    '-hls_segment_filename', path.join(hlsDirAbs, 'seg_v_%03d.ts')
  ];
  // 截断到视频时长，防止音轨比视频长导致 video.ended 不触发
  if (duration && duration > 0) {
    videoOutputOpts.push('-t', String(duration));
  }

  await new Promise((resolve, reject) => {
    ffmpeg(video.file_path)
      .outputOptions(videoOutputOpts)
      .output(path.join(hlsDirAbs, 'video.m3u8'))
      .on('start', cmdStr => console.log(`[HLS] #${videoId} 视频切片启动 (${useIndependentAudio ? '纯视频' : '含原音'})`))
      .on('end', () => {
        console.log(`[HLS] #${videoId} 视频切片完成`);
        resolve();
      })
      .on('error', (err) => reject(new Error('视频分片失败: ' + err.message)))
      .run();
  });

  // ── 2. 独立切片每条音轨（独立音轨模式核心） ──
  if (useIndependentAudio) {
    console.log(`[HLS] #${videoId} 开始独立切片 ${validAudios.length} 条音轨`);
    for (const audio of validAudios) {
      await sliceAudioTrack(videoId, audio, hlsDirAbs, hlsDir, duration);
    }
  }

  // ── 3. 字幕：复制 .vtt 到 hls 目录（字幕保持独立，不 mux 进视频分片） ──
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
// videoDuration: 视频时长（秒），用于截断音频，防止音轨比视频长导致 video.ended 不触发
async function sliceAudioTrack(videoId, audio, hlsDirAbs, hlsDir, videoDuration) {
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
    const outputOpts = [
      '-vn',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', path.join(hlsDirAbs, segPattern)
    ];
    // 截断音频到视频时长，防止音轨比视频长导致 video.ended 不触发
    // -t 作为输入选项（inputOptions），确保在 hls 分片前截断
    const inputOpts = [];
    if (videoDuration && videoDuration > 0) {
      inputOpts.push('-t', String(videoDuration));
      console.log(`[HLS] #${videoId} 音轨 ${lang} 截断到 ${videoDuration.toFixed(2)}s`);
    }
    await new Promise((resolve, reject) => {
      ffmpeg(audio.file_path)
        .inputOptions(inputOpts)
        .outputOptions(outputOpts)
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
  // 清理可能残留的旧 master_*.m3u8 文件（旧命名格式，独立音轨模式下不再产生）
  const staleMasters = fs.existsSync(hlsDirAbs)
    ? fs.readdirSync(hlsDirAbs).filter(name => /^master_.+\.m3u8$/.test(name))
    : [];
  staleMasters.forEach((name) => {
    try { fs.unlinkSync(path.join(hlsDirAbs, name)); } catch (e) { /* ignore */ }
  });
  // 注意：独立音轨模式下 audio_*.m3u8 和 seg_a_*.ts 是合法的音轨分片文件，不能清理
  // 仅需清理 DB 中标记为 failed 但文件残留的音轨（由 sliceAudioTrack 内部 removeAudioFiles 处理）
  fs.writeFileSync(path.join(hlsDirAbs, 'master.m3u8'), masterContent, 'utf8');
  console.log(`[HLS] #${videoId} master.m3u8 已重新生成`);
}

// ─── 生成 master.m3u8 内容 ───
// 独立音轨模式：每条音轨指向独立的 audio_{lang}.m3u8，hls.js 切换时会发起独立请求
function buildMasterPlaylist(audios, subs, bandwidth) {
  const bw = Math.max(parseInt(bandwidth) || 1500000, 500000);
  const lines = ['#EXTM3U', '#EXT-X-VERSION:6'];

  const okAudios = audios.filter(a => a.hls_status === 'done');
  const okSubs = subs.filter(s => s.hls_status === 'done');

  // 音轨：独立切片模式，每条音轨指向自己的 audio_{lang}.m3u8
  const audioGroupId = 'audio-group';
  okAudios.forEach((a, i) => {
    const isDefault = (i === 0 || a.is_default) ? 'YES' : 'NO';
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
// 独立音轨模式：只切该条音轨 + regenMaster，无需重新切视频
function rebuildAudioTrackHLS(videoId, audioId) {
  withVideoLock(videoId, async () => {
    console.log(`[HLS] #${videoId} 增量重建音轨(audioId=${audioId})`);
    const [vRows] = await pool.query('SELECT hls_dir, duration FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];
    // HLS 目录不存在或未全量转码 → 降级全量
    if (!video.hls_dir || !fs.existsSync(video.hls_dir) || !fs.existsSync(path.join(video.hls_dir, 'video.m3u8'))) {
      console.log(`[HLS] #${videoId} HLS 目录不存在，降级全量重建`);
      await transcodeVideoToHLS(videoId);
      return;
    }
    const [aRows] = await pool.query('SELECT * FROM video_audios WHERE id = ?', [audioId]);
    if (aRows.length === 0) return;
    const hlsDirAbs = path.resolve(video.hls_dir);
    // 读取视频时长用于截断音轨（用 video.m3u8 实际时长，DB duration 字段可能不准）
    const videoDuration = readM3u8Duration(path.join(video.hls_dir, 'video.m3u8')) || video.duration || 0;
    await sliceAudioTrack(videoId, aRows[0], hlsDirAbs, video.hls_dir, videoDuration);
    await regenMaster(videoId);
    console.log(`[HLS] #${videoId} 增量音轨完成: ${aRows[0].language}`);
  }).catch(e => {
    console.warn(`[HLS] 增量音轨失败 #${videoId}:`, e.message);
    pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['failed', videoId]).catch(() => {});
  });
}

// 增量：删除音轨（删除音轨后调用）
// 独立音轨模式：删该条音轨分片文件 + regenMaster，无需重新切视频
function removeAudioTrackHLS(videoId, audioId) {
  withVideoLock(videoId, async () => {
    console.log(`[HLS] #${videoId} 增量删除音轨(audioId=${audioId})`);
    const [vRows] = await pool.query('SELECT hls_dir FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];
    if (!video.hls_dir || !fs.existsSync(video.hls_dir)) {
      console.log(`[HLS] #${videoId} HLS 目录不存在，跳过`);
      return;
    }
    // 查出该音轨的 language，用于定位分片文件
    const [aRows] = await pool.query('SELECT language FROM video_audios WHERE id = ?', [audioId]);
    if (aRows.length > 0) {
      const lang = aRows[0].language || ('audio' + audioId);
      removeAudioFiles(path.resolve(video.hls_dir), lang);
      console.log(`[HLS] #${videoId} 已删除音轨 ${lang} 分片文件`);
    }
    await regenMaster(videoId);
  }).catch(e => {
    console.warn(`[HLS] 删除音轨失败 #${videoId}:`, e.message);
    pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['failed', videoId]).catch(() => {});
  });
}

// 增量：删除音轨（带 lang 参数）
function removeAudioTrackByLangHLS(videoId, lang) {
  withVideoLock(videoId, async () => {
    console.log(`[HLS] #${videoId} 增量删除音轨(lang=${lang})`);
    const [vRows] = await pool.query('SELECT hls_dir FROM videos WHERE id = ?', [videoId]);
    if (vRows.length === 0) return;
    const video = vRows[0];
    if (!video.hls_dir || !fs.existsSync(video.hls_dir)) {
      console.log(`[HLS] #${videoId} HLS 目录不存在，跳过`);
      return;
    }
    removeAudioFiles(path.resolve(video.hls_dir), lang);
    console.log(`[HLS] #${videoId} 已删除音轨 ${lang} 分片文件`);
    await regenMaster(videoId);
  }).catch(e => {
    console.warn(`[HLS] 删除音轨失败 #${videoId}:`, e.message);
    pool.query('UPDATE videos SET hls_status=? WHERE id=?', ['failed', videoId]).catch(() => {});
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
  regenMaster,
  rebuildAudioTrackHLS,
  removeAudioTrackByLangHLS,
  addSubtitleHLS,
  removeSubtitleByLangHLS
};
