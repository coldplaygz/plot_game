<template>
  <div class="h-player fixed inset-0 flex flex-col bg-black select-none overflow-hidden">
    <video
      ref="videoEl"
      class="absolute inset-0 z-0 h-full w-full object-contain bg-black"
      playsinline
      preload="auto"
    ></video>

    <!-- ═══ 顶栏：返回 + 场景标题 ═══ -->
    <div class="relative z-20 shrink-0 flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)] pb-2 bg-gradient-to-b from-black/70 to-transparent">
      <button @click="onReturnToLobby"
        class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-colors text-white shrink-0"
        title="返回首页">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <span v-if="game.currentScene" class="flex-1 min-w-0 truncate text-sm text-white/70">{{ game.currentScene.title }}</span>
    </div>

    <!-- ═══ 中间区：缓冲指示 ═══ -->
    <div class="relative z-10 flex-1 min-h-0 flex items-center justify-center pointer-events-none">
      <div v-if="isBuffering" class="w-12 h-12 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
    </div>

    <!-- ═══ 选项弹窗 ═══ -->
    <div v-if="choicesActive" class="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="w-[90%] max-w-md bg-surface-card border border-border-dim rounded-2xl p-5 shadow-2xl">
        <div v-if="currentTimer > 0" class="text-center text-xs text-text-dim mb-3">⏱ {{ currentTimer }}s</div>
        <div class="flex flex-col gap-2">
          <button v-for="(c, i) in currentChoices" :key="c.id"
            @click="onChoose(c.id)"
            class="px-4 py-3 text-left text-sm text-white bg-white/8 hover:bg-brand-purple/30 border border-border-dim hover:border-brand-purple rounded-lg transition-colors">
            <span class="text-text-dim mr-2">{{ i + 1 }}.</span>{{ c.text }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ 底部控制栏（照搬 hls-test 的简单实现） ═══ -->
    <div v-show="!choicesActive" class="relative z-20 shrink-0 px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-gradient-to-t from-black/85 via-black/60 to-transparent">
      <!-- 进度条（仅显示） -->
      <div class="h-1 w-full bg-white/15 rounded-full overflow-hidden mb-3">
        <div class="h-full bg-gradient-to-r from-brand-purple to-brand-pink rounded-full transition-[width] duration-200" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- 控制按钮行 -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- 播放/暂停 -->
        <button @click="togglePlay"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors text-white shrink-0">
          <svg v-if="isPlaying" viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <svg v-else viewBox="0 0 24 24" class="w-4 h-4 ml-0.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>

        <!-- 音轨下拉 -->
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-dim">音轨</label>
          <select v-model="audioTrackId" @change="onAudioTrackChange"
            class="bg-surface-darkest border border-border-dim rounded-lg text-white text-xs px-2 py-1.5 outline-none focus:border-brand-purple">
            <option v-for="t in audioTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
          </select>
        </div>

        <!-- 字幕下拉 -->
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-dim">字幕</label>
          <select v-model="subtitleId" @change="onSubtitleChange"
            class="bg-surface-darkest border border-border-dim rounded-lg text-white text-xs px-2 py-1.5 outline-none focus:border-brand-purple">
            <option :value="-1">关闭</option>
            <option v-for="t in subtitleTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
          </select>
        </div>

        <!-- 音量 -->
        <div class="flex items-center gap-2 ml-auto">
          <label class="text-xs text-text-dim">音量</label>
          <input type="range" min="0" max="1" step="0.01" v-model.number="volume"
            class="w-20 accent-brand-purple" />
        </div>
      </div>

      <!-- 状态提示 -->
      <div v-if="statusText" class="mt-1.5 text-xs text-text-dim truncate">{{ statusText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Hls from 'hls.js'
import { useGameStore } from '../stores/game'

const route = useRoute()
const router = useRouter()
const game = useGameStore()

const videoEl = ref(null)
const isPlaying = ref(false)
const isBuffering = ref(false)
const videoCurrentTime = ref(0)
const videoDuration = ref(0)
const volume = ref(1)

// HLS 实例 + 音轨/字幕列表（照搬 hls-test 实现）
let hls = null
const audioTracks = ref([])
const subtitleTracks = ref([])
const audioTrackId = ref(-1)
const subtitleId = ref(-1)
const statusText = ref('')

// 选项
const currentChoices = ref([])
const currentTimer = ref(0)
const choicesActive = ref(false)
let timerHandle = null
let endCheckHandle = null

const progressPercent = computed(() => {
  if (!videoDuration.value) return 0
  return Math.min(100, (videoCurrentTime.value / videoDuration.value) * 100)
})

// ═══════════════════════════════════════════════════════════════
// HLS 加载（照搬 hls-test 的标准实现）
// ═══════════════════════════════════════════════════════════════
function destroyHls() {
  if (hls) {
    hls.destroy()
    hls = null
    audioTracks.value = []
    subtitleTracks.value = []
    audioTrackId.value = -1
    subtitleId.value = -1
  }
}

function loadHlsStream(url) {
  destroyHls()
  statusText.value = '加载中...'

  // Safari 原生 HLS
  if (videoEl.value.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
    videoEl.value.src = url
    statusText.value = '原生 HLS'
    return
  }

  hls = new Hls({
    lowLatencyMode: false,
    enableWebVTT: true,
    renderTextTracksNatively: true
  })
  hls.loadSource(url)
  hls.attachMedia(videoEl.value)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    statusText.value = ''
    updateAudioTracks()
    updateSubtitleTracks()
    // 自动开始播放
    videoEl.value.play().catch(() => {
      statusText.value = '点击播放'
    })
  })

  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateAudioTracks)
  hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateSubtitleTracks)

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => {
    audioTrackId.value = data.id
    console.log('[HLS] AUDIO_TRACK_SWITCHED → id=' + data.id)
  })

  hls.on(Hls.Events.ERROR, (_evt, data) => {
    console.error('[HLS] ERROR:', data.type, data.details, data.fatal ? '(fatal)' : '', data)
    if (data.fatal) statusText.value = '错误: ' + data.details
  })
}

function updateAudioTracks() {
  if (!hls) return
  audioTracks.value = hls.audioTracks || []
  audioTrackId.value = hls.audioTrack
  console.log('[HLS] 音轨列表:', audioTracks.value.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
}

function updateSubtitleTracks() {
  if (!hls) return
  subtitleTracks.value = hls.subtitleTracks || []
  subtitleId.value = hls.subtitleTrack
  console.log('[HLS] 字幕列表:', subtitleTracks.value.map(t => ({ id: t.id, lang: t.lang, name: t.name })))
}

function onAudioTrackChange() {
  if (!hls) return
  console.log('[HLS] 切换音轨 → id=' + audioTrackId.value)
  hls.audioTrack = audioTrackId.value
}

function onSubtitleChange() {
  if (!hls) return
  console.log('[HLS] 切换字幕 → id=' + subtitleId.value)
  hls.subtitleTrack = subtitleId.value
}

// ═══════════════════════════════════════════════════════════════
// 视频事件
// ═══════════════════════════════════════════════════════════════
function onPlay() { isPlaying.value = true }
function onPause() { isPlaying.value = false }
function onWaiting() { isBuffering.value = true }
function onPlaying() { isBuffering.value = false }
function onTimeUpdate() {
  videoCurrentTime.value = videoEl.value?.currentTime || 0
  // 选项弹出检测
  checkChoicePopup()
  // 视频结束检测
  checkVideoEnd()
}
function onDurationChange() {
  videoDuration.value = Number.isFinite(videoEl.value?.duration) ? videoEl.value.duration : 0
}

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) v.play()
  else v.pause()
}

watch(volume, (val) => {
  if (videoEl.value) {
    videoEl.value.volume = val
    videoEl.value.muted = val === 0
  }
})

function bindVideoEvents(el) {
  if (!el) return
  el.addEventListener('play', onPlay)
  el.addEventListener('pause', onPause)
  el.addEventListener('waiting', onWaiting)
  el.addEventListener('playing', onPlaying)
  el.addEventListener('timeupdate', onTimeUpdate)
  el.addEventListener('durationchange', onDurationChange)
}
function unbindVideoEvents(el) {
  if (!el) return
  el.removeEventListener('play', onPlay)
  el.removeEventListener('pause', onPause)
  el.removeEventListener('waiting', onWaiting)
  el.removeEventListener('playing', onPlaying)
  el.removeEventListener('timeupdate', onTimeUpdate)
  el.removeEventListener('durationchange', onDurationChange)
}

// ═══════════════════════════════════════════════════════════════
// 场景播放 + 选项逻辑
// ═══════════════════════════════════════════════════════════════
let playRequestId = 0

async function playScene() {
  const scene = game.currentScene
  if (!scene) return
  const reqId = ++playRequestId

  // 重置状态
  currentChoices.value = []
  choicesActive.value = false
  if (timerHandle) { clearTimeout(timerHandle); timerHandle = null }
  if (endCheckHandle) { clearTimeout(endCheckHandle); endCheckHandle = null }
  isBuffering.value = true
  videoCurrentTime.value = 0
  videoDuration.value = 0

  const v = videoEl.value
  if (!v) return
  v.currentTime = 0

  // HLS 模式
  if (scene.hls_url && scene.hls_status === 'done') {
    console.log('[GamePlayer] HLS 模式:', scene.hls_url)
    loadHlsStream(scene.hls_url)
  } else if (scene.file_path) {
    // 回退：直接播放 mp4
    console.log('[GamePlayer] MP4 模式:', scene.file_path)
    destroyHls()
    v.src = '/' + scene.file_path.replace(/\\/g, '/')
    v.load()
    v.play().catch(() => { statusText.value = '点击播放' })
  } else {
    statusText.value = '无可播放的视频源'
    isBuffering.value = false
    return
  }

  await nextTick()
  if (reqId !== playRequestId) return
  isBuffering.value = false
}

// 选项弹出检测：choice_delay > 0 时在指定秒数弹出
function checkChoicePopup() {
  const scene = game.currentScene
  if (!scene || !scene.choices || !scene.choices.length) return
  if (choicesActive.value) return
  const delay = scene.choice_delay
  if (!delay || delay <= 0) return
  if (videoCurrentTime.value >= delay) {
    showChoices(scene.choices, scene.choice_timer)
  }
}

function showChoices(choices, timer) {
  currentChoices.value = choices
  choicesActive.value = true
  if (timer && timer > 0) {
    currentTimer.value = timer
    timerHandle = setInterval(() => {
      currentTimer.value--
      if (currentTimer.value <= 0) {
        clearInterval(timerHandle)
        timerHandle = null
        // 超时默认选第一个
        if (currentChoices.value[0]) onChoose(currentChoices.value[0].id)
      }
    }, 1000)
  }
}

// 视频结束检测：无 choice_delay 或视频结束且无选项 → 显示选项或下一场景
function checkVideoEnd() {
  const scene = game.currentScene
  if (!scene) return
  if (choicesActive.value) return
  // 有选项且未到 choice_delay，等视频结束
  if (videoDuration.value && videoCurrentTime.value >= videoDuration.value - 0.2) {
    if (scene.choices && scene.choices.length > 0) {
      if (!scene.choice_delay || scene.choice_delay <= 0) {
        showChoices(scene.choices, scene.choice_timer)
      }
    }
    // 无选项场景：视频结束不做特殊处理（可扩展结局逻辑）
  }
}

async function onChoose(choiceId) {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
  choicesActive.value = false
  currentChoices.value = []

  const result = await game.makeChoice(choiceId)
  if (!result) return

  if (result.finished) {
    router.push('/ending')
  } else if (result.scene) {
    await nextTick()
    playScene()
  }
}

function onReturnToLobby() {
  playRequestId++
  destroyHls()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  game.returnToLobby()
  router.push('/')
}

// ═══════════════════════════════════════════════════════════════
// 生命周期
// ═══════════════════════════════════════════════════════════════
watch(() => game.currentScene, (newScene) => {
  if (newScene) nextTick(() => playScene())
}, { immediate: true })

watch(videoEl, (el, oldEl) => {
  if (oldEl && oldEl !== el) unbindVideoEvents(oldEl)
  if (el) bindVideoEvents(el)
}, { immediate: true })

onMounted(async () => {
  const gameId = route.params.gameId
  if (gameId && !game.currentScene) {
    await game.startNewGame(parseInt(gameId) || gameId)
  }
  if (!game.currentScene) router.push('/')
})

onBeforeUnmount(() => {
  playRequestId++
  unbindVideoEvents(videoEl.value)
  destroyHls()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  game.returnToLobby()
})
</script>
