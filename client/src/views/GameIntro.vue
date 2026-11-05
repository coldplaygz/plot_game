<template>
  <div class="fixed inset-0 bg-black overflow-hidden select-none" @click="onScreenClick">
    <!-- ═══ 背景：封面视频 / 封面图 / 渐变占位 ═══ -->
    <video
      v-if="coverVideoUrl"
      ref="videoEl"
      :src="coverVideoUrl"
      autoplay
      playsinline
      preload="auto"
      class="absolute inset-0 w-full h-full object-cover"
      @ended="onEnded"
      @timeupdate="onTimeUpdate"
      @error="onVideoError"
      @loadedmetadata="tryPlay"
    ></video>
    <img v-else-if="gameInfo?.cover_image" :src="'/' + gameInfo.cover_image" :alt="gameInfo.title"
      class="absolute inset-0 w-full h-full object-cover" />
    <div v-else class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-purple/30 via-surface-dark to-brand-cyan/20">
      <span class="text-8xl font-bold text-white/15">{{ gameInfo?.title?.charAt(0) || '?' }}</span>
    </div>

    <!-- 顶部渐变 + 返回 -->
    <div class="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)] pb-6 bg-gradient-to-b from-black/70 to-transparent">
      <button @click.stop="goHome"
        class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white shrink-0"
        title="返回首页">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <span class="flex-1 truncate text-sm text-white/70">{{ gameInfo?.title }}</span>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
      <div class="w-10 h-10 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
    </div>

    <!-- 播放中提示（点击跳过，菜单显示前） -->
    <div v-if="!menuVisible && !loading && coverVideoUrl && !videoFailed"
      class="absolute bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 bg-black/45 rounded-full text-xs text-white/70 whitespace-nowrap pointer-events-none">
      点击画面跳过
    </div>

    <!-- ═══ 开始游戏菜单（位置由后台 menu_position 配置） ═══ -->
    <div v-if="menuVisible" class="absolute inset-0 z-30 flex p-6 sm:p-10" :class="menuPosClass">
      <div class="w-[300px] max-w-full bg-black/55 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl self-center">
        <h2 class="text-xl font-bold text-white text-center mb-1">{{ gameInfo?.title }}</h2>
        <p v-if="gameInfo?.category" class="text-xs text-text-dim text-center mb-5">{{ gameInfo.category }}</p>
        <div v-else class="mb-5"></div>

        <div class="flex flex-col gap-2.5">
          <!-- 继续游戏：读取该游戏最近的自动存档 -->
          <button v-if="autoSaveInfo" @click.stop="onContinue"
            class="w-full py-3 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-xl text-sm font-bold hover:opacity-90 active:opacity-80 transition-opacity">
            ▶ 继续游戏
          </button>

          <!-- 开始新游戏 -->
          <button @click.stop="onStart"
            class="w-full py-3 rounded-xl text-sm font-bold transition-colors"
            :class="autoSaveInfo ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-gradient-to-r from-brand-purple to-brand-pink text-white hover:opacity-90'">
            {{ autoSaveInfo ? '🆕 重新开始' : '开始游戏' }}
          </button>

          <!-- 返回首页 -->
          <button @click.stop="goHome"
            class="w-full py-3 bg-transparent border border-border-dim text-text-muted rounded-xl text-sm hover:border-brand-purple hover:text-white transition-colors">
            返回首页
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ 角色命名弹窗（开始新游戏时; 支持随机生成; 名字随档保存并显示在属性栏） ═══ -->
    <div v-if="namingModal" class="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">

      <!-- 第一段：命名（已有进度时，"开始游戏"会先进入第二段的覆盖确认） -->
      <div v-if="!confirmOverwrite" class="w-[320px] max-w-full bg-[#12121a]/95 border border-amber-200/25 rounded-2xl p-6 shadow-2xl">
        <div class="flex justify-center mb-3">
          <span class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-300/25 to-amber-500/10 border border-amber-200/30 flex items-center justify-center text-lg">🎭</span>
        </div>
        <h3 class="text-lg font-bold text-white text-center">为你的角色命名</h3>
        <p class="text-xs text-text-dim text-center mt-1 mb-4">这个名字将随你的冒险一起被记录</p>
        <div class="flex items-center gap-2 mb-4">
          <input v-model="nameInput" maxlength="24" placeholder="输入角色名"
            class="flex-1 min-w-0 px-3 py-2.5 bg-black/40 border border-amber-200/30 rounded-xl text-white text-sm text-center placeholder-white/30 focus:outline-none focus:border-amber-300/60 transition-colors"
            @keyup.enter="onPrimaryAction" />
          <button @click.stop="nameInput = game.randomPlayerName()" title="随机生成"
            class="shrink-0 w-10 h-10 rounded-xl border border-amber-200/30 bg-white/5 text-amber-300 hover:bg-amber-400/15 active:scale-95 transition-all">🎲</button>
        </div>
        <div class="flex gap-2">
          <button @click.stop="namingModal = false"
            class="flex-1 py-2.5 rounded-xl border border-border-dim text-text-muted text-sm hover:border-white/40 hover:text-white transition-colors">取消</button>
          <button @click.stop="onPrimaryAction" :disabled="!nameInput.trim()"
            class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black text-sm font-bold disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity">
            {{ autoSaveInfo ? '重新开始' : '开始游戏' }}
          </button>
        </div>
      </div>

      <!-- 第二段：覆盖进度确认（危险操作醒目化: 列出将丢失的内容） -->
      <div v-else class="w-[320px] max-w-full bg-[#1a1013]/95 border border-red-400/35 rounded-2xl p-6 shadow-[0_0_40px_-8px_rgba(248,113,113,0.45)]">
        <div class="flex justify-center mb-3">
          <span class="w-11 h-11 rounded-full bg-red-500/15 border border-red-400/40 flex items-center justify-center text-lg">⚠️</span>
        </div>
        <h3 class="text-lg font-bold text-white text-center">覆盖当前进度？</h3>
        <p class="text-xs text-red-200/70 text-center mt-1 mb-4">重新开始将开始全新的冒险，以下内容会丢失且无法恢复</p>

        <div class="rounded-xl bg-black/35 border border-red-400/20 p-3 mb-4 flex flex-col gap-2">
          <div class="flex items-center gap-2 text-xs">
            <span class="text-red-300/80">◆</span>
            <span class="text-white/55">当前进度</span>
            <span class="ml-auto text-white/80 truncate max-w-[55%] text-right">{{ continueLabel }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="text-red-300/80">◆</span>
            <span class="text-white/55">角色属性</span>
            <span class="ml-auto text-white/80">重置为初始值</span>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="text-red-300/80">◆</span>
            <span class="text-white/55">对白选择记录</span>
            <span class="ml-auto text-white/80">清空</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click.stop="confirmOverwrite = false"
            class="flex-1 py-2.5 rounded-xl border border-white/25 text-white text-sm font-medium hover:bg-white/10 transition-colors">返回</button>
          <button @click.stop="doRestart"
            class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-bold hover:opacity-90 active:opacity-80 transition-opacity">确认覆盖</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const game = useGameStore()
const { get } = useApi()
const toast = useToast()

const gameId = parseInt(route.params.gameId)
const loading = ref(true)
const gameInfo = ref(null)
const autoSaveInfo = ref(null)
const menuVisible = ref(false)
const videoFailed = ref(false)
const videoEl = ref(null)
const namingModal = ref(false)  // 角色命名弹窗
const confirmOverwrite = ref(false)  // 弹窗第二段：覆盖进度确认
const nameInput = ref('')

// 封面视频地址（编辑期间转码未完成可能不可播，失败时回退封面图）
const coverVideoUrl = computed(() => {
  if (!gameInfo.value?.cover_video_path || videoFailed.value) return ''
  return '/' + gameInfo.value.cover_video_path.replace(/\\/g, '/')
})

// 尾段循环秒数（后台可配置，0 = 整段循环）
const tailSeconds = computed(() => {
  const t = parseInt(gameInfo.value?.intro_tail_seconds)
  return Number.isFinite(t) && t >= 0 ? t : 3
})

// 开始菜单显示位置（后台可配置，九宫格）
const menuPosClass = computed(() => {
  const map = {
    center: 'items-center justify-center',
    top: 'items-start justify-center pt-[12vh]',
    bottom: 'items-end justify-center pb-[12vh]',
    left: 'items-center justify-start',
    right: 'items-center justify-end',
    'top-left': 'items-start justify-start pt-[12vh]',
    'top-right': 'items-start justify-end pt-[12vh]',
    'bottom-left': 'items-end justify-start pb-[12vh]',
    'bottom-right': 'items-end justify-end pb-[12vh]'
  }
  return map[gameInfo.value?.menu_position] || map.center
})

onMounted(async () => {
  if (!gameId) { router.replace('/'); return }
  try {
    const res = await get('/games/' + gameId)
    if (res.error || !res.game) { toast.show(res.error || '游戏不存在'); router.replace('/'); return }
    gameInfo.value = res.game
    // 查询该游戏的自动存档（决定是否显示"继续游戏"）
    try {
      const sr = await get('/saves/auto', { game_id: gameId })
      if (sr.save && sr.save.scene_id) autoSaveInfo.value = sr.save
    } catch (e) { /* 无存档 */ }
    // 无封面视频（或已失败回退）→ 直接显示菜单
    if (!res.game.cover_video_path) showMenu()
  } catch (e) {
    toast.show(e.message || '加载失败')
    router.replace('/')
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (videoEl.value) videoEl.value.pause()
})

// 元数据加载标记 + 时长缓存
// 线上公网抖动时浏览器会静默重新拉取视频（不触发 error），currentTime 归零、
// loadedmetadata 二次触发——若放任 tryPlay 直接 play() 会从片头重播，打断尾段循环
let metadataLoaded = false
let knownDuration = 0

// 尝试有声播放，被浏览器自动播放策略拦截时降级为静音播放
function tryPlay() {
  const v = videoEl.value
  if (!v) return
  if (Number.isFinite(v.duration) && v.duration > 0) knownDuration = v.duration
  if (metadataLoaded) {
    // 中途重新加载（网络抖动后浏览器自动重试）：不重头播放，恢复尾段循环
    if (menuVisible.value && !v.loop) restartTailLoop()
    return
  }
  metadataLoaded = true
  v.play().catch(() => {
    v.muted = true
    v.play().catch(() => {})
  })
}

function onVideoError() {
  videoFailed.value = true
  showMenu()
}

// 显示菜单并让封面视频进入尾段循环（作为菜单动态背景）
function showMenu() {
  if (menuVisible.value) return
  menuVisible.value = true
  const v = videoEl.value
  if (!v) return
  const tail = tailSeconds.value
  if (tail <= 0 || !Number.isFinite(v.duration) || v.duration <= tail) {
    // 尾段配置为 0 或视频比尾段还短 → 整段循环（原生 loop，无接缝）
    v.loop = true
    v.currentTime = 0
    v.play().catch(() => {})
  } else {
    v.loop = false
    restartTailLoop()
  }
}

// 视频自然结束：菜单未显示 → 首次进入菜单；菜单已显示 → 兜底重启尾段循环
// （timeupdate 拦截窗口 0.15s 小于其触发间隔 ~0.25s，存在漏拦竞态，
//   转码后视频的时间轴对齐不同会触发，表现为循环若干次后卡在结尾）
function onEnded() {
  if (!menuVisible.value) { showMenu(); return }
  if (videoEl.value?.loop) return
  restartTailLoop()
}

// 安全重启尾段循环：ended 状态下直接 seek+play 有二次竞态（play 可能先于
// seek 完成执行，立即再次触发 ended），先 pause 退出 ended 状态再走 seeked→play
// duration 用 knownDuration 兜底：加载中断瞬间 v.duration 可能瞬时为 0，
// 会让 target 误算成 0 → 重头播放
function restartTailLoop() {
  const v = videoEl.value
  const dur = (Number.isFinite(v?.duration) && v.duration > 0) ? v.duration : knownDuration
  if (!v || !Number.isFinite(dur) || dur <= 0) return
  const tail = tailSeconds.value
  const target = (tail <= 0 || dur <= tail) ? 0 : Math.max(0, dur - tail)
  if (Math.abs(v.currentTime - target) < 0.05) { v.play().catch(() => {}); return }
  v.pause()
  v.addEventListener('seeked', () => v.play().catch(() => {}), { once: true })
  v.currentTime = target
}

// 尾段循环：播放到末尾前回跳，避免 ended 造成的停顿
function onTimeUpdate() {
  const v = videoEl.value
  if (!v || !menuVisible.value || v.loop) return
  const tail = tailSeconds.value
  if (tail <= 0 || !Number.isFinite(v.duration)) return
  if (v.currentTime >= v.duration - 0.15) {
    v.currentTime = Math.max(0, v.duration - tail)
  }
}

// 播放中点击画面 → 直接进入菜单（跳过剩余封面播放）
function onScreenClick() {
  if (!menuVisible.value && !loading.value) showMenu()
}

function onStart() {
  // 打开命名弹窗: 开始新游戏前为角色命名(可随机生成), 确认后才进入
  nameInput.value = game.playerName || game.randomPlayerName()
  confirmOverwrite.value = false
  namingModal.value = true
}

// 第一段"开始游戏/重新开始"按钮：无进度直接开始；有进度先进入覆盖确认
function onPrimaryAction() {
  const name = nameInput.value.trim()
  if (!name) return
  if (autoSaveInfo.value) {
    confirmOverwrite.value = true   // 第二段：覆盖确认
    return
  }
  doRestart()
}

// 真正开始新游戏（当前场景/属性/对白记忆将被重置）
function doRestart() {
  game.cleanup()
  game.pendingPlayerName = nameInput.value.trim()  // GamePlayer 挂载 startNewGame 时消费
  namingModal.value = false
  confirmOverwrite.value = false
  // ?new=1: 显式新开一局（GamePlayer 挂载默认是"继续游戏", 必须用标记区分）
  router.push({ path: '/play/' + gameId, query: { new: '1' } })
}

// 被覆盖的进度描述（确认弹窗里展示"当前进度"具体是什么）
const continueLabel = computed(() => {
  const s = autoSaveInfo.value
  if (!s) return '—'
  const t = s.scene_title || s.title || '已开始的剧情'
  const time = s.play_time ? ' · ' + Math.max(1, Math.round(s.play_time / 60)) + ' 分钟' : ''
  return t + time
})

async function onContinue() {
  const ok = await game.continueGame(gameId)
  if (ok) router.push('/game')
  else toast.show('暂时无法恢复进度')
}

function goHome() {
  router.push('/')
}
</script>
