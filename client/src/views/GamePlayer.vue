<template>
  <div
    ref="rootEl"
    class="h-player fixed inset-0 flex flex-col bg-black select-none overflow-hidden overscroll-none"
  >
    <video
      ref="videoEl"
      class="absolute inset-0 z-0 h-full w-full object-contain bg-black"
      playsinline
      preload="auto"
      @click="togglePlay"
    ></video>

    <!-- ═══ 顶栏：返回 + 场景标题 + 菜单 ═══ -->
    <div class="relative z-20 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 pt-[env(safe-area-inset-top)] pb-2 bg-gradient-to-b from-black/70 to-transparent">
      <button @click="onReturnToLobby"
        class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white shrink-0"
        title="返回首页">
        <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <span v-if="game.currentScene" class="flex-1 min-w-0 truncate text-sm text-white/70">{{ game.currentScene.title }}</span>

      <!-- 顶栏菜单（存档/读档/返回大厅） -->
      <div class="relative shrink-0">
        <button @click="showTopMenu = !showTopMenu"
          class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white"
          title="菜单">
          <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
        <div v-if="showTopMenu" class="fixed inset-0 z-40" @click="showTopMenu = false"></div>
        <div v-if="showTopMenu" class="absolute top-full right-0 mt-2 w-40 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl max-h-[70vh] overflow-y-auto">
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

    <!-- ═══ 中间区：缓冲 + 大播放按钮 ═══ -->
    <div class="relative z-10 flex-1 min-h-0 flex items-center justify-center pointer-events-none">
      <div v-if="isBuffering" class="w-12 h-12 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
      <div v-else-if="!isPlaying && !choicesActive"
        class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full bg-black/50 border border-white/25 text-white">
        <svg viewBox="0 0 24 24" class="w-8 h-8 sm:w-10 sm:h-10 ml-1" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>

    <!-- ═══ 选项弹窗 ═══ -->
    <div v-if="choicesActive" class="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="w-[90%] max-w-md bg-surface-card border border-border-dim rounded-2xl p-5 shadow-2xl">
        <div class="flex flex-col gap-2">
          <button v-for="(c, i) in currentChoices" :key="c.id"
            @click="onChoose(c.id)"
            class="flex items-center justify-between gap-3 px-4 py-3 text-left text-sm text-white bg-white/8 hover:bg-brand-purple/30 border border-border-dim hover:border-brand-purple rounded-lg transition-colors">
            <span class="min-w-0"><span class="text-text-dim mr-2">{{ i + 1 }}.</span>{{ c.text }}</span>
            <span v-if="c.point_cost > 0"
              class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 text-xs">💎 {{ c.point_cost }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ 底部容器 ═══ -->
    <div v-show="!choicesActive" class="relative z-20 shrink-0">
      <!-- 字幕显示区（在进度条上方） -->
      <div class="px-4 pb-2 min-h-[2rem] flex justify-center items-end">
        <div v-if="subtitleText"
             class="hl-subtitle pointer-events-none max-w-[90%] text-center whitespace-pre-wrap bg-black/75 text-white px-3 py-1 rounded-md leading-relaxed text-sm sm:text-base [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{{ subtitleText }}</div>
      </div>

      <!-- 控制栏 -->
      <div class="px-3 sm:px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-gradient-to-t from-black/85 via-black/60 to-transparent">
        <!-- 进度条（可拖拽 seek） -->
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[11px] text-text-dim tabular-nums w-10 text-right">{{ formatTime(videoCurrentTime) }}</span>
          <div ref="progressBarEl"
               class="relative flex-1 h-1.5 bg-white/15 rounded-full cursor-pointer group"
               @click="onSeekClick"
               @mousedown="onSeekStart"
               @touchstart.passive="onSeekStart">
            <div class="absolute left-0 top-0 h-full bg-gradient-to-r from-brand-purple to-brand-pink rounded-full"
                 :style="{ width: progressPercent + '%' }"></div>
            <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                 :style="{ left: progressPercent + '%' }"></div>
          </div>
          <span class="text-[11px] text-text-dim tabular-nums w-10">{{ formatTime(videoDuration) }}</span>
        </div>

        <!-- 按钮行 -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- 播放/暂停 -->
          <button @click="togglePlay"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0">
            <svg v-if="isPlaying" viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4 ml-0.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>

          <!-- 重播（重新开始当前场景） -->
          <button @click="replayScene"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0"
            title="重播">
            <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>

          <!-- 循环（仅桌面端直接显示，移动端收纳到更多） -->
          <button v-if="!isMobile" @click="toggleLoop"
            class="w-9 h-9 flex items-center justify-center rounded-full transition-colors text-white shrink-0"
            :class="isLooping ? 'bg-brand-purple/30 text-brand-purple' : 'bg-white/15 hover:bg-white/30'"
            title="循环播放">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
          </button>

          <!-- 倍速（仅桌面端直接显示） -->
          <div v-if="!isMobile" class="relative shrink-0">
            <button @click="showSpeedMenu = !showSpeedMenu"
              class="h-9 px-3 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors text-white text-xs">
              {{ playbackRate }}x
            </button>
            <div v-if="showSpeedMenu" class="fixed inset-0 z-40" @click="showSpeedMenu = false"></div>
            <div v-if="showSpeedMenu" class="absolute bottom-full left-0 mb-2 w-24 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl max-h-[70vh] overflow-y-auto">
              <button v-for="r in [1, 1.5, 2]" :key="r" @click="setSpeed(r)"
                class="flex w-full items-center justify-center py-2 text-sm transition-colors"
                :class="playbackRate === r ? 'bg-brand-purple/25 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">{{ r }}x</button>
            </div>
          </div>

          <!-- 音轨（仅桌面端直接显示） -->
          <div v-if="!isMobile" class="flex items-center gap-1.5 shrink-0 ml-1">
            <label class="text-xs text-text-dim">音轨</label>
            <select v-model="audioTrackId" @change="onAudioTrackChange"
              class="bg-surface-darkest border border-border-dim rounded-lg text-white text-xs px-2 py-1.5 outline-none focus:border-brand-purple">
              <option v-for="t in audioTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
            </select>
          </div>

          <!-- 字幕（仅桌面端直接显示） -->
          <div v-if="!isMobile" class="flex items-center gap-1.5 shrink-0">
            <label class="text-xs text-text-dim">字幕</label>
            <select v-model="subtitleId" @change="onSubtitleChange"
              class="bg-surface-darkest border border-border-dim rounded-lg text-white text-xs px-2 py-1.5 outline-none focus:border-brand-purple">
              <option :value="-1">关闭</option>
              <option v-for="t in subtitleTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
            </select>
          </div>

          <!-- 更多（移动端：收纳循环/倍速/音轨/字幕） -->
          <div v-if="isMobile" class="relative shrink-0">
            <button @click="showMoreMenu = !showMoreMenu"
              class="w-11 h-11 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white">
              <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div v-if="showMoreMenu" class="fixed inset-0 z-40" @click="showMoreMenu = false"></div>
            <div v-if="showMoreMenu" class="absolute bottom-full left-0 mb-2 w-52 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              <!-- 循环 -->
              <button @click="toggleLoop"
                class="flex w-full items-center justify-between px-2 py-2 text-sm rounded-lg transition-colors"
                :class="isLooping ? 'bg-brand-purple/25 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">
                <span>循环播放</span>
                <span class="text-xs">{{ isLooping ? '开' : '关' }}</span>
              </button>
              <!-- 倍速 -->
              <div>
                <div class="px-2 pb-1 text-xs text-text-dimmer">倍速</div>
                <div class="flex gap-1">
                  <button v-for="r in [1, 1.5, 2]" :key="r" @click="setSpeed(r)"
                    class="flex-1 py-2 rounded-lg text-sm transition-colors"
                    :class="playbackRate === r ? 'bg-brand-purple/25 text-white' : 'bg-white/10 text-text-dim hover:bg-white/20 hover:text-white'">{{ r }}x</button>
                </div>
              </div>
              <!-- 音轨 -->
              <div>
                <div class="px-2 pb-1 text-xs text-text-dimmer">音轨</div>
                <select v-model="audioTrackId" @change="onAudioTrackChange"
                  class="w-full bg-surface-darkest border border-border-dim rounded-lg text-white text-sm px-2 py-2 outline-none focus:border-brand-purple">
                  <option v-for="t in audioTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
                </select>
              </div>
              <!-- 字幕 -->
              <div>
                <div class="px-2 pb-1 text-xs text-text-dimmer">字幕</div>
                <select v-model="subtitleId" @change="onSubtitleChange"
                  class="w-full bg-surface-darkest border border-border-dim rounded-lg text-white text-sm px-2 py-2 outline-none focus:border-brand-purple">
                  <option :value="-1">关闭</option>
                  <option v-for="t in subtitleTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 跳过 + 全屏按钮（始终显示，靠右） -->
          <button @click="skipScene"
            class="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0 ml-auto"
            title="跳过">
            <svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-4 sm:h-4" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button @click="toggleFullscreen"
            class="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0"
            title="全屏">
            <svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-4 sm:h-4" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Hls from 'hls.js'
import { useGameStore } from '../stores/game'
import { useLangStore } from '../stores/lang'
import { useConfirm } from '../composables/useConfirm'
import SaveLoadModal from '../components/SaveLoadModal.vue'

const route = useRoute()
const router = useRouter()
const game = useGameStore()
const { confirm } = useConfirm()
const langStore = useLangStore()

const rootEl = ref(null)
const videoEl = ref(null)
const progressBarEl = ref(null)

// 播放状态
const isPlaying = ref(false)
const isBuffering = ref(false)
const videoCurrentTime = ref(0)
const videoDuration = ref(0)
const playbackRate = ref(1)
const isLooping = ref(false)
const subtitleText = ref('')

// UI 菜单状态
const showTopMenu = ref(false)
const showMoreMenu = ref(false)
const showSpeedMenu = ref(false)
const showGameMenu = ref(false)
const saveLoadVisible = ref(false)
const saveLoadMode = ref('save')
const isMobile = ref(false)

// HLS 实例
let hls = null
const audioTracks = ref([])
const subtitleTracks = ref([])
const audioTrackId = ref(-1)
const subtitleId = ref(-1)
// 跨场景记住用户音轨/字幕语言选择
let savedAudioLang = null
let savedSubLang = null
let subInitialized = false  // 首次自动选，之后跟用户选择
let subExplicitlyOff = false  // 用户主动关闭字幕，跨场景不重新开启

// 选项
const currentChoices = ref([])
const choicesActive = ref(false)

// 拖拽 seek
let isSeeking = false

const progressPercent = computed(() => {
  if (!videoDuration.value) return 0
  return Math.min(100, Math.max(0, (videoCurrentTime.value / videoDuration.value) * 100))
})

// ═══════════════════════════════════════════════════════════════
// 移动端检测
// ═══════════════════════════════════════════════════════════════
function updateMobileDetection() {
  isMobile.value = window.innerWidth < 768 ||
    ('ontouchstart' in window && window.matchMedia('(pointer: coarse)').matches)
}

// ═══════════════════════════════════════════════════════════════
// HLS 加载（照搬 hls-test 的标准实现）
// ═══════════════════════════════════════════════════════════════
function destroyHls() {
  if (hls) {
    // 记住当前音轨/字幕语言，下个场景恢复
    const curAudioTrack = audioTracks.value.find(t => t.id === audioTrackId.value)
    const curSubTrack = subtitleTracks.value.find(t => t.id === subtitleId.value)
    if (curAudioTrack) savedAudioLang = curAudioTrack.lang
    if (curSubTrack) savedSubLang = curSubTrack.lang
    hls.destroy()
    hls = null
    audioTracks.value = []
    subtitleTracks.value = []
    audioTrackId.value = -1
    subtitleId.value = -1
    subtitleText.value = ''
    subInitialized = false  // 下个场景重新走首次选择逻辑
    // subExplicitlyOff 保持不重置：用户关闭字幕的意图跨场景有效
  }
}

function loadHlsStream(url) {
  destroyHls()

  // Safari 原生 HLS
  if (videoEl.value.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
    videoEl.value.src = url
    return
  }

  hls = new Hls({
    lowLatencyMode: false,
    enableWebVTT: true,
    // 开启原生渲染（否则 cue 不进 textTrack），用 CSS 隐藏
    renderTextTracksNatively: true
  })
  hls.loadSource(url)
  hls.attachMedia(videoEl.value)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    updateAudioTracks()
    updateSubtitleTracks()
    videoEl.value.play().catch(() => {})
  })

  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateAudioTracks)
  hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateSubtitleTracks)

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => {
    audioTrackId.value = data.id
  })

  hls.on(Hls.Events.ERROR, (_evt, data) => {
    console.error('[HLS] ERROR:', data.type, data.details, data.fatal ? '(fatal)' : '')
  })

  // 字幕 cue 监听：hls.js 非原生渲染时通过 textTracks 提供字幕数据
  setupSubtitleCueListener()
}

function setupSubtitleCueListener() {
  const v = videoEl.value
  if (!v) return
  const tracks = v.textTracks
  if (!tracks) return
  let found = false
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    if (track.kind === 'subtitles') {
      // 不手动设置 track.mode，让 hls.js 管理（'showing'/'disabled'）
      // 原生渲染通过 CSS video::cue { visibility: hidden } 隐藏
      // 之前手动设 'hidden' 会导致 hls.js 误判轨道不可用，ERR_ABORTED 取消请求并回退到其他轨道
      track.oncuechange = () => {
        const cue = track.activeCues && track.activeCues[0]
        subtitleText.value = cue ? cue.text : ''
      }
      found = true
    }
  }
  // textTrack 可能还没创建，100ms 后重试
  if (!found && subtitleId.value !== -1) {
    setTimeout(() => setupSubtitleCueListener(), 100)
  }
}

function updateAudioTracks() {
  if (!hls) return
  audioTracks.value = hls.audioTracks || []
  audioTrackId.value = hls.audioTrack
  // 恢复上次选择的音轨语言，或首次匹配 UI 语言
  if (savedAudioLang && audioTrackId.value === -1) {
    const match = audioTracks.value.find(t => t.lang === savedAudioLang)
    if (match) {
      audioTrackId.value = match.id
      hls.audioTrack = match.id
    }
  }
  // 首次（无保存偏好）且无选中时，匹配 UI 语言
  if (!savedAudioLang && audioTrackId.value === -1 && audioTracks.value.length > 0) {
    const uiLang = langStore.current
    const match = audioTracks.value.find(t => t.lang === uiLang) || audioTracks.value[0]
    audioTrackId.value = match.id
    hls.audioTrack = match.id
    savedAudioLang = match.lang
  }
}

function updateSubtitleTracks() {
  if (!hls) return
  subtitleTracks.value = hls.subtitleTracks || []
  subtitleId.value = hls.subtitleTrack
  // 首次加载：按 UI 语言或保存的偏好覆盖 hls.js 默认选择
  if (!subInitialized && subtitleTracks.value.length > 0) {
    if (savedSubLang) {
      const match = subtitleTracks.value.find(t => t.lang === savedSubLang)
      if (match) {
        subtitleId.value = match.id
        hls.subtitleTrack = match.id
      }
    } else if (!subExplicitlyOff) {
      const uiLang = langStore.current
      const match = subtitleTracks.value.find(t => t.lang === uiLang) || subtitleTracks.value[0]
      subtitleId.value = match.id
      hls.subtitleTrack = match.id
      savedSubLang = match.lang
    }
    // 用户明确关闭 → 不选任何字幕
    subInitialized = true
  }
  // 字幕列表就绪后重新绑定 cue 监听
  nextTick(() => setupSubtitleCueListener())
}

function onAudioTrackChange() {
  if (!hls) return
  hls.audioTrack = audioTrackId.value
  const t = audioTracks.value.find(t => t.id === audioTrackId.value)
  if (t) savedAudioLang = t.lang
}

function onSubtitleChange() {
  if (!hls) return
  hls.subtitleTrack = subtitleId.value
  if (subtitleId.value === -1) {
    subtitleText.value = ''
    savedSubLang = null
    subExplicitlyOff = true
  } else {
    const t = subtitleTracks.value.find(t => t.id === subtitleId.value)
    if (t) savedSubLang = t.lang
    subExplicitlyOff = false
  }
  // 切换字幕后重新绑定 cue 监听
  nextTick(() => setupSubtitleCueListener())
}

// ═══════════════════════════════════════════════════════════════
// 视频事件
// ═══════════════════════════════════════════════════════════════
function onPlay() { isPlaying.value = true }
function onPause() { isPlaying.value = false }
function onWaiting() { isBuffering.value = true }
function onPlaying() { isBuffering.value = false }
function onTimeUpdate() {
  if (!isSeeking) videoCurrentTime.value = videoEl.value?.currentTime || 0
  checkChoicePopup()
}
function onDurationChange() {
  videoDuration.value = Number.isFinite(videoEl.value?.duration) ? videoEl.value.duration : 0
}
function onEnded() {
  // 循环模式：重新播放
  if (isLooping.value) {
    const v = videoEl.value
    if (v) { v.currentTime = 0; v.play() }
    return
  }

  const scene = game.currentScene
  if (!scene) return

  // 最后一个场景（结局场景）：跳转结束页
  if (scene.is_ending || !scene.choices || scene.choices.length === 0) {
    router.push('/ending')
    return
  }

  // 非结局场景：视频结束兜底弹出选项
  if (!choicesActive.value) {
    showChoices(scene.choices, scene.choice_timer)
  }
}

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) v.play()
  else v.pause()
}

function replayScene() {
  const v = videoEl.value
  if (!v) return
  v.currentTime = 0
  v.play()
}

function skipScene() {
  const v = videoEl.value
  if (!v) return
  // 跳到视频末尾，触发 onEnded 逻辑
  v.currentTime = (videoDuration.value || v.duration || 0) - 0.1
}

function toggleLoop() {
  isLooping.value = !isLooping.value
}

function setSpeed(rate) {
  playbackRate.value = rate
  if (videoEl.value) videoEl.value.playbackRate = rate
  showSpeedMenu.value = false
}

async function toggleFullscreen() {
  const v = videoEl.value
  // 退出全屏
  if (document.fullscreenElement || (v && v.webkitDisplayingFullscreen)) {
    if (document.exitFullscreen) await document.exitFullscreen().catch(() => {})
    if (v?.webkitExitFullscreen) v.webkitExitFullscreen()
    // 解锁屏幕方向
    if (screen.orientation?.unlock) screen.orientation.unlock().catch(() => {})
    return
  }

  // 进入全屏
  // iOS Safari：仅 video 元素支持原生全屏，会自动横屏
  if (v?.webkitEnterFullscreen && !document.fullscreenEnabled) {
    v.webkitEnterFullscreen()
    return
  }

  // 标准 Fullscreen API（Android Chrome / 桌面）
  if (rootEl.value?.requestFullscreen) {
    await rootEl.value.requestFullscreen().catch(() => {})
  } else if (v?.webkitEnterFullscreen) {
    v.webkitEnterFullscreen()
  }

  // 移动端全屏后锁定横屏（iOS 不支持，Android Chrome 支持）
  if (screen.orientation?.lock) {
    screen.orientation.lock('landscape').catch(() => {})
  }
}

// ═══════════════════════════════════════════════════════════════
// 进度条 seek
// ═══════════════════════════════════════════════════════════════
function getSeekRatio(clientX) {
  const bar = progressBarEl.value
  if (!bar) return 0
  const rect = bar.getBoundingClientRect()
  const ratio = (clientX - rect.left) / rect.width
  return Math.min(1, Math.max(0, ratio))
}

function onSeekClick(e) {
  const v = videoEl.value
  if (!v || !videoDuration.value) return
  v.currentTime = getSeekRatio(e.clientX) * videoDuration.value
}

function onSeekStart(e) {
  const v = videoEl.value
  if (!v || !videoDuration.value) return
  isSeeking = true
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  videoCurrentTime.value = getSeekRatio(clientX) * videoDuration.value

  const onMove = (ev) => {
    const x = ev.touches ? ev.touches[0].clientX : ev.clientX
    videoCurrentTime.value = getSeekRatio(x) * videoDuration.value
  }
  const onEnd = () => {
    v.currentTime = videoCurrentTime.value
    isSeeking = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onEnd)
  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onEnd)
}

// ═══════════════════════════════════════════════════════════════
// 存档/读档
// ═══════════════════════════════════════════════════════════════
function openSaveLoad(mode) {
  showTopMenu.value = false
  saveLoadMode.value = mode
  saveLoadVisible.value = true
}

// ═══════════════════════════════════════════════════════════════
// 场景播放 + 选项逻辑
// ═══════════════════════════════════════════════════════════════
let playRequestId = 0

async function playScene() {
  const scene = game.currentScene
  if (!scene) return
  const reqId = ++playRequestId

  currentChoices.value = []
  choicesActive.value = false
  isBuffering.value = true
  videoCurrentTime.value = 0
  videoDuration.value = 0
  subtitleText.value = ''

  const v = videoEl.value
  if (!v) return
  v.currentTime = 0
  v.playbackRate = playbackRate.value

  if (scene.hls_url && scene.hls_status === 'done') {
    loadHlsStream(scene.hls_url)
  } else if (scene.file_path) {
    destroyHls()
    v.src = '/' + scene.file_path.replace(/\\/g, '/')
    v.load()
    v.play().catch(() => {})
  } else {
    isBuffering.value = false
    return
  }

  await nextTick()
  if (reqId !== playRequestId) return
  isBuffering.value = false
}

// 选项弹出检测
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
  // 选项不设倒计时，用户未选择则一直停留
}

async function onChoose(choiceId) {
  // 备份当前选项，积分不足取消时恢复
  const prevChoices = currentChoices.value
  const prevScene = game.currentScene
  choicesActive.value = false
  currentChoices.value = []

  const result = await game.makeChoice(choiceId)
  if (!result) return

  if (result.insufficientPoints) {
    const go = await confirm({
      title: '积分不足',
      message: `选择此选项需要 ${result.required} 💎，当前余额 ${result.current} 💎`,
      icon: '💎',
      confirmText: '去充值',
      cancelText: '取消'
    })
    if (go) {
      router.push('/profile')
    } else {
      // 取消：恢复选项，让用户重新选择
      if (game.currentScene === prevScene) {
        currentChoices.value = prevChoices
        choicesActive.value = true
      }
    }
    return
  }

  if (result.finished) {
    router.push('/ending')
  }
  // result.scene 情况：game.makeChoice 内部已 loadScene 更新 currentScene，
  // watch(currentScene) 会自动触发 playScene，无需手动调用
}

function onReturnToLobby() {
  playRequestId++
  showTopMenu.value = false
  destroyHls()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  game.returnToLobby()
  router.push('/')
}

function formatTime(sec) {
  if (!sec || !Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}

// ═══════════════════════════════════════════════════════════════
// 生命周期
// ═══════════════════════════════════════════════════════════════
function bindVideoEvents(el) {
  if (!el) return
  el.addEventListener('play', onPlay)
  el.addEventListener('pause', onPause)
  el.addEventListener('waiting', onWaiting)
  el.addEventListener('playing', onPlaying)
  el.addEventListener('timeupdate', onTimeUpdate)
  el.addEventListener('durationchange', onDurationChange)
  el.addEventListener('ended', onEnded)
}
function unbindVideoEvents(el) {
  if (!el) return
  el.removeEventListener('play', onPlay)
  el.removeEventListener('pause', onPause)
  el.removeEventListener('waiting', onWaiting)
  el.removeEventListener('playing', onPlaying)
  el.removeEventListener('timeupdate', onTimeUpdate)
  el.removeEventListener('durationchange', onDurationChange)
  el.removeEventListener('ended', onEnded)
}

watch(() => game.currentScene, (newScene) => {
  if (newScene) nextTick(() => playScene())
}, { immediate: true })

watch(videoEl, (el, oldEl) => {
  if (oldEl && oldEl !== el) unbindVideoEvents(oldEl)
  if (el) bindVideoEvents(el)
}, { immediate: true })

function onFullscreenChange() {
  // 用户按 ESC 退出全屏时，解锁屏幕方向
  if (!document.fullscreenElement && screen.orientation?.unlock) {
    screen.orientation.unlock().catch(() => {})
  }
}

onMounted(async () => {
  updateMobileDetection()
  window.addEventListener('resize', updateMobileDetection)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  const gameId = route.params.gameId
  if (gameId && !game.currentScene) {
    await game.startNewGame(parseInt(gameId) || gameId)
  }
  if (!game.currentScene) router.push('/')
})

onBeforeUnmount(() => {
  playRequestId++
  window.removeEventListener('resize', updateMobileDetection)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  unbindVideoEvents(videoEl.value)
  destroyHls()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  game.returnToLobby()
})
</script>

<style>
/* 隐藏 hls.js 原生渲染的字幕（我们通过 cuechange 监听自己渲染到 DOM） */
video::cue {
  visibility: hidden;
}
</style>
