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

          <!-- 道具（所有设备显示，面板向上弹出） -->
          <div class="relative shrink-0">
            <button @click="showPropPanel = !showPropPanel"
              class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white"
              title="道具">
              🎁
            </button>
            <div v-if="showPropPanel" class="fixed inset-0 z-40" @click="showPropPanel = false"></div>
            <div v-if="showPropPanel" class="absolute bottom-full right-0 mb-2 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl p-2 w-56 max-h-[70vh] overflow-y-auto">
              <div class="text-[11px] text-text-dimmer px-2 py-1">🎁 道具（使用扣除积分）</div>
              <!-- 效果道具组 -->
              <div v-if="effectProps.length">
                <div class="text-[10px] text-text-dimmest px-1 pt-1 pb-0.5 flex items-center gap-1">
                  <span>✨</span><span>效果</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5">
                  <button v-for="p in effectProps" :key="p.id" @click="useProp(p)"
                    class="flex flex-col items-center justify-center py-2 rounded-lg hover:bg-brand-purple/20 transition-colors border border-transparent hover:border-brand-purple/40"
                    :title="p.name">
                    <span class="text-xl leading-none">{{ p.icon }}</span>
                    <span class="text-[9px] text-text-dim mt-0.5">{{ p.point_cost > 0 ? '💎' + p.point_cost : '免费' }}</span>
                  </button>
                </div>
              </div>
              <!-- 幻想场景道具组 -->
              <div v-if="fantasyProps.length">
                <div class="text-[10px] text-brand-purple/80 px-1 pt-2 pb-0.5 flex items-center gap-1 border-t border-border-dim mt-1">
                  <span>🎬</span><span>幻想场景</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5">
                  <button v-for="p in fantasyProps" :key="p.id" @click="useProp(p)"
                    class="flex flex-col items-center justify-center py-2 rounded-lg hover:bg-brand-purple/20 transition-colors border border-brand-purple/30 bg-brand-purple/5"
                    :title="p.name + '（幻想场景）'">
                    <span class="text-xl leading-none">{{ p.icon }}</span>
                    <span class="text-[9px] text-brand-purple mt-0.5">{{ p.point_cost > 0 ? '💎' + p.point_cost : '免费' }}</span>
                  </button>
                </div>
              </div>
              <!-- 空状态 -->
              <div v-if="!effectProps.length && !fantasyProps.length" class="text-center py-6 text-[11px] text-text-dimmest">
                当前场景无可用道具
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

    <!-- ═══ 效果动画层 ═══ -->
    <div class="absolute inset-0 z-40 pointer-events-none overflow-hidden" :class="{ 'effect-shake': effectShake }">
      <div v-for="a in effectAnims" :key="a.id" class="prop-particle"
        :class="{
          'prop-confetti': a.shape === 'confetti',
          'prop-shell': a.shape === 'shell',
          'prop-yolk': a.shape === 'yolk',
          'prop-flesh': a.shape === 'flesh'
        }"
        :style="{
          '--x': a.x + 'px', '--y': a.y + 'px',
          '--tx': a.tx + 'px', '--ty': a.ty + 'px',
          '--tx2': a.tx2 + 'px', '--ty2': a.ty2 + 'px',
          '--arc-tx': a.arcTx + 'px', '--arc-ty': a.arcTy + 'px',
          '--rot': a.rot + 'deg', '--rot2': a.rot2 + 'deg',
          '--arc-rot': a.arcRot + 'deg',
          '--scale': a.scale, '--scale2': a.scale2,
          '--dur': a.dur + 's', '--delay': a.delay + 's',
          '--end-op': a.endOp, '--anim': 'pp-' + a.anim,
          '--size': a.size + 'px',
          left: a.x + 'px', top: a.y + 'px',
          fontSize: a.size + 'px',
          color: a.color
        }">
        <span v-if="a.shape === 'emoji'" class="prop-icon">{{ a.icon }}</span>
      </div>
    </div>

    <!-- ═══ 幻想场景播放器 ═══ -->
    <div v-if="fantasyPlaying" class="absolute inset-0 z-50 bg-black flex items-center justify-center">
      <video ref="fantasyVideoEl" class="w-full h-full object-contain" autoplay playsinline @ended="onFantasyEnded"></video>
      <div class="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 rounded-full text-xs text-white/80 whitespace-nowrap">
        🎬 幻想场景 · 播放结束后自动返回
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
import { useAuthStore } from '../stores/auth'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import SaveLoadModal from '../components/SaveLoadModal.vue'

const route = useRoute()
const router = useRouter()
const game = useGameStore()
const { confirm } = useConfirm()
const langStore = useLangStore()
const { get, post } = useApi()
const toast = useToast()

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

// ═══ 道具系统 ═══
const propList = ref([])
const showPropPanel = ref(false)
// 按类型分组：效果道具(通用)、幻想场景道具(绑定到当前场景)
const effectProps = computed(() => propList.value.filter(p => p.type !== 'fantasy'))
const fantasyProps = computed(() => propList.value.filter(p => p.type === 'fantasy'))
const effectAnims = ref([])  // 粒子数组 { id, x, y, tx, ty, rot, scale, dur, delay, endOp, anim, size, color, icon, shape }
let animSeq = 0
const effectShake = ref(false)
let shakeTimer = null
const fantasyPlaying = ref(false)
const fantasyVideoEl = ref(null)
let fantasyHls = null
let fantasyResumeAt = 0  // 主视频暂停位置（秒）

const PROP_COLORS = ['#ff6b9d', '#7c3aed', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#facc15', '#fb923c', '#22d3ee', '#a78bfa']

function rand(min, max) { return min + Math.random() * (max - min) }

function triggerShake() {
  effectShake.value = true
  if (shakeTimer) clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => { effectShake.value = false }, 480)
}

async function loadProps(sceneId) {
  try {
    const params = sceneId ? { scene_id: sceneId } : {}
    const r = await get('/props/available', params)
    propList.value = r.props || []
  } catch (e) {}
}

// 使用道具
async function useProp(p) {
  if (!p) return
  showPropPanel.value = false
  const cost = p.point_cost || 0
  if (cost > 0) {
    const ok = await confirm({
      title: '使用道具',
      message: `使用「${p.icon} ${p.name}」将扣除 ${cost} 💎，确定使用吗？`,
      icon: p.icon,
      confirmText: '使用',
      cancelText: '取消'
    })
    if (!ok) return
  }
  let res
  try {
    res = await post('/props/' + p.id + '/use', {
      scene_id: game.currentScene?.id || null
    })
  } catch (e) {
    if (e.status === 402) {
      const go = await confirm({
        title: '积分不足',
        message: e.message || '积分不足',
        icon: '💎',
        confirmText: '去充值',
        cancelText: '取消'
      })
      if (go) router.push('/profile')
    } else {
      toast.show(e.message)
    }
    return
  }
  if (res.error) { toast.show(res.error); return }
  if (res.points_balance !== undefined) {
    const auth = useAuthStore()
    if (auth.user) auth.user.points = res.points_balance
  }
  if (p.type === 'fantasy') {
    playFantasy(res.video)
  } else {
    spawnEffect(p)
  }
}

// 效果动画（粒子系统）
function spawnEffect(p) {
  const el = rootEl.value
  const w = el ? el.clientWidth : window.innerWidth
  const h = el ? el.clientHeight : window.innerHeight
  const cx = Math.round(w * (0.3 + Math.random() * 0.4))
  const cy = Math.round(h * (0.22 + Math.random() * 0.3))
  const type = p.animation || 'confetti'

  const push = (opts) => {
    const id = ++animSeq
    // 抛物线顶点（55% 处）：x 走到 55%，y 在线性基础上再向上拱起 arc 高度
    const arc = opts.arc || 0
    const arcTx = Math.round((opts.tx || 0) * 0.55)
    const arcTy = Math.round((opts.ty || 0) * 0.55 - arc)
    const arcRot = Math.round((opts.rot || 0) * 0.5)
    effectAnims.value.push({
      id,
      x: opts.x, y: opts.y,
      tx: opts.tx || 0, ty: opts.ty || 0,
      rot: opts.rot || 0, scale: opts.scale || 1,
      // 预计算轨迹中间点（70% 位置轻微过冲），避免 CSS calc 乘法兼容问题
      tx2: Math.round((opts.tx || 0) * 0.92),
      ty2: Math.round((opts.ty || 0) * 0.92),
      rot2: Math.round((opts.rot || 0) * 0.8),
      scale2: (opts.scale || 1) * 1.18,
      // 抛物线顶点（toss 动画专用）
      arcTx, arcTy, arcRot,
      dur: opts.dur || 1.2, delay: opts.delay || 0,
      endOp: opts.endOp ?? 0, anim: opts.anim || 'fly',
      size: opts.size || 40,
      color: opts.color || '#ffffff',
      icon: opts.icon || p.icon,
      shape: opts.shape || 'emoji'
    })
    // 按粒子自身寿命清理（dur + delay + 缓冲），避免长期堆积
    const lifeMs = ((opts.dur || 1.2) + (opts.delay || 0)) * 1000 + 300
    setTimeout(() => {
      effectAnims.value = effectAnims.value.filter(a => a.id !== id)
    }, lifeMs)
  }

  const color = PROP_COLORS[Math.floor(Math.random() * PROP_COLORS.length)]

  switch (type) {
    case 'egg':
    case 'tomato': {
      // 投掷：从屏幕底部一侧（左/右随机）抛物线飞向目标点，落地碎裂 + 震屏
      // 落地坐标 = (cx, cy+100)，碎片从这里飞出，震屏在落地瞬间触发
      const fromLeft = Math.random() > 0.5
      const startX = fromLeft ? -50 : w + 50       // 起点：屏幕左/右下角外
      const startY = h - 40                         // 起点：贴近底部（投掷者位置）
      const impactX = cx
      const impactY = cy + 100
      const tx = impactX - startX                   // 横向位移（投向屏幕中部）
      const ty = impactY - startY                   // 纵向位移（向上飞）
      const arc = Math.round(h * 0.28)              // 抛物线顶点高度（屏幕高度的 28%）
      const rotDir = fromLeft ? 1 : -1              // 旋转方向跟随投掷方向
      push({
        x: startX, y: startY,
        tx, ty, arc,
        rot: rotDir * 720, scale: 1.15,
        dur: 0.72, anim: 'toss', endOp: 0, size: 56
      })
      setTimeout(() => {
        // 落地瞬间：震屏 + 碎片四散
        triggerShake()
        if (type === 'egg') {
          // 蛋壳碎片四散
          for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2
            const dist = rand(70, 200)
            push({
              x: impactX, y: impactY, tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
              rot: rand(-420, 420), scale: rand(0.6, 1.1),
              dur: rand(0.8, 1.2), delay: rand(0, 0.08),
              size: rand(14, 24),
              color: '#fffdf5', shape: 'shell'
            })
          }
          // 蛋液飞溅（带重力感，向下偏）
          for (let i = 0; i < 6; i++) {
            const ang = -Math.PI / 2 + rand(-1.2, 1.2)
            const dist = rand(50, 140)
            push({
              x: impactX, y: impactY,
              tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist + rand(40, 90),
              rot: rand(-120, 120), scale: rand(0.7, 1.2),
              dur: rand(0.9, 1.4), delay: rand(0, 0.12),
              size: rand(10, 18),
              color: '#ffca28', shape: 'yolk'
            })
          }
        } else {
          // 番茄：红色果肉碎片
          for (let i = 0; i < 10; i++) {
            const ang = Math.random() * Math.PI * 2
            const dist = rand(60, 190)
            push({
              x: impactX, y: impactY, tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
              rot: rand(-360, 360), scale: rand(0.5, 1),
              dur: rand(0.7, 1.1), delay: rand(0, 0.1),
              size: rand(16, 30),
              color: ['#e53935', '#ef5350', '#c62828', '#ff6f60'][i % 4],
              shape: 'flesh'
            })
          }
          // 番茄汁液飞溅（更小更亮）
          for (let i = 0; i < 6; i++) {
            const ang = -Math.PI / 2 + rand(-1.2, 1.2)
            const dist = rand(40, 120)
            push({
              x: impactX, y: impactY,
              tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist + rand(30, 70),
              rot: rand(-100, 100), scale: rand(0.6, 1),
              dur: rand(0.8, 1.2), delay: rand(0, 0.1),
              size: rand(8, 14),
              color: '#ff5252',
              shape: 'flesh'
            })
          }
        }
      }, 660)  // 匹配 toss 动画 0.72s 的落地时刻（约 92% 处）
      break
    }
    case 'flower':
    case 'heart':
    case 'star': {
      // 一簇从底部向上飘
      for (let i = 0; i < 14; i++) {
        push({
          x: cx + rand(-50, 50), y: cy + 260,
          tx: rand(-110, 110), ty: -rand(340, 560),
          rot: rand(-80, 80), scale: rand(0.6, 1.25),
          dur: rand(1.5, 2.3), delay: rand(0, 0.3),
          size: rand(28, 58),
          color: type === 'flower' ? PROP_COLORS[i % PROP_COLORS.length] : '#ffffff'
        })
      }
      break
    }
    case 'confetti': {
      // 彩色纸屑从顶部撒落
      for (let i = 0; i < 32; i++) {
        push({
          x: rand(w * 0.05, w * 0.95), y: -20,
          tx: rand(-140, 140), ty: h + 50,
          rot: rand(-720, 720), scale: 1,
          dur: rand(1.6, 2.9), delay: rand(0, 0.45),
          size: 10,
          color: PROP_COLORS[i % PROP_COLORS.length],
          shape: 'confetti'
        })
      }
      break
    }
    case 'firework': {
      // 中心绽放 + 光点四散 + 震屏
      triggerShake()
      push({ x: cx, y: cy, tx: 0, ty: 0, scale: 0.35, dur: 0.45, anim: 'pop', endOp: 1, size: 26, color: '#ffffff' })
      setTimeout(() => {
        for (let i = 0; i < 20; i++) {
          const ang = (i / 20) * Math.PI * 2 + rand(-0.07, 0.07)
          const dist = rand(130, 280)
          push({
            x: cx, y: cy,
            tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
            rot: 0, scale: rand(0.5, 1.05),
            dur: rand(0.8, 1.4), delay: 0,
            size: rand(10, 20),
            color: PROP_COLORS[i % PROP_COLORS.length],
            anim: 'spark'
          })
        }
      }, 360)
      break
    }
    case 'coin': {
      // 金币雨
      triggerShake()
      for (let i = 0; i < 10; i++) {
        push({
          x: cx + rand(-110, 110), y: -40 - i * 45,
          tx: rand(-60, 60), ty: h * 0.5 + rand(0, 160),
          rot: rand(-420, 420), scale: rand(0.8, 1.25),
          dur: rand(1.2, 1.9), delay: rand(0, 0.15),
          size: rand(32, 48),
          color: '#facc15'
        })
      }
      break
    }
    default: {
      // 通用爆发
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2
        const dist = rand(80, 220)
        push({
          x: cx, y: cy,
          tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
          rot: rand(-360, 360), scale: rand(0.6, 1.3),
          dur: rand(1, 1.8), delay: rand(0, 0.2),
          size: rand(24, 50), color
        })
      }
    }
  }

  // 粒子已由 push() 直接推入 effectAnims 并按各自寿命自动清理
}

// 幻想场景播放
async function playFantasy(video) {
  if (!video) { toast.show('幻想场景视频不存在'); return }
  // 暂停主视频并记录位置
  const mainVideo = videoEl.value
  if (mainVideo) {
    fantasyResumeAt = mainVideo.currentTime || 0
    mainVideo.pause()
  }
  fantasyPlaying.value = true
  await nextTick()
  const fv = fantasyVideoEl.value
  if (!fv) return
  // 有 HLS 用 hls.js，否则直接 mp4
  let src = ''
  if (video.hls_status === 'done' && video.hls_master_path) {
    src = '/' + video.hls_master_path.replace(/\\/g, '/')
  } else {
    src = '/' + (video.file_path || '').replace(/\\/g, '/')
  }
  if (Hls.isSupported() && video.hls_status === 'done') {
    fantasyHls = new Hls({ renderTextTracksNatively: true })
    fantasyHls.loadSource(src)
    fantasyHls.attachMedia(fv)
  } else {
    fv.src = src
  }
  fv.play().catch(() => {})
}

function onFantasyEnded() {
  // 销毁幻想 HLS
  if (fantasyHls) { try { fantasyHls.destroy() } catch(e) {} fantasyHls = null }
  fantasyPlaying.value = false
  // 恢复主视频到暂停位置
  const mainVideo = videoEl.value
  if (mainVideo) {
    mainVideo.currentTime = fantasyResumeAt
    mainVideo.play().catch(() => {})
  }
}

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
  if (newScene) {
    nextTick(() => playScene())
    // 场景切换后重新加载该场景可用道具（按 scene_id 过滤）
    loadProps(newScene.id)
  }
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
  // 道具加载由 watch(currentScene) 触发，按场景 ID 过滤
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
  if (fantasyHls) { try { fantasyHls.destroy() } catch(e) {} fantasyHls = null }
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

/* ═══ 道具效果动画（粒子系统） ═══ */
.prop-particle {
  position: absolute;
  transform: translate(-50%, -50%);
  line-height: 1;
  animation: var(--anim) var(--dur) cubic-bezier(0.22, 0.9, 0.35, 1) var(--delay) forwards;
  will-change: transform, opacity;
  z-index: 50;
  text-shadow: 0 0 14px currentColor, 0 0 34px currentColor;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.35));
  pointer-events: none;
}
.prop-icon {
  display: block;
  line-height: 1;
}
/* 彩色纸屑粒子 */
.prop-confetti {
  width: 10px;
  height: 6px;
  background: currentColor;
  border-radius: 1px;
  box-shadow: 0 0 8px currentColor, 0 0 18px currentColor;
  font-size: 0 !important;
}
/* 蛋壳碎片 */
.prop-shell {
  width: var(--size);
  height: calc(var(--size) * 0.85);
  background: linear-gradient(135deg, #fffdf5 0%, #f5e9c8 100%);
  border-radius: 30% 60% 40% 50%;
  box-shadow: inset 0 0 3px rgba(180, 140, 60, 0.25);
  font-size: 0 !important;
}
/* 蛋液 */
.prop-yolk {
  width: calc(var(--size) * 0.8);
  height: calc(var(--size) * 0.8);
  background: radial-gradient(circle at 35% 35%, #ffe082 0%, #ffca28 60%, #ffb300 100%);
  border-radius: 50% 55% 45% 60%;
  box-shadow: 0 0 12px rgba(255, 193, 7, 0.7), 0 0 24px rgba(255, 193, 7, 0.35);
  font-size: 0 !important;
}
/* 番茄果肉碎片（颜色由 currentColor 控制） */
.prop-flesh {
  width: var(--size);
  height: calc(var(--size) * 0.9);
  background: radial-gradient(circle at 40% 35%, rgba(255, 255, 255, 0.55) 0%, currentColor 55%, rgba(0, 0, 0, 0.15) 100%);
  border-radius: 45% 55% 60% 40%;
  box-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
  font-size: 0 !important;
}

/* 通用飞行动画：从起点位移到 (--tx, --ty)，70% 处轻微过冲 */
@keyframes pp-fly {
  0%   { transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0; }
  12%  { opacity: 1; }
  70%  { transform: translate(calc(-50% + var(--tx2)), calc(-50% + var(--ty2))) scale(var(--scale2)) rotate(var(--rot2)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)) rotate(var(--rot)); opacity: var(--end-op); }
}
/* 砸落：更快的进场 + 高速旋转 + 拖影 */
@keyframes pp-throw {
  0%   { transform: translate(-50%, -50%) scale(0.5) rotate(0deg); opacity: 0; }
  6%   { opacity: 1; }
  60%  { transform: translate(calc(-50% + var(--tx2)), calc(-50% + var(--ty2))) scale(var(--scale2)) rotate(var(--rot2)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)) rotate(var(--rot)); opacity: var(--end-op); }
}
/* 投掷：从一侧抛物线飞向目标，55% 处到达顶点（y 向上拱起 arc） */
@keyframes pp-toss {
  0%   { transform: translate(-50%, -50%) scale(0.65) rotate(0deg); opacity: 0; }
  8%   { opacity: 1; }
  /* 抛物线顶点：x 走到 55%，y 在线性基础上向上拱起 arc 高度 */
  55%  { transform: translate(calc(-50% + var(--arc-tx)), calc(-50% + var(--arc-ty))) scale(1.18) rotate(var(--arc-rot)); opacity: 1; }
  92%  { transform: translate(calc(-50% + var(--tx) * 0.98), calc(-50% + var(--ty) * 0.98)) scale(1.15) rotate(calc(var(--rot) * 0.95)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)) rotate(var(--rot)); opacity: var(--end-op); }
}
/* 烟花中心爆闪 */
@keyframes pp-pop {
  0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
  60%  { transform: translate(-50%, -50%) scale(1.6); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
}
/* 烟花光点：直线四散 + 拉长发光 */
@keyframes pp-spark {
  0%   { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
  25%  { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)); opacity: 0; }
}

/* 屏幕震动 */
.effect-shake {
  animation: screen-shake 0.45s ease-out;
}
@keyframes screen-shake {
  0%   { transform: translate(0, 0); }
  15%  { transform: translate(-8px, 5px); }
  30%  { transform: translate(7px, -6px); }
  45%  { transform: translate(-6px, -4px); }
  60%  { transform: translate(5px, 6px); }
  75%  { transform: translate(-3px, 2px); }
  100% { transform: translate(0, 0); }
}
</style>
