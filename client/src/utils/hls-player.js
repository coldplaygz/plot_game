/**
 * HLS 播放器封装
 * - Safari/iOS：原生 video.src = m3u8
 * - 其他浏览器：hls.js
 *
 * 用法：
 *   const { dispose } = attachHls(videoEl, masterUrl)
 *   // 切换音轨/字幕：通过返回的 controller
 *   // 卸载：dispose()
 */
import Hls from 'hls.js'

/**
 * 挂载 HLS 到 video 元素
 * @param {HTMLVideoElement} videoEl
 * @param {string} url master.m3u8 URL
 * @returns {{ hls: Hls|null, dispose: Function, setAudioTrackByLang: Function, setSubtitleByLang: Function }}
 */
export function attachHls(videoEl, url) {
  // 优先使用 hls.js：它对多音轨/字幕的支持完整且跨浏览器一致
  // Chromium Edge 虽然 canPlayType('application/vnd.apple.mpegurl') 返回 'maybe'，
  // 但实际不解析 HLS 内嵌的 audioTracks/textTracks，会导致字幕/音轨切换失效
  // 只有 hls.js 不可用时才回退原生（Safari iOS 的 hls.js 也不可用，但 Safari 原生支持完整）
  const canNativePlay = videoEl.canPlayType('application/vnd.apple.mpegurl')
  const useHlsJs = Hls.isSupported()

  if (!useHlsJs && canNativePlay) {
    console.log('[HLS] 走原生 HLS 路径（hls.js 不可用，Safari/iOS），url=', url)
    videoEl.src = url

    // 原生 HLS：tracks 是异步加载的，需缓存 pending 并在 tracks 就绪后应用
    let nativePendingAudio = null
    let nativePendingSub = null

    const tryApplyNativeAudio = () => {
      if (nativePendingAudio === null) return
      if (!videoEl.audioTracks || videoEl.audioTracks.length === 0) return
      const lang = nativePendingAudio
      nativePendingAudio = null
      console.log('[HLS-native] audioTracks 就绪，应用 pending:', lang, '共', videoEl.audioTracks.length, '条')
      setNativeAudioTrack(videoEl, lang)
    }
    const tryApplyNativeSub = () => {
      if (nativePendingSub === null) return
      if (!videoEl.textTracks || videoEl.textTracks.length === 0) return
      const lang = nativePendingSub
      nativePendingSub = null
      console.log('[HLS-native] textTracks 就绪，应用 pending:', lang, '共', videoEl.textTracks.length, '条')
      setNativeSubtitle(videoEl, lang)
    }

    const onAudioChanged = () => tryApplyNativeAudio()
    const onTextChanged = () => tryApplyNativeSub()
    const onLoadedMetadata = () => {
      tryApplyNativeAudio()
      tryApplyNativeSub()
    }
    videoEl.addEventListener('audiotrackschanged', onAudioChanged)
    videoEl.addEventListener('texttrackschanged', onTextChanged)
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata)

    return {
      hls: null,
      dispose: () => {
        videoEl.removeEventListener('audiotrackschanged', onAudioChanged)
        videoEl.removeEventListener('texttrackschanged', onTextChanged)
        videoEl.removeEventListener('loadedmetadata', onLoadedMetadata)
        if (videoEl.src === url) videoEl.removeAttribute('src')
        videoEl.load()
      },
      setAudioTrackByLang: (lang) => {
        nativePendingAudio = lang
        tryApplyNativeAudio()
      },
      setSubtitleByLang: (lang) => {
        nativePendingSub = lang
        tryApplyNativeSub()
      },
      onCueChange: (cb) => {
        // 原生 HLS 也监听 cuechange（Safari 原生渲染字幕，但可覆盖为自定义渲染）
        // 简化：原生路径保留原生渲染，不提供 cuechange
        // 如需自定义渲染，可在 Safari 上也关闭原生渲染（复杂度较高，暂不实现）
      }
    }
  }

  if (!useHlsJs && !canNativePlay) {
    console.error('[HLS] 当前浏览器不支持 HLS 播放')
    return {
      hls: null,
      dispose: () => {},
      setAudioTrackByLang: () => {},
      setSubtitleByLang: () => {},
      onCueChange: () => {}
    }
  }

  // 其他浏览器用 hls.js
  const hls = new Hls({
    // 启用低延迟模式（可选）
    lowLatencyMode: false,
    // 允许跨域字幕加载
    enableWebVTT: true,
    // 保持原生渲染：hls.js 会创建 textTrack 并触发 cuechange
    // 我们用 CSS ::cue 把原生字幕隐藏（透明），自己渲染到 DOM 控制位置和字体
    renderTextTracksNatively: true
  })

  console.log('[HLS] attachHls 开始，url=', url)
  hls.loadSource(url)
  hls.attachMedia(videoEl)

  // 缓存待应用的音轨/字幕 lang（manifest 解析前可能被调用，解析后自动应用）
  let pendingAudioLang = null
  let pendingSubLang = null

  const applyAudio = (lang) => {
    if (!hls.audioTracks || hls.audioTracks.length === 0) {
      console.log('[HLS] applyAudio 缓存 pending（audioTracks 为空）:', lang)
      pendingAudioLang = lang
      return
    }
    if (!lang) return
    const track = hls.audioTracks.find(t => t.lang === lang)
    if (track) {
      hls.audioTrack = track.id
      console.log('[HLS] 切换音轨:', lang, '→', track.name || track.lang || ('#' + track.id))
    } else {
      console.warn('[HLS] 未找到音轨:', lang, '可用:', hls.audioTracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
    }
  }

  const applySubtitle = (lang) => {
    if (!hls.subtitleTracks || hls.subtitleTracks.length === 0) {
      console.log('[HLS] applySubtitle 缓存 pending（subtitleTracks 为空）:', lang)
      pendingSubLang = lang
      return
    }
    if (!lang) {
      hls.subtitleTrack = -1
      console.log('[HLS] 关闭字幕')
      return
    }
    const track = hls.subtitleTracks.find(t => t.lang === lang)
    if (track) {
      hls.subtitleTrack = track.id
      console.log('[HLS] 切换字幕:', lang, '→', track.name || track.lang || ('#' + track.id))
    } else {
      console.warn('[HLS] 未找到字幕:', lang, '可用:', hls.subtitleTracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
      hls.subtitleTrack = -1
    }
  }

  const setAudioTrackByLang = (lang) => applyAudio(lang)

  // ─── 字幕文本回调（关闭原生渲染后，自己监听 cuechange 通知外部渲染） ───
  let cueChangeCallback = null
  let activeTextTrack = null
  const onCueChange = () => {
    if (!cueChangeCallback || !activeTextTrack) return
    const activeCues = activeTextTrack.activeCues
    if (activeCues && activeCues.length > 0) {
      const cue = activeCues[0]
      const text = cue.text || ''
      cueChangeCallback(text)
    } else {
      cueChangeCallback('')
    }
  }

  const setActiveTextTrackListener = (track) => {
    if (activeTextTrack) {
      activeTextTrack.removeEventListener('cuechange', onCueChange)
    }
    activeTextTrack = track
    if (track) {
      track.addEventListener('cuechange', onCueChange)
    }
  }

  // 字幕切换后，更新监听的 textTrack（原生渲染下 textTrack.mode='showing'，cuechange 会触发）
  const applySubtitleWithListener = (lang) => {
    applySubtitle(lang)
    if (!lang) {
      if (cueChangeCallback) cueChangeCallback('')
      setActiveTextTrackListener(null)
      return
    }
    // 原生渲染模式下，textTrack 可能还没创建（manifest 解析后异步创建）
    // 先尝试找，找不到就用轮询等 textTrack 就绪
    const tryFindAndListen = (attemptsLeft = 10) => {
      const tracks = videoEl.textTracks || []
      console.log('[HLS] 尝试找 textTrack lang=', lang, 'tracks.length=', tracks.length,
        'tracks=', Array.from(tracks).map(t => ({ kind: t.kind, lang: t.language, mode: t.mode })))
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === 'subtitles' && tracks[i].language === lang) {
          setActiveTextTrackListener(tracks[i])
          console.log('[HLS] 已监听 textTrack cuechange:', lang)
          return true
        }
      }
      if (attemptsLeft > 0) {
        setTimeout(() => tryFindAndListen(attemptsLeft - 1), 200)
      } else {
        console.warn('[HLS] 轮询 10 次仍未找到 textTrack lang=', lang)
      }
      return false
    }
    tryFindAndListen()
  }

  const setSubtitleByLang = (lang) => applySubtitleWithListener(lang)

  // manifest 解析后：打印可用 tracks + 应用待应用的音轨/字幕
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    console.log('[HLS] manifest parsed',
      '\n  audioTracks:', hls.audioTracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })),
      '\n  subtitleTracks:', hls.subtitleTracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
    if (pendingAudioLang !== null) {
      applyAudio(pendingAudioLang)
      pendingAudioLang = null
    }
    if (pendingSubLang !== null) {
      applySubtitleWithListener(pendingSubLang)
      pendingSubLang = null
    }
  })

  // 字幕/音轨列表更新时（部分场景 manifest 解析后异步刷新）：应用 pending
  hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
    if (hls.subtitleTracks && hls.subtitleTracks.length > 0 && pendingSubLang !== null) {
      console.log('[HLS] SUBTITLE_TRACKS_UPDATED，应用 pending 字幕:', pendingSubLang)
      applySubtitleWithListener(pendingSubLang)
      pendingSubLang = null
    }
  })
  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
    if (hls.audioTracks && hls.audioTracks.length > 0 && pendingAudioLang !== null) {
      console.log('[HLS] AUDIO_TRACKS_UPDATED，应用 pending 音轨:', pendingAudioLang)
      applyAudio(pendingAudioLang)
      pendingAudioLang = null
    }
  })

  // 错误日志（便于诊断）
  hls.on(Hls.Events.ERROR, (_evt, data) => {
    const level = data && data.fatal ? 'error' : 'warn'
    console[level]('[HLS] error:', data && data.type, data && data.details, data)
  })

  return {
    hls,
    dispose: () => {
      setActiveTextTrackListener(null)
      try { hls.destroy() } catch (e) { /* ignore */ }
    },
    setAudioTrackByLang,
    setSubtitleByLang,
    onCueChange: (cb) => { cueChangeCallback = cb }
  }
}

// ─── 原生 HLS（Safari）音轨/字幕切换 ───
function setNativeAudioTrack(videoEl, lang) {
  console.log('[HLS-native] setNativeAudioTrack lang=', lang, 'audioTracks=', videoEl.audioTracks ? videoEl.audioTracks.length : 0)
  if (!videoEl.audioTracks || !lang) return
  for (let i = 0; i < videoEl.audioTracks.length; i++) {
    const t = videoEl.audioTracks[i]
    t.enabled = (t.language === lang)
  }
}

function setNativeSubtitle(videoEl, lang) {
  console.log('[HLS-native] setNativeSubtitle lang=', lang, 'textTracks=', videoEl.textTracks ? videoEl.textTracks.length : 0)
  if (!videoEl.textTracks) return
  for (let i = 0; i < videoEl.textTracks.length; i++) {
    const t = videoEl.textTracks[i]
    console.log('[HLS-native] textTrack[' + i + ']', { kind: t.kind, language: t.language, mode: t.mode })
    if (t.kind === 'subtitles') {
      t.mode = (t.language === lang) ? 'showing' : 'disabled'
    }
  }
}

/**
 * 等待 hls.js manifest 解析完成（音轨/字幕列表就绪）
 * @param {object} hlsController attachHls 返回的对象
 * @param {number} timeout 超时 ms
 * @returns {Promise<boolean>}
 */
export function waitForHlsReady(hlsController, timeout = 8000) {
  if (!hlsController || !hlsController.hls) {
    // 原生 HLS，等待 video canplay
    console.log('[HLS] waitForHlsReady: 原生 HLS（hls=null），直接返回 true')
    return Promise.resolve(true)
  }
  const hls = hlsController.hls
  if (hls.audioTracks && hls.audioTracks.length > 0) {
    console.log('[HLS] waitForHlsReady: audioTracks 已就绪，直接返回 true')
    return Promise.resolve(true)
  }
  console.log('[HLS] waitForHlsReady: 等待 MANIFEST_PARSED，超时', timeout, 'ms')

  return new Promise((resolve) => {
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      clearTimeout(timer)
      hls.off(Hls.Events.MANIFEST_PARSED, onParsed)
      hls.off(Hls.Events.ERROR, onError)
      console.log('[HLS] waitForHlsReady: 完成 ok=', ok)
      resolve(ok)
    }
    const onParsed = () => finish(true)
    const onError = (_evt, data) => {
      if (data && data.fatal) finish(false)
    }
    const timer = setTimeout(() => finish(false), timeout)
    hls.on(Hls.Events.MANIFEST_PARSED, onParsed)
    hls.on(Hls.Events.ERROR, onError)
  })
}
