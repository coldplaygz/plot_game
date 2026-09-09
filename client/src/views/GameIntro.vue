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
  // 重新开始会覆盖自动存档（过场景时自动保存），有存档时二次确认
  if (autoSaveInfo.value) {
    if (window.confirm('重新开始将覆盖当前进度，确定吗？')) {
      game.cleanup()
      router.push('/play/' + gameId)
    }
  } else {
    router.push('/play/' + gameId)
  }
}

async function onContinue() {
  const ok = await game.continueGame(gameId)
  if (ok) router.push('/game')
  else toast.show('暂时无法恢复进度')
}

function goHome() {
  router.push('/')
}
</script>
