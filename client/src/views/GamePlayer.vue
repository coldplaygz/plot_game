<template>
  <div
    ref="rootEl"
    class="h-player fixed inset-0 flex flex-col bg-black select-none overflow-hidden overscroll-none"
    :style="playerStyle"
  >
    <video
      ref="videoEl"
      class="absolute inset-0 z-0 h-full w-full object-contain bg-black"
      playsinline preload="auto"
      @play="isPlaying = true"
      @pause="onPaused"
      @ended="onPaused"
      @waiting="isBuffering = true"
      @playing="isBuffering = false"
      @canplay="onCanPlay"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
    ></video>

    <!-- ═══ 顶栏：返回 + 场景标题 ═══ -->
    <div
      class="relative z-20 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 pt-[env(safe-area-inset-top)] pb-2 bg-gradient-to-b from-black/70 to-transparent"
    >
      <button @click="onReturnToLobby"
        class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white shrink-0"
        title="返回首页">
        <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <span v-if="game.currentScene" class="flex-1 min-w-0 truncate text-sm text-white/70">{{ sceneTitle }}</span>
    </div>

    <!-- ═══ 中间区：点击层 + 缓冲 + 大播放按钮 + 转码警告 ═══ -->
    <div class="relative z-10 flex-1 min-h-0 flex items-center justify-center">
      <div v-if="transcodeWarning"
        class="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-yellow-500/90 text-black text-sm rounded-lg shadow-lg max-w-[90vw] truncate">⏳ {{ transcodeWarning }}</div>

      <div v-if="isBuffering"
        class="w-12 h-12 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin pointer-events-none"></div>

      <div v-else-if="!isPlaying && !choicesActive"
        class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full bg-black/50 border border-white/25 text-white pointer-events-none">
        <svg viewBox="0 0 24 24" class="w-8 h-8 sm:w-10 sm:h-10 ml-1" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>

    <!-- ═══ 字幕行（min-h 预留空间防跳动） ═══ -->
    <div class="relative z-10 shrink-0 flex justify-center items-end px-4 pb-2 min-h-[3.5rem] sm:min-h-[3rem]">
      <SubtitleDisplay :src="subSrc" :video-el="videoEl" />
    </div>

    <!-- ═══ 底部容器（常驻挂载，避免卸载 LangBar 导致音轨中断） ═══ -->
    <div class="relative z-20 shrink-0">
      <!-- 控制栏 -->
      <div
        v-show="!choicesActive"
        class="controls-bar px-3 sm:px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-gradient-to-t from-black/85 via-black/60 to-transparent"
      >
        <!-- 进度条（仅显示，不可拖拽） -->
        <div class="h-1 w-full bg-white/15 rounded-full overflow-hidden mb-3">
          <div class="h-full bg-gradient-to-r from-brand-purple to-brand-pink rounded-full transition-[width] duration-200" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <!-- 按钮行 -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- 播放/暂停 -->
          <button @click="togglePlay"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0">
            <svg v-if="isPlaying" viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4 ml-0.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>

          <!-- 更多（仅移动端：收纳倍速/循环/重播） -->
          <div class="relative shrink-0 sm:hidden">
            <button @click="showMoreMenu = !showMoreMenu"
              class="w-11 h-11 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white">
              <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div v-if="showMoreMenu" class="fixed inset-0 z-40" @click="showMoreMenu = false"></div>
            <div v-if="showMoreMenu" class="absolute bottom-full left-0 mb-2 w-44 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl">
              <!-- 倍速 -->
              <div class="px-4 pt-3 pb-1 text-xs text-text-dimmer">倍速</div>
              <div class="flex gap-1 px-3 pb-2">
                <button v-for="r in [1, 1.5, 2]" :key="r" @click="setSpeed(r)"
                  class="flex-1 py-2 rounded-lg text-sm transition-colors"
                  :class="playbackRate === r ? 'bg-brand-purple/25 text-white' : 'bg-white/10 text-text-dim hover:bg-white/20 hover:text-white'">{{ r }}x</button>
              </div>
              <!-- 循环 -->
              <button @click="isLooping = !isLooping"
                class="flex w-full items-center gap-3 px-4 py-3 text-sm text-left transition-colors"
                :class="isLooping ? 'text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">
                <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                <span class="flex-1">循环播放</span>
                <span v-if="isLooping" class="w-2 h-2 rounded-full bg-brand-pink shrink-0"></span>
              </button>
              <!-- 重播 -->
              <button @click="replay(); showMoreMenu = false"
                class="flex w-full items-center gap-3 px-4 py-3 text-sm text-left text-text-dim hover:bg-white/10 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                <span class="flex-1">重播</span>
              </button>
            </div>
          </div>

          <!-- 倍速（移动端收入"更多"菜单） -->
          <div class="relative shrink-0 hidden sm:block">
            <button @click="showSpeedMenu = !showSpeedMenu"
              class="h-11 sm:h-9 min-w-11 sm:min-w-9 px-2 bg-white/15 hover:bg-white/30 active:bg-white/40 rounded-full text-white text-sm sm:text-xs transition-colors font-medium">
              {{ playbackRate }}x
            </button>
            <div v-if="showSpeedMenu" class="fixed inset-0 z-40" @click="showSpeedMenu = false"></div>
            <div v-if="showSpeedMenu" class="absolute bottom-full left-0 mb-2 w-20 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl">
              <button v-for="r in [1, 1.5, 2]" :key="r" @click="setSpeed(r)"
                class="block w-full px-4 py-2.5 sm:py-1.5 text-sm sm:text-xs text-left transition-colors"
                :class="playbackRate === r ? 'bg-brand-purple/20 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">{{ r }}x</button>
            </div>
          </div>

          <!-- 循环（仅桌面端，移动端收入"更多"菜单） -->
          <button @click="isLooping = !isLooping"
            class="hidden sm:flex w-11 h-11 sm:w-9 sm:h-9 items-center justify-center rounded-full transition-colors shrink-0"
            :class="isLooping ? 'bg-brand-purple/60 text-white' : 'bg-white/15 text-white/60 hover:bg-white/30 active:bg-white/40'">
            <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
          </button>

          <!-- 重播（仅桌面端，移动端收入"更多"菜单） -->
          <button @click="replay" title="重播"
            class="hidden sm:flex w-11 h-11 sm:w-9 sm:h-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0">
            <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>

          <!-- 音轨/字幕 -->
          <LangBar
            v-if="game.currentScene"
            :audios="game.currentScene.audios || []"
            :subtitles="game.currentScene.subtitles || []"
            :video-el="videoEl"
            :current-audio-el="game.currentAudioEl"
            :is-touch-device="isTouchDevice"
            @update:audio-el="game.currentAudioEl = $event"
            @update:sub-src="subSrc = $event"
          />

          <div class="flex-1 min-w-0"></div>

          <!-- 跳过 -->
          <button v-if="showSkipBtn" @click="onSkip"
            class="h-11 sm:h-9 px-4 sm:px-4 bg-white/15 border border-white/25 hover:bg-white/30 active:bg-white/40 text-white rounded-full text-sm font-medium transition-all shrink-0 flex items-center gap-1">
            {{ skipText }}
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>

          <!-- 全屏 -->
          <button @click="toggleFullscreen"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0">
            <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </button>
        </div>
      </div>

      <!-- 选项覆盖层（v-if 重新挂载以重启倒计时） -->
      <ChoiceOverlay
        v-if="choicesActive"
        :choices="currentChoices"
        :timer-seconds="currentTimer"
        @choose="onChoose"
      />
    </div>

    <!-- 场景切换转场：闪黑过渡（类似剪映转场），遮住换片与加载过程 -->
    <div
      class="absolute inset-0 z-30 bg-black flex items-center justify-center transition-opacity duration-300"
      :class="showTransition ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <div v-if="showTransition" class="w-10 h-10 border-2 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useLangStore } from '../stores/lang'
import { useConfirm } from '../composables/useConfirm'
import { useToast } from '../composables/useToast'
import ChoiceOverlay from '../components/ChoiceOverlay.vue'
import LangBar from '../components/LangBar.vue'
import SubtitleDisplay from '../components/SubtitleDisplay.vue'

const router = useRouter()
const route = useRoute()
const game = useGameStore()
const lang = useLangStore()
const { confirm } = useConfirm()
const toast = useToast()

const videoEl = ref(null)
const rootEl = ref(null)
const currentChoices = ref([])
const currentTimer = ref(0)
const showSkipBtn = ref(false)
const subSrc = ref('')
const isTouchDevice = ref(false)

const isPlaying = ref(false)
const isBuffering = ref(false)
const playbackRate = ref(1)
const isLooping = ref(false)
const showSpeedMenu = ref(false)
const showMoreMenu = ref(false)

// 场景切换转场（闪黑）
const showTransition = ref(false)
let transitionAt = 0
let transitionSafety = null

function beginTransition() {
  transitionAt = Date.now()
  showTransition.value = true
  if (transitionSafety) clearTimeout(transitionSafety)
  // 兜底：无论加载多慢，最多黑屏 8 秒，避免卡死在黑幕
  transitionSafety = setTimeout(() => { showTransition.value = false }, 8000)
}

function endTransition() {
  if (!showTransition.value) return
  const elapsed = Date.now() - transitionAt
  // 保证黑幕至少停留一小段时间，过渡更平滑
  setTimeout(() => { showTransition.value = false }, Math.max(0, 350 - elapsed))
}

// 进度条（仅显示）
const videoDuration = ref(0)
const videoCurrentTime = ref(0)
const progressPercent = computed(() => {
  if (!videoDuration.value) return 0
  return Math.min(100, (videoCurrentTime.value / videoDuration.value) * 100)
})
function onTimeUpdate() {
  if (videoEl.value) videoCurrentTime.value = videoEl.value.currentTime
}
function onLoadedMetadata() {
  if (videoEl.value) videoDuration.value = videoEl.value.duration || 0
}
function onPaused() {
  isPlaying.value = false
  isBuffering.value = false
}

function onCanPlay() {
  isBuffering.value = false
  endTransition()
}

const skipMap = { zh: '跳过', en: 'Skip', ja: 'スキップ', ko: '건너뛰기' }
const skipText = computed(() => skipMap[lang.current] || skipMap.zh)

const transcodeWarning = computed(() => {
  const s = game.currentScene
  if (!s || s.transcode_status === 'done' || !s.transcode_status) return ''
  if (s.transcode_status === 'queued') return '视频排队等待转码中，播放可能出现兼容性问题'
  if (s.transcode_status === 'transcoding') return '视频正在后台转码中，播放可能出现兼容性问题'
  if (s.transcode_status === 'failed') return '视频转码失败，可能无法正常播放'
  return ''
})

const sceneTitle = computed(() => {
  const s = game.currentScene
  if (!s) return ''
  return s.chapter ? s.chapter + ' - ' + s.title : s.title
})

const choicesActive = computed(() => game.showingChoices && currentChoices.value.length > 0)

// 视口高度兼容：老浏览器不支持 dvh/-webkit-fill-available 时用真实可视高度，避免底部控制栏被裁掉
const playerStyle = ref({})
const supportsDvh = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh')
const supportsFillAvailable = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '-webkit-fill-available')
function updatePlayerHeight() {
  if (!supportsDvh && !supportsFillAvailable) {
    playerStyle.value = { height: window.innerHeight + 'px' }
  }
}

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) v.play().catch(() => {})
  else v.pause()
}

function replay() {
  const v = videoEl.value
  if (!v) return
  v.currentTime = 0
  v.play().catch(() => {})
}

function setSpeed(r) {
  playbackRate.value = r
  showSpeedMenu.value = false
  if (videoEl.value) videoEl.value.playbackRate = r
}

function toggleFullscreen() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement
  if (fsEl) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen
    if (exit) exit.call(document)
    return
  }
  const root = rootEl.value
  if (root && typeof root.requestFullscreen === 'function') {
    root.requestFullscreen().catch(() => {})
  } else if (videoEl.value && typeof videoEl.value.webkitEnterFullscreen === 'function') {
    // iOS Safari 不支持 div 全屏，回退 video 原生全屏（自带控制条）
    videoEl.value.webkitEnterFullscreen()
  }
}

// 全屏后锁定横屏播放，退出全屏时解除
function onFullscreenChange() {
  try {
    if (document.fullscreenElement) {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {})
      }
    } else if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock()
    }
  } catch (e) { /* 不支持的浏览器静默失败 */ }
}

watch(isLooping, (val) => {
  if (videoEl.value) videoEl.value.loop = val
})

function playScene() {
  if (!game.currentScene) { router.push('/'); return }
  const scene = game.currentScene
  const v = videoEl.value
  if (!v) return

  v.onended = null
  if (game.choiceDelayId) { clearTimeout(game.choiceDelayId); game.choiceDelayId = null }
  game.showingChoices = false
  currentChoices.value = []
  showSkipBtn.value = false
  videoCurrentTime.value = 0
  videoDuration.value = 0

  v.currentTime = 0
  v.src = scene.file_path ? '/' + scene.file_path.replace(/\\\\/g, '/') : ''
  // 外挂音轨激活时双重静音（attribute + volume，load 不重置 volume）
  if (game.currentAudioEl) {
    v.setAttribute('muted', '')
    v.volume = 0
  } else {
    v.removeAttribute('muted')
    v.volume = 1
  }
  v.load()
  v.play().catch(() => {})

  const hasChoices = scene.choices && scene.choices.length > 0
  const delay = scene.choice_delay || 0
  showSkipBtn.value = true

  if (hasChoices) {
    if (delay > 0) {
      game.choiceDelayId = setTimeout(() => {
        showSkipBtn.value = false
        v.pause()
        currentChoices.value = scene.choices
        currentTimer.value = (scene.choice_timer == null || scene.choice_timer === 0) ? 0 : (scene.choice_timer || 10)
        game.showingChoices = true
        game.choiceDelayId = null
      }, delay * 1000)
    } else {
      v.onended = () => {
        if (!game.isEnding) {
          currentChoices.value = scene.choices
          currentTimer.value = (scene.choice_timer == null || scene.choice_timer === 0) ? 0 : (scene.choice_timer || 10)
          game.showingChoices = true
        }
      }
    }
  }

  if (game.isEnding && game.ending) {
    setTimeout(() => router.push('/ending'), 2000)
  }
}

function onSkip() {
  if (game.choiceDelayId) { clearTimeout(game.choiceDelayId); game.choiceDelayId = null }
  showSkipBtn.value = false
  const scene = game.currentScene
  if (scene && scene.choices && scene.choices.length > 0) {
    videoEl.value?.pause()
    currentChoices.value = scene.choices
    currentTimer.value = (scene.choice_timer == null || scene.choice_timer === 0) ? 0 : (scene.choice_timer || 10)
    game.showingChoices = true
  } else if (videoEl.value) {
    videoEl.value.currentTime = videoEl.value.duration || 999
  }
}

async function onChoose(choiceId) {
  game.showingChoices = false
  currentChoices.value = []
  beginTransition()

  const result = await game.makeChoice(choiceId)
  if (!result) { showTransition.value = false; return }

  if (result.insufficientPoints) {
    showTransition.value = false
    const go = await confirm({
      title: '积分不足',
      message: `需要 ${result.required} 💎，当前余额 ${result.current} 💎`,
      icon: '💎',
      confirmText: '去充值',
      cancelText: '取消'
    })
    if (go) {
      router.push('/profile')
    } else {
      const scene = game.currentScene
      if (scene?.choices) {
        currentChoices.value = scene.choices
        game.showingChoices = true
      }
    }
    return
  }

  if (result.finished) {
    setTimeout(() => router.push('/'), 3000)
  } else if (result.scene) {
    await nextTick()
    playScene()
  }
}

function onReturnToLobby() {
  game.returnToLobby()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  router.push('/')
}

watch(() => game.currentScene, (newScene) => {
  if (newScene) nextTick(() => playScene())
})

onMounted(async () => {
  // 触摸设备检测（用于 LangBar 判断是否外挂音频）
  isTouchDevice.value = ('ontouchstart' in window) ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0)) ||
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    (typeof window !== 'undefined' && window.innerWidth < 768)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  const gameId = route.params.gameId
  if (gameId && !game.currentScene) {
    await game.startNewGame(parseInt(gameId) || gameId)
  }
  if (game.currentScene) playScene()
  else router.push('/')

  const onKeydown = (e) => {
    if (e.key === 'Escape') onReturnToLobby()
    if (e.key === ' ' && !game.showingChoices) { e.preventDefault(); togglePlay(); }
    if (game.showingChoices) {
      const n = parseInt(e.key)
      if (n >= 1 && n <= 9 && currentChoices.value[n - 1]) {
        onChoose(currentChoices.value[n - 1].id)
      }
    }
  }
  document.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePlayerHeight)
  window.removeEventListener('orientationchange', updatePlayerHeight)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  game.returnToLobby()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
})
</script>

<style scoped>
/* 桌面端（有 hover + 精确指针）：鼠标移开后底部控制栏自动隐藏 */
@media (hover: hover) and (pointer: fine) {
  .controls-bar {
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }
  .h-player:hover .controls-bar {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
