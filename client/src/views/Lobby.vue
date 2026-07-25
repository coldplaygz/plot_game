<template>
  <div class="flex flex-col items-center justify-center h-screen w-screen fixed inset-0"
    style="background: linear-gradient(135deg, #0a0a14 0%, #1a0a2e 40%, #0a1a2e 100%)">
    <div class="absolute inset-0 opacity-[0.08]"
      style="background: url('data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 800 600&quot;><defs><radialGradient id=&quot;g&quot;><stop offset=&quot;0&quot; stop-color=&quot;%23fff&quot;/><stop offset=&quot;1&quot; stop-color=&quot;%23000&quot;/></radialGradient></defs><circle cx=&quot;400&quot; cy=&quot;300&quot; r=&quot;300&quot; fill=&quot;url(%23g)&quot; opacity=&quot;0.3&quot;/></svg>') center/cover">
    </div>

    <div class="absolute top-5 right-6 flex items-center gap-[10px] text-text-dim text-[13px] z-[2]">
      <span>{{ displayName }}</span>
      <span class="text-text-dimmest cursor-pointer transition-colors duration-200 hover:text-red-500" @click="handleLogout">退出</span>
    </div>

    <div class="relative z-[1] text-center">
      <h1 class="text-[48px] mb-2 bg-gradient-to-br from-brand-pink3 via-brand-purple to-brand-cyan bg-clip-text text-transparent">长城AI互动短剧平台</h1>
      <div class="text-[12px] text-text-dimmest mb-10">Great Wall AI Drama Platform v1.0</div>
      <div class="flex flex-col gap-[14px] w-[280px] mx-auto">
        <button @click="goHome"
          class="py-[14px] px-0 bg-white/5 border border-white/10 rounded-[12px] text-text-subtle text-[16px] cursor-pointer relative overflow-hidden transition-all duration-300 hover:bg-brand-purple/15 hover:border-brand-purple/40 hover:text-white hover:scale-[1.03]">
          <span class="mr-2">▶</span> 开始新游戏
        </button>
        <button @click="showLoadModal = true"
          class="py-[14px] px-0 bg-white/5 border border-white/10 rounded-[12px] text-text-subtle text-[16px] cursor-pointer relative overflow-hidden transition-all duration-300 hover:bg-brand-purple/15 hover:border-brand-purple/40 hover:text-white hover:scale-[1.03]">
          <span class="mr-2">📂</span> 继续游戏
        </button>
        <button @click="goGallery"
          class="py-[14px] px-0 bg-white/5 border border-white/10 rounded-[12px] text-text-subtle text-[16px] cursor-pointer relative overflow-hidden transition-all duration-300 hover:bg-brand-purple/15 hover:border-brand-purple/40 hover:text-white hover:scale-[1.03]">
          <span class="mr-2">🏆</span> 结局图鉴
        </button>
        <button @click="handleLogout"
          class="py-[14px] px-0 bg-white/5 border border-white/10 rounded-[12px] text-text-subtle text-[16px] cursor-pointer relative overflow-hidden transition-all duration-300 hover:bg-brand-purple/15 hover:border-brand-purple/40 hover:text-white hover:scale-[1.03]">
          <span class="mr-2">🚪</span> 退出登录
        </button>
      </div>
    </div>

    <SaveLoadModal v-if="showLoadModal" mode="load" :visible="showLoadModal" @close="showLoadModal = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import SaveLoadModal from '../components/SaveLoadModal.vue'

const router = useRouter()
const auth = useAuthStore()
const game = useGameStore()

const showLoadModal = ref(false)

const displayName = computed(() => auth.user?.nickname || auth.user?.username || '')

function goHome() {
  router.push('/')
}

function goGallery() {
  router.push('/gallery')
}

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>
