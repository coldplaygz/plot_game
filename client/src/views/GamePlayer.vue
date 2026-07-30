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
      @volumechange="isMuted = videoEl?.muted || false"
      @canplay="onCanPlay"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
    ></video>

    <!-- ═══ 顶栏：返回 + 场景标题 + 菜单 ═══ -->
    <div
      class="relative z-20 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 pt-[env(safe-area-inset-top)] pb-2 bg-gradient-to-b from-black/70 to-transparent"
    >
      <button @click="onReturnToLobby"
        class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white shrink-0"
        title="返回首页">
        <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <span v-if="game.currentScene" class="flex-1 min-w-0 truncate text-sm text-white/70">{{ sceneTitle }}</span>
      <div class="relative shrink-0">
        <button @click="showGameMenu = !showGameMenu"
          class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white"
          title="菜单">
          <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
        <div v-if="showGameMenu" class="fixed inset-0 z-40" @click="showGameMenu = false"></div>
        <div v-if="showGameMenu" class="absolute top-full right-0 mt-2 w-40 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl">
          <button @click="openSaveLoad('save')"
            class="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-subtle hover:bg-brand-purple/20 hover:text-white transition-colors">💾 存档</button>
          <button @click="openSaveLoad('load')"
            class="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-subtle hover:bg-brand-purple/20 hover:text-white transition-colors">📂 读档</button>
          <button @click="onReturnToLobby()"
            class="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-subtle hover:bg-brand-purple/20 hover:text-white transition-colors">🏠 返回大厅</button>
        </div>
      </div>
    </div>

    <!-- 存档/读档弹窗 -->
    <SaveLoadModal v-if="saveLoadVisible" :mode="saveLoadMode" @close="saveLoadVisible = false" />

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

    <!-- ═══ 字幕行（min-h 预留空间防跳动；HLS 模式下自己渲染字幕到 DOM，控制位置和字体自适应） ═══ -->
    <div class="relative z-10 shrink-0 flex justify-center items-end px-4 pb-2 min-h-[2.5rem] sm:min-h-[2rem]">
      <SubtitleDisplay v-if="!useHlsMode" :src="subSrc" :video-el="videoEl" />
      <div v-else-if="hlsSubtitleText"
           class="hl-subtitle pointer-events-none max-w-[90%] text-center whitespace-pre-wrap bg-black/75 text-white px-3 py-1 rounded-md leading-relaxed [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{{ hlsSubtitleText }}</div>
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

          <!-- 静音/取消静音（HLS 模式下反映流内音轨是否出声；外挂音轨模式下 video 静音是正常的） -->
          <button @click="toggleMute"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0"
            :title="isMuted ? '取消静音' : '静音'">
            <!-- 有声：喇叭+声波 -->
            <svg v-if="!isMuted" viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <!-- 静音：喇叭+叉 -->
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor">
              <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
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
            ref="langBarRef"
            :audios="game.currentScene.audios || []"
            :subtitles="game.currentScene.subtitles || []"
            :video-el="videoEl"
            :current-audio-el="game.currentAudioEl"
            :is-touch-device="isTouchDevice"
            :hls-controller="hlsController"
            :hls-mode="useHlsMode"
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

    <div
      v-if="showSceneLoading || showStartPrompt"
      class="absolute inset-0 z-40 bg-black/92 flex items-center justify-center"
    >
      <div v-if="showSceneLoading" class="flex flex-col items-center gap-4 text-white">
        <div class="w-12 h-12 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
        <div class="text-sm text-text-subtle">正在准备当前场景...</div>
      </div>

      <button
        v-else
        @click="beginScenePlayback"
        class="px-8 py-4 rounded-2xl bg-brand-purple text-white text-base font-medium hover:bg-brand-purple-dark transition-colors"
      >
        点击开始播放
      </button>
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
import SaveLoadModal from '../components/SaveLoadModal.vue'
import { waitForVideoElementReady } from '../utils/media-preload'
import { attachHls, waitForHlsReady } from '../utils/hls-player'

const router = useRouter()
const route = useRoute()
const game = useGameStore()
const lang = useLangStore()
const { confirm } = useConfirm()
const toast = useToast()

const videoEl = ref(null)
const langBarRef = ref(null)
const rootEl = ref(null)
// HLS 控制器（HLS 模式下用于切换音轨/字幕）
const hlsController = ref(null)
// 当前场景是否使用 HLS 模式
const useHlsMode = computed(() => {
  const s = game.currentScene
  return !!(s && s.hls_url && s.hls_status === 'done')
})
const currentChoices = ref([])
const currentTimer = ref(0)
const showSkipBtn = ref(false)
const subSrc = ref('')
// HLS 模式下当前字幕文本（关闭 hls.js 原生渲染后，自己渲染到 DOM）
const hlsSubtitleText = ref('')
const isTouchDevice = ref(false)
// 自动播放：进入游戏页前理论上已有用户点击手势，但跨页面导航后浏览器可能不认，
// 改为默认未解锁，首次场景加载时尝试带声播放，被拒则显示「点击开始」按钮
const playbackUnlocked = ref(false)
const showSceneLoading = ref(true)
const showStartPrompt = ref(false)

const isPlaying = ref(false)
// 静音状态（反映 video.muted，便于 UI 显示当前音轨是否有声）
const isMuted = ref(false)

function toggleMute() {
  const v = videoEl.value
  if (!v) return
  v.muted = !v.muted
  isMuted.value = v.muted
  // unmute 时确保音量正常（外挂音轨模式下 unmute video 会听到 video 原声，但 HLS 模式下正是需要的）
  if (!v.muted && v.volume === 0) v.volume = 1
}
const isBuffering = ref(false)
const playbackRate = ref(1)
const isLooping = ref(false)
const showSpeedMenu = ref(false)
const showMoreMenu = ref(false)
const showGameMenu = ref(false)
const saveLoadVisible = ref(false)
const saveLoadMode = ref('save')

function openSaveLoad(mode) {
  showGameMenu.value = false
  saveLoadMode.value = mode
  saveLoadVisible.value = true
}

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

let sceneEndChecker = null
let waitingForChoiceEnd = false
let playSceneRequestId = 0

watch(isLooping, (val) => {
  if (videoEl.value) videoEl.value.loop = val
  if (val && videoEl.value && game.currentScene) {
    const v = videoEl.value
    const scene = game.currentScene
    if (!sceneEndChecker) {
      sceneEndChecker = () => {
        if (!v || !isLooping.value || game.isEnding || waitingForChoiceEnd) return
        if (v.duration && v.currentTime >= v.duration - 0.3) {
          waitingForChoiceEnd = true
          v.pause()
          currentChoices.value = scene.choices
          currentTimer.value = (scene.choice_timer == null || scene.choice_timer === 0) ? 0 : (scene.choice_timer || 10)
          game.showingChoices = true
          setTimeout(() => {
            if (game.showingChoices) {
              game.showingChoices = false
              currentChoices.value = []
              waitingForChoiceEnd = false
              v.currentTime = 0
              v.play().catch(() => {})
            }
          }, 3000)
        }
      }
      v.addEventListener('timeupdate', sceneEndChecker)
    }
  } else if (!val && sceneEndChecker && videoEl.value) {
    videoEl.value.removeEventListener('timeupdate', sceneEndChecker)
    sceneEndChecker = null
    waitingForChoiceEnd = false
  }
})

async function playScene() {
  if (!game.currentScene) { router.push('/'); return }
  const scene = game.currentScene
  const v = videoEl.value
  if (!v) return
  const requestId = ++playSceneRequestId

  // 清理上一场景的末尾检测（重新挂载由 playScene 末尾处理）
  if (sceneEndChecker) {
    v.removeEventListener('timeupdate', sceneEndChecker)
    sceneEndChecker = null
    waitingForChoiceEnd = false
  }
  v.onended = null
  if (game.choiceDelayId) { clearTimeout(game.choiceDelayId); game.choiceDelayId = null }
  game.showingChoices = false
  currentChoices.value = []
  showSkipBtn.value = false
  videoCurrentTime.value = 0
  videoDuration.value = 0
  isBuffering.value = true
  showSceneLoading.value = true
  showStartPrompt.value = false
  hlsSubtitleText.value = ''

  v.currentTime = 0

  // 清理上一个 HLS 实例
  if (hlsController.value) {
    hlsController.value.dispose()
    hlsController.value = null
  }

  // HLS 模式：音轨/字幕内嵌在流中，无需外挂
  if (useHlsMode.value && scene.hls_url) {
    console.log('[GamePlayer] 进入 HLS 模式，scene.hls_url=', scene.hls_url, 'subtitles=', (scene.subtitles || []).map(s => s.language))
    v.muted = false
    v.volume = 1
    hlsController.value = attachHls(v, scene.hls_url)
    // 注册字幕文本回调：关闭 hls.js 原生渲染后，自己更新 DOM
    hlsController.value?.onCueChange?.((text) => {
      hlsSubtitleText.value = text || ''
    })
    await nextTick()

    const waitTasks = [
      waitForHlsReady(hlsController.value, 8000),
      waitForVideoElementReady(v, 8000)
    ]
    await Promise.all(waitTasks)
    console.log('[GamePlayer] HLS 就绪，准备 reapply；langBarRef=', !!langBarRef.value, 'useHlsMode=', useHlsMode.value, 'hlsController=', !!hlsController.value)

    // manifest 就绪后，重新应用 LangBar 记忆的音轨/字幕选择
    // （LangBar 的 watch subtitles 先于 hlsController 赋值触发，此时 setSubtitleByLang 找不到 tracks）
    nextTick(() => {
      langBarRef.value?.reapply?.()
    })
  } else {
    console.log('[GamePlayer] 跳过 HLS 模式，useHlsMode=', useHlsMode.value, 'hls_url=', scene.hls_url, '→ 使用 mp4 外挂音轨')
    // 旧 mp4 外挂音轨模式（HLS 未就绪或无音轨时回退）
    v.src = scene.file_path ? '/' + scene.file_path.replace(/\\\\/g, '/') : ''
    const hasAltAudio = Array.isArray(scene.audios) && scene.audios.length > 0
    if (hasAltAudio) {
      // 外挂音轨模式：video 静音，声音由外挂 audio 元素播放
      v.muted = true
      v.volume = 0
    } else {
      // 无外挂音轨：video 正常出声
      v.muted = false
      v.volume = 1
    }
    v.load()
    await nextTick()

    const waitTasks = [waitForVideoElementReady(v, 8000)]
    if (hasAltAudio && langBarRef.value?.waitForCurrentAudioReady) {
      waitTasks.push(langBarRef.value.waitForCurrentAudioReady(8000))
    }
    await Promise.all(waitTasks)
  }
  if (requestId !== playSceneRequestId) return

  showSceneLoading.value = false

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
        // 循环模式下 3 秒无操作自动隐藏选项
        if (isLooping.value) {
          setTimeout(() => {
            if (game.showingChoices) {
              game.showingChoices = false
              currentChoices.value = []
              showSkipBtn.value = true
              v.currentTime = 0
              v.play().catch(() => {})
            }
          }, 3000)
        }
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
  } else if (!game.isEnding) {
    v.onended = () => { router.push('/ending') }
  }

  if (game.isEnding && game.ending) {
    setTimeout(() => router.push('/ending'), 2000)
  }

  // 循环模式下重新挂载末尾检测（playScene 开头清理过）
  if (isLooping.value && !sceneEndChecker && hasChoices && delay === 0) {
    waitingForChoiceEnd = false
    sceneEndChecker = () => {
      if (!v || !isLooping.value || game.isEnding || waitingForChoiceEnd) return
      if (v.duration && v.currentTime >= v.duration - 0.3) {
        waitingForChoiceEnd = true
        v.pause()
        currentChoices.value = scene.choices
        currentTimer.value = (scene.choice_timer == null || scene.choice_timer === 0) ? 0 : (scene.choice_timer || 10)
        game.showingChoices = true
        setTimeout(() => {
          if (game.showingChoices) {
            game.showingChoices = false
            currentChoices.value = []
            waitingForChoiceEnd = false
            v.currentTime = 0
            v.play().catch(() => {})
          }
        }, 3000)
      }
    }
    v.addEventListener('timeupdate', sceneEndChecker)
  }

  if (!playbackUnlocked.value) {
    // 首次未解锁：尝试带声播放（部分浏览器允许跨页面手势继承）
    // 若被拒则显示「点击开始播放」按钮，用户点击后解锁（保证后续场景带声自动播放）
    v.play().then(() => {
      playbackUnlocked.value = true
    }).catch(() => {
      showStartPrompt.value = true
    })
    return
  }

  // 已解锁：后续场景直接带声播放
  v.play().catch(() => {})
}

function beginScenePlayback() {
  const v = videoEl.value
  if (!v) return
  // 用户点击手势触发，确保 unmute + 带声播放
  v.muted = false
  v.volume = 1
  playbackUnlocked.value = true
  showStartPrompt.value = false
  isBuffering.value = true
  v.play().catch(() => {
    playbackUnlocked.value = false
    showStartPrompt.value = true
    isBuffering.value = false
  })
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
    showTransition.value = false
    router.push('/ending')
  } else if (result.scene) {
    await nextTick()
    playScene()
  }
}

function onReturnToLobby() {
  playSceneRequestId++
  game.returnToLobby()
  if (hlsController.value) {
    hlsController.value.dispose()
    hlsController.value = null
  }
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  router.push('/')
}

watch(() => game.currentScene, (newScene) => {
  if (newScene) nextTick(() => playScene())
})

// 键盘事件处理（在 setup 同步阶段定义，便于 onBeforeUnmount 注册 cleanup）
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

onMounted(async () => {
  // 触摸设备检测（用于 LangBar 判断是否外挂音频）
  isTouchDevice.value = ('ontouchstart' in window) ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0)) ||
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    (typeof window !== 'undefined' && window.innerWidth < 768)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('keydown', onKeydown)

  const gameId = route.params.gameId
  if (gameId && !game.currentScene) {
    await game.startNewGame(parseInt(gameId) || gameId)
  }
  if (game.currentScene) playScene()
  else router.push('/')
})

onBeforeUnmount(() => {
  playSceneRequestId++
  window.removeEventListener('resize', updatePlayerHeight)
  window.removeEventListener('orientationchange', updatePlayerHeight)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('keydown', onKeydown)
  game.returnToLobby()
  if (hlsController.value) {
    hlsController.value.dispose()
    hlsController.value = null
  }
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

<!-- 非 scoped：HLS 字幕样式 -->
<style>
/* 隐藏 hls.js 原生渲染的字幕（我们通过 cuechange 监听自己渲染到 DOM，控制位置和字体） */
video::cue {
  background: transparent;
  color: transparent;
  text-shadow: none;
}

/* 自定义渲染的字幕：字体随屏幕宽度自适应 */
.hl-subtitle {
  font-size: clamp(0.875rem, 2.5vw, 1.25rem);
}
</style>
