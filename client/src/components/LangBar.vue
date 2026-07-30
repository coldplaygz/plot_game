<template>
  <div class="relative">
    <!-- 触发按钮：字幕开启时显示小圆点 -->
    <button @click="open = !open"
      class="relative w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors shrink-0"
      :class="subOn ? 'bg-brand-purple/50 text-white' : 'bg-white/15 text-white/70 hover:bg-white/30 active:bg-white/40'">
      <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>
      <span v-if="subOn" class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-pink"></span>
    </button>

    <!-- 点击外部关闭 -->
    <div v-if="open" class="fixed inset-0 z-40" @click="open = false"></div>

    <!-- 弹出面板 -->
    <div v-if="open" class="absolute bottom-full left-0 mb-2 w-56 bg-surface-card border border-border-dim rounded-xl p-3 z-50 shadow-xl">
      <div class="text-[11px] text-text-dimmer mb-1.5">🎤 音轨</div>
      <div class="flex flex-col gap-1 mb-3">
        <button @click="selectAudio(-1)"
          class="w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
          :class="audioIdx === -1 ? 'bg-brand-purple/20 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">默认音轨</button>
        <button v-for="(a, i) in audios" :key="'a'+i" @click="selectAudio(i)"
          class="w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
          :class="audioIdx === i ? 'bg-brand-purple/20 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">{{ a.label }}</button>
      </div>

      <div class="text-[11px] text-text-dimmer mb-1.5">📝 字幕</div>
      <div class="flex flex-col gap-1">
        <button @click="selectSub(-1)"
          class="w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
          :class="!subOn ? 'bg-brand-purple/20 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">关闭字幕</button>
        <button v-for="(s, i) in subtitles" :key="'s'+i" @click="selectSub(i)"
          class="w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
          :class="subOn && subIdx === i ? 'bg-brand-purple/20 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">{{ s.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useLangStore } from '../stores/lang'

const props = defineProps({
  audios: { type: Array, default: () => [] },
  subtitles: { type: Array, default: () => [] },
  videoEl: { type: Object, default: null },
  currentAudioEl: { type: Object, default: null },
  isTouchDevice: { type: Boolean, default: false },
  hlsController: { type: Object, default: null },
  hlsMode: { type: Boolean, default: false }
})

const emit = defineEmits(['update:audioEl', 'update:subSrc'])
const langStore = useLangStore()

const audioIdx = ref(-1)
const subIdx = ref(-1)
const subOn = ref(false)
const open = ref(false)

const activeSubSrc = computed(() => {
  // HLS 模式下字幕内嵌流中，不外挂
  if (props.hlsMode) return ''
  if (!subOn.value || !props.subtitles?.length) return ''
  const idx = subIdx.value
  if (idx < 0 || idx >= props.subtitles.length) return ''
  return '/' + (props.subtitles[idx].file_path || '').replace(/\\\\/g, '/')
})

let altAudio = null

// Web Audio API 上下文（移动端外挂音轨，不与 video 抢占播放权）
let audioCtx = null
let audioSource = null
let audioBuffer = null
let audioReadyPromise = Promise.resolve(false)
let resolveAudioReady = null

function resetAudioReady() {
  if (resolveAudioReady) resolveAudioReady(false)
  audioReadyPromise = new Promise((resolve) => {
    resolveAudioReady = resolve
  })
}

function finishAudioReady(ok = true) {
  if (!resolveAudioReady) return
  resolveAudioReady(ok)
  resolveAudioReady = null
}

function findIdxByLang(list) {
  if (!list || !list.length) return -1
  const idx = list.findIndex(item => item.language === langStore.current)
  if (idx >= 0) return idx
  const defIdx = list.findIndex(item => item.is_default)
  return defIdx >= 0 ? defIdx : 0
}

function stopAltAudio() {
  if (altAudio) { altAudio.pause(); altAudio.remove(); altAudio = null; }
  if (audioSource) { try { audioSource.stop() } catch(e) {} audioSource = null }
  if (audioCtx) { audioCtx.close(); audioCtx = null; audioBuffer = null }
  finishAudioReady(false)
  emit('update:audioEl', null)
  if (props.videoEl) {
    props.videoEl.onplay = null
    props.videoEl.onpause = null
    props.videoEl.onseeked = null
  }
}

function applyAudio(audio) {
  stopAltAudio()
  if (!audio || !props.videoEl) return
  resetAudioReady()
  const shouldResumeVideo = !props.videoEl.paused

  // 移动端：Web Audio API（不与 video 抢占播放权）
  if (props.isTouchDevice) {
    if (shouldResumeVideo) props.videoEl.pause()
    applyAudioMobile(audio, shouldResumeVideo)
    return
  }

  // 桌面端：独立 <audio> 元素
  const a = document.createElement('audio')
  a.preload = 'auto'
  a.src = '/' + (audio.file_path || '').replace(/\\\\/g, '/')
  a.load()

  // 先静音视频 + 恢复音量，确保外挂失败时能正确回退默认音轨
  props.videoEl.muted = true
  props.videoEl.volume = 1
  emit('update:audioEl', a)

  const syncAudio = () => { a.currentTime = props.videoEl.currentTime }

  const startAltAudio = () => {
    props.videoEl.muted = true
    props.videoEl.volume = 1

    const playAudio = () => {
      syncAudio()
      a.play().catch(() => { props.videoEl.muted = false })
    }

    // 音频已缓存（后续场景）→ 直接播放；未缓存（首个场景）→ 等 canplay
    if (a.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      finishAudioReady(true)
      playAudio()
    } else {
      let fallbackTimer
      const onReady = () => {
        clearTimeout(fallbackTimer)
        finishAudioReady(true)
        playAudio()
      }
      const onError = () => {
        clearTimeout(fallbackTimer)
        finishAudioReady(false)
        props.videoEl.muted = false
      }
      fallbackTimer = setTimeout(() => {
        a.removeEventListener('canplay', onReady)
        a.removeEventListener('error', onError)
        finishAudioReady(false)
        props.videoEl.muted = false  // 超时回退默认音轨
      }, 5000)
      a.addEventListener('canplay', onReady, { once: true })
      a.addEventListener('error', onError, { once: true })
    }
  }

  props.videoEl.onplay = startAltAudio
  props.videoEl.onpause = () => a.pause()
  props.videoEl.onseeked = syncAudio

  if (a.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    finishAudioReady(true)
  } else {
    const onPreloadReady = () => finishAudioReady(true)
    const onPreloadError = () => finishAudioReady(false)
    a.addEventListener('canplay', onPreloadReady, { once: true })
    a.addEventListener('error', onPreloadError, { once: true })
  }

  if (shouldResumeVideo) {
    props.videoEl.pause()
    waitForCurrentAudioReady().then((ready) => {
      if (ready && props.videoEl?.paused) {
        props.videoEl.play().catch(() => {})
      }
    })
  }

  if (!props.videoEl.paused) startAltAudio()
  altAudio = a
}

async function applyAudioMobile(audio, shouldResumeVideo = false) {
  // ★ 先同步 emit，确保 playScene 能立即 mute 视频
  emit('update:audioEl', { _webAudio: true })

  // 先静音视频，外挂加载失败时回退默认音轨
  props.videoEl.muted = true
  props.videoEl.volume = 1

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const url = '/' + (audio.file_path || '').replace(/\\/g, '/')
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    const buf = await resp.arrayBuffer()
    audioBuffer = await audioCtx.decodeAudioData(buf)
    finishAudioReady(true)

    const playFrom = (offset) => {
      if (audioSource) { try { audioSource.stop() } catch(e) {} }
      if (!audioCtx || !audioBuffer || !props.videoEl) return
      audioSource = audioCtx.createBufferSource()
      audioSource.buffer = audioBuffer
      audioSource.connect(audioCtx.destination)
      audioSource.start(0, Math.max(0, offset))
    }

    props.videoEl.onplay = () => {
      props.videoEl.muted = true
      props.videoEl.volume = 1
      if (audioCtx?.state === 'suspended') audioCtx.resume()
      playFrom(props.videoEl.currentTime)
    }
    props.videoEl.onpause = () => {
      if (audioSource) { try { audioSource.stop() } catch(e) {} audioSource = null }
    }
    props.videoEl.onseeked = () => playFrom(props.videoEl.currentTime)

    if (!props.videoEl.paused) {
      if (audioCtx.state === 'suspended') await audioCtx.resume()
      playFrom(props.videoEl.currentTime)
    }

    if (shouldResumeVideo && props.videoEl?.paused && props.videoEl.currentSrc) {
      props.videoEl.play().catch(() => {})
    }
  } catch (e) {
    console.warn('[LangBar] 外挂音轨加载失败:', e.message)
    // 回退默认音轨
    finishAudioReady(false)
    props.videoEl.muted = false
  }
}

async function waitForCurrentAudioReady(timeout = 5000) {
  // HLS 模式：音轨在流中，无需等待外挂音轨就绪
  if (props.hlsMode) return true
  const hasSelectedAudio = audioIdx.value >= 0 && audioIdx.value < props.audios.length
  if (!hasSelectedAudio) return false

  if (props.isTouchDevice) {
    if (audioBuffer) return true
  } else if (altAudio && altAudio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return true
  }

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(false), timeout)
  })

  return Promise.race([audioReadyPromise, timeoutPromise])
}

function switchAudio() {
  // HLS 模式：音轨在流中，用 hls.js 切换
  if (props.hlsMode && props.hlsController) {
    if (audioIdx.value >= 0 && audioIdx.value < props.audios.length) {
      const a = props.audios[audioIdx.value]
      props.hlsController.setAudioTrackByLang(a.language)
      localStorage.setItem('plot_game_audio_label', a.label)
    } else {
      // 默认音轨：切到 is_default 的那条
      const def = props.audios.find(a => a.is_default) || props.audios[0]
      if (def) props.hlsController.setAudioTrackByLang(def.language)
      localStorage.removeItem('plot_game_audio_label')
    }
    return
  }
  // 旧外挂音轨模式
  if (audioIdx.value >= 0 && audioIdx.value < props.audios.length) {
    applyAudio(props.audios[audioIdx.value])
    localStorage.setItem('plot_game_audio_label', props.audios[audioIdx.value].label)
  } else {
    stopAltAudio()
    if (props.videoEl) props.videoEl.muted = false
    localStorage.removeItem('plot_game_audio_label')
  }
}

function selectAudio(i) {
  audioIdx.value = i
  switchAudio()
}

function selectSub(i) {
  // HLS 模式：字幕在流中，用 hls.js 切换
  if (props.hlsMode && props.hlsController) {
    if (i < 0) {
      subOn.value = false
      props.hlsController.setSubtitleByLang(null)
      localStorage.removeItem('plot_game_sub_label')
    } else {
      subIdx.value = i
      subOn.value = true
      const s = props.subtitles[i]
      if (s) {
        props.hlsController.setSubtitleByLang(s.language)
        localStorage.setItem('plot_game_sub_label', s.label)
      }
    }
    return
  }
  // 旧外挂字幕模式
  if (i < 0) {
    subOn.value = false
    localStorage.removeItem('plot_game_sub_label')
  } else {
    subIdx.value = i
    subOn.value = true
    if (props.subtitles[i]) localStorage.setItem('plot_game_sub_label', props.subtitles[i].label)
  }
}

// Init audio — 优先恢复上次保存，其次按语言匹配，场景切换保留用户选择
watch(() => props.audios, (val, oldVal) => {
  if (val && val.length > 0) {
    if (oldVal && audioIdx.value >= 0 && audioIdx.value < oldVal.length) {
      // 场景切换：保留相同 label 的选择
      const prevLabel = oldVal[audioIdx.value]?.label
      const keepIdx = val.findIndex(a => a.label === prevLabel)
      if (keepIdx >= 0) audioIdx.value = keepIdx
      else audioIdx.value = findIdxByLang(val)
    } else {
      // 首次加载：优先 localStorage，其次按语言匹配
      const saved = localStorage.getItem('plot_game_audio_label')
      if (saved) {
        const idx = val.findIndex(a => a.label === saved)
        audioIdx.value = idx >= 0 ? idx : findIdxByLang(val)
      } else {
        audioIdx.value = findIdxByLang(val)
      }
    }
    if (props.hlsMode) {
      // HLS 模式：音轨在流中，只设置 hls.js 音轨，不启动外挂
      // 清理可能残留的外挂音轨（从非 HLS 模式切换过来）
      stopAltAudio()
      switchAudio()
      if (audioIdx.value >= 0 && audioIdx.value < val.length) {
        localStorage.setItem('plot_game_audio_label', val[audioIdx.value].label)
      }
    } else {
      applyAudio(val[audioIdx.value])
      if (audioIdx.value >= 0 && audioIdx.value < val.length) {
        localStorage.setItem('plot_game_audio_label', val[audioIdx.value].label)
      }
    }
  } else {
    audioIdx.value = -1
    if (!props.hlsMode) {
      stopAltAudio()
      if (props.videoEl) props.videoEl.muted = false
    }
  }
}, { immediate: true })

// Init subtitles — 优先恢复上次保存，其次按语言匹配，场景切换保留用户选择
watch(() => props.subtitles, (val, oldVal) => {
  if (val && val.length > 0) {
    if (oldVal && subIdx.value >= 0 && subIdx.value < oldVal.length) {
      const prevLabel = oldVal[subIdx.value]?.label
      const keepIdx = val.findIndex(s => s.label === prevLabel)
      if (keepIdx >= 0) subIdx.value = keepIdx
      else subIdx.value = findIdxByLang(val)
    } else {
      const saved = localStorage.getItem('plot_game_sub_label')
      if (saved) {
        const idx = val.findIndex(s => s.label === saved)
        subIdx.value = idx >= 0 ? idx : findIdxByLang(val)
      } else {
        subIdx.value = findIdxByLang(val)
      }
    }
    subOn.value = true
    // HLS 模式：主动应用字幕到 hls.js
    if (props.hlsMode && props.hlsController && subIdx.value >= 0) {
      props.hlsController.setSubtitleByLang(val[subIdx.value].language)
    }
  } else {
    subIdx.value = -1
    subOn.value = false
    if (props.hlsMode && props.hlsController) {
      props.hlsController.setSubtitleByLang(null)
    }
  }
}, { immediate: true })

// 语言切换时自动匹配音轨和字幕
watch(() => langStore.current, () => {
  if (props.audios.length > 0) {
    audioIdx.value = findIdxByLang(props.audios)
    switchAudio()
  }
  if (props.subtitles.length > 0) {
    subIdx.value = findIdxByLang(props.subtitles)
  }
})

// 字幕 URL 变化时通知父组件
watch(activeSubSrc, (val) => {
  emit('update:subSrc', val)
}, { immediate: true })

onBeforeUnmount(() => {
  stopAltAudio()
})

defineExpose({
  waitForCurrentAudioReady,
  // 供父组件在 HLS manifest 就绪后重新应用音轨/字幕（解决 watch subtitles 先于 hlsController 赋值触发的时序问题）
  reapply
})

function reapply() {
  console.log('[LangBar] reapply 调用', {
    hlsMode: props.hlsMode,
    hasController: !!props.hlsController,
    audioIdx: audioIdx.value,
    subOn: subOn.value,
    subIdx: subIdx.value,
    audiosLen: props.audios.length,
    subtitlesLen: props.subtitles.length
  })
  if (!props.hlsMode || !props.hlsController) return
  // 重新应用音轨
  if (audioIdx.value >= 0 && audioIdx.value < props.audios.length) {
    props.hlsController.setAudioTrackByLang(props.audios[audioIdx.value].language)
  }
  // 重新应用字幕
  if (subOn.value && subIdx.value >= 0 && subIdx.value < props.subtitles.length) {
    props.hlsController.setSubtitleByLang(props.subtitles[subIdx.value].language)
  } else {
    props.hlsController.setSubtitleByLang(null)
  }
}
</script>
