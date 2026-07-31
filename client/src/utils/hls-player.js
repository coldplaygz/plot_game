/**
 * HLS 播放器封装
 * - Safari/iOS：原生 video.src = m3u8
 * - 其他浏览器：hls.js
 *
 * 独立音轨模式：video.m3u8 的 ts 分片为纯视频（无内嵌音频）
 * 每条音轨独立切片，master.m3u8 通过 URI 引用
 * hls.js 切换 audioTrack 时自动清理旧 audio buffer 并加载新音轨
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

  // ═══════════════════════════════════════════════════════════════
  // hls.js 路径（独立音轨模式：切换 audioTrack 前需 flush 旧 audio buffer）
  // ═══════════════════════════════════════════════════════════════
  const hls = new Hls({
    lowLatencyMode: false,
    enableWebVTT: true,
    // 保持原生渲染：hls.js 会创建 textTrack 并触发 cuechange
    // 我们用 CSS ::cue 把原生字幕隐藏（透明），自己渲染到 DOM 控制位置和字体
    renderTextTracksNatively: true
  })

  console.log('[HLS] attachHls 开始，url=', url)
  hls.loadSource(url)
  hls.attachMedia(videoEl)

  // ─── 状态 ───
  // 缓存待应用的音轨/字幕 lang（manifest 解析前可能被调用，解析后自动应用）
  let pendingAudioLang = null
  let pendingSubLang = null

  // ─── 字幕文本回调（cuechange → 外部渲染） ───
  let cueChangeCallback = null
  let activeTextTrack = null
  let cleanupTextTrackWait = null
  const onCueChange = () => {
    if (!cueChangeCallback || !activeTextTrack) return
    const activeCues = activeTextTrack.activeCues
    if (activeCues && activeCues.length > 0) {
      const cue = activeCues[0]
      cueChangeCallback(cue.text || '')
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

  const stopWaitingTextTrack = () => {
    if (cleanupTextTrackWait) {
      cleanupTextTrackWait()
      cleanupTextTrackWait = null
    }
  }

  const findMatchingTextTrack = (lang) => {
    const tracks = videoEl.textTracks || []
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'subtitles' && tracks[i].language === lang) {
        return tracks[i]
      }
    }
    return null
  }

  const waitForTextTrack = (lang, timeout = 8000) => {
    stopWaitingTextTrack()
    return new Promise((resolve) => {
      let finished = false
      let pollTimer = null
      let timeoutTimer = null

      const finish = (track) => {
        if (finished) return
        finished = true
        stopWaitingTextTrack()
        resolve(track)
      }

      const tryBind = (source = 'poll') => {
        const track = findMatchingTextTrack(lang)
        if (track) {
          setActiveTextTrackListener(track)
          console.log('[HLS] 已监听 textTrack cuechange:', lang, 'source=', source)
          finish(track)
          return true
        }
        return false
      }

      const onTrackListChanged = () => {
        tryBind('textTracks')
      }

      const onSubtitleLoaded = () => {
        setTimeout(() => {
          tryBind('subtitle-loaded')
        }, 0)
      }

      const trackList = videoEl.textTracks
      if (trackList && typeof trackList.addEventListener === 'function') {
        trackList.addEventListener('addtrack', onTrackListChanged)
        trackList.addEventListener('change', onTrackListChanged)
      }
      hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, onSubtitleLoaded)

      pollTimer = setInterval(() => {
        tryBind('interval')
      }, 250)
      timeoutTimer = setTimeout(() => {
        console.warn('[HLS] 等待 textTrack 超时:', lang, 'subtitleTracks=', hls.subtitleTracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
        finish(null)
      }, timeout)

      cleanupTextTrackWait = () => {
        clearInterval(pollTimer)
        clearTimeout(timeoutTimer)
        if (trackList && typeof trackList.removeEventListener === 'function') {
          trackList.removeEventListener('addtrack', onTrackListChanged)
          trackList.removeEventListener('change', onTrackListChanged)
        }
        hls.off(Hls.Events.SUBTITLE_TRACK_LOADED, onSubtitleLoaded)
        cleanupTextTrackWait = null
      }

      tryBind('initial')
    })
  }

  // ─── 字幕应用 ───
  const applySubtitle = (lang) => {
    if (!hls.subtitleTracks || hls.subtitleTracks.length === 0) {
      // 字幕列表尚未就绪：仅当用户指定了具体语言时才缓存 pending
      // lang=null（关闭字幕）无需缓存，subtitleTracks 就绪后默认就是关闭状态
      if (lang) {
        console.log('[HLS] applySubtitle 缓存 pending（subtitleTracks 为空）:', lang)
        pendingSubLang = lang
      } else {
        console.log('[HLS] applySubtitle 字幕列表为空，无需关闭')
      }
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

  // 字幕切换后，更新监听的 textTrack（原生渲染下 textTrack.mode='showing'，cuechange 会触发）
  const applySubtitleWithListener = (lang) => {
    applySubtitle(lang)
    if (!lang) {
      stopWaitingTextTrack()
      if (cueChangeCallback) cueChangeCallback('')
      setActiveTextTrackListener(null)
      return Promise.resolve(null)
    }
    return waitForTextTrack(lang)
  }

  // ─── 音轨应用（独立音轨模式：视频切片纯视频无音频，hls.js 标准 audioTrack 切换即可） ───
  const applyAudio = (lang) => {
    if (!hls.audioTracks || hls.audioTracks.length === 0) {
      console.log('[HLS] applyAudio 缓存 pending（audioTracks 为空）:', lang)
      pendingAudioLang = lang
      return Promise.resolve(false)
    }
    if (!lang) return Promise.resolve(false)
    const track = hls.audioTracks.find(t => t.lang === lang)
    if (track) {
      const prevId = hls.audioTrack
      console.log('[HLS] 切换音轨:', lang, '→', track.name || track.lang || ('#' + track.id),
        '(id:', track.id, 'prev:', prevId, ')')
      if (prevId !== track.id) {
        // 独立音轨模式：video.m3u8 的 ts 分片是纯视频（无内嵌音频）
        // hls.js 切换 audioTrack 时会自动清理旧 audio buffer 并加载新音轨
        // 不需要手动 BUFFER_FLUSHING（否则会导致 Chrome autoplay 策略短暂 mute video）
        hls.audioTrack = track.id
      }
      return Promise.resolve(true)
    }
    console.warn('[HLS] 未找到音轨:', lang, '可用:', hls.audioTracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
    return Promise.resolve(false)
  }

  const setAudioTrackByLang = (lang) => applyAudio(lang)
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
      stopWaitingTextTrack()
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
    console.log('[HLS] waitForHlsReady: 原生 HLS（hls=null），直接返回 true')
    return Promise.resolve(true)
  }
  const hls = hlsController.hls
  if (hls.audioTracks && hls.audioTracks.length > 0) {
    console.log('[HLS] waitForHlsReady: audioTracks 已就绪，直接返回 true')
    return Promise.resolve(true)
  }
  console.log('[HLS] waitForHlsReady: 等待 MANIFEST_PARSED + AUDIO_TRACKS_UPDATED，超时', timeout, 'ms')

  return new Promise((resolve) => {
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      clearTimeout(timer)
      hls.off(Hls.Events.MANIFEST_PARSED, onParsed)
      hls.off(Hls.Events.AUDIO_TRACKS_UPDATED, onTracks)
      hls.off(Hls.Events.ERROR, onError)
      console.log('[HLS] waitForHlsReady: 完成 ok=', ok, 'audioTracks=', hls.audioTracks?.length || 0)
      resolve(ok)
    }
    const onParsed = () => {
      // hls.js 可能先触发 MANIFEST_PARSED（audioTracks 为空），再触发 AUDIO_TRACKS_UPDATED
      if (hls.audioTracks && hls.audioTracks.length > 0) finish(true)
    }
    const onTracks = () => {
      if (hls.audioTracks && hls.audioTracks.length > 0) finish(true)
    }
    const onError = (_evt, data) => {
      if (data && data.fatal) finish(false)
    }
    const timer = setTimeout(() => finish(false), timeout)
    hls.on(Hls.Events.MANIFEST_PARSED, onParsed)
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, onTracks)
    hls.on(Hls.Events.ERROR, onError)
  })
}
