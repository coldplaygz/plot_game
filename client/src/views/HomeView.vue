<template>
  <div class="flex flex-col min-h-screen bg-surface-darkest">
    <!-- Top Bar -->
    <header class="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border-dim bg-surface-dark/50 backdrop-blur-sm sticky top-0 z-10">
      <div class="flex items-center gap-2 sm:gap-3">
        <h1 class="text-base sm:text-xl font-bold bg-gradient-to-br from-brand-pink3 via-brand-purple to-brand-cyan bg-clip-text text-transparent truncate">
          {{ siteName }}
        </h1>
        <span class="hidden sm:inline text-xs text-text-dim shrink-0">AI驱动的互动影像体验</span>
      </div>
      <div class="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm shrink-0">
        <LangSelector />
        <template v-if="auth.isLoggedIn">
          <span class="text-text-dim hidden sm:inline">{{ auth.user?.nickname || auth.user?.username }}</span>
          <span class="text-text-dimmer text-xs">💎{{ auth.user?.points || 0 }}</span>
          <router-link to="/profile" class="text-brand-purple hover:text-brand-purple-dark transition-colors">个人中心</router-link>
          <button @click="goHome" class="text-brand-purple hover:text-brand-purple-dark transition-colors">首页</button>
          <button @click="handleLogout" class="text-text-dimmest hover:text-red-500 transition-colors">退出</button>
        </template>
        <template v-else>
          <router-link to="/login" class="text-text-dim hover:text-white transition-colors">登录</router-link>
          <router-link to="/login" class="px-3 sm:px-4 py-1.5 bg-brand-purple text-white rounded-lg hover:bg-brand-purple-dark transition-colors">注册</router-link>
        </template>
      </div>
    </header>

    <!-- Waterfall Gallery -->
    <main class="flex-1 px-3 sm:px-6 py-6 sm:py-8">
      <div v-if="loading" class="text-center py-20 text-text-dim">加载中...</div>
      <div v-else-if="games.length === 0" class="text-center py-20 text-text-dimmer">
        <p class="text-lg mb-2">暂无可用游戏</p>
        <p class="text-sm">请联系管理员添加游戏内容</p>
      </div>
      <div
        v-else
        class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 sm:gap-5"
      >
        <div
          v-for="game in games"
          :key="game.id"
          @click="goPlay(game)"
          class="break-inside-avoid mb-4 sm:mb-5 bg-surface-card border border-border-dim rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-brand-purple/50 hover:shadow-[0_4px_24px_rgba(124,58,237,0.15)] hover:-translate-y-1 group"
        >
          <!-- Cover -->
          <div class="relative bg-gradient-to-br from-brand-purple/30 via-surface-dark to-brand-cyan/20 overflow-hidden" :class="game.cover_image ? '' : 'aspect-[4/3]'">
            <img
              v-if="game.cover_image"
              :src="'/' + game.cover_image"
              :alt="game.title"
              class="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-5xl font-bold text-white/20 select-none aspect-[4/3]">
              {{ game.title?.charAt(0) || '?' }}
            </div>
            <!-- Category Badge -->
            <span
              v-if="game.category"
              class="absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-2.5 sm:py-0.5 bg-brand-purple/20 text-brand-purple text-[10px] sm:text-xs rounded-full backdrop-blur-sm"
            >{{ game.category }}</span>
            <!-- Stats -->
            <div class="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/70">
              <span class="bg-black/40 px-1.5 sm:px-2 py-0.5 rounded">{{ game.video_count || 0 }} 视频</span>
              <span class="bg-black/40 px-1.5 sm:px-2 py-0.5 rounded">{{ game.scene_count || 0 }} 场景</span>
            </div>
          </div>

          <!-- Info -->
          <div class="p-3 sm:p-4">
            <h3 class="text-base sm:text-lg font-bold text-white mb-1 sm:mb-1.5">{{ game.title }}</h3>
            <p class="text-xs sm:text-sm text-text-dim line-clamp-3 leading-relaxed">{{ game.description || '暂无简介' }}</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="text-center py-4 sm:py-6 text-[10px] sm:text-xs text-text-dimmer border-t border-border-dim">
      {{ footerText }}
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLangStore } from '../stores/lang'
import { useApi } from '../composables/useApi'
import LangSelector from '../components/LangSelector.vue'

const router = useRouter()
const auth = useAuthStore()
const lang = useLangStore()
const { get } = useApi()

const games = ref([])
const loading = ref(true)
const siteName = ref('长城AI互动短剧平台')
const footerText = ref('Powered by 长城AI互动短剧平台')

async function fetchGames() {
  loading.value = true
  try {
    const params = lang.current !== 'zh' ? { lang: lang.current } : {}
    const res = await get('/games', params)
    games.value = res.games || []
  } catch (e) {
    // silently ignore
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchGames(); loadConfig() })
watch(() => lang.current, fetchGames)

async function loadConfig() {
  try {
    const r = await get('/config')
    if (r.config?.site_name) siteName.value = r.config.site_name
    if (r.config?.footer_text) footerText.value = r.config.footer_text
  } catch {}
}

function goPlay(game) {
  if (auth.isLoggedIn) {
    router.push('/play/' + game.id)
  } else {
    router.push('/login?redirect=' + encodeURIComponent('/play/' + game.id))
  }
}

function goHome() {
  router.push('/')
}

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>
