<template>
  <div class="flex items-center justify-center flex-col h-screen w-screen fixed inset-0 z-[30]"
    style="background: radial-gradient(ellipse at center, #1a0a2e 0%, #0a0a14 70%)">
    <div class="text-center max-w-[500px]">
      <div
        class="text-[13px] tracking-[4px] mb-2 uppercase"
        :class="typeClass"
      >{{ typeLabel }}</div>
      <h2 class="text-[36px] mb-3">{{ endingData?.title || '故事完结' }}</h2>
      <p class="text-text-dim text-[15px] mb-[30px] leading-relaxed">{{ endingData?.description || '感谢你的游玩！' }}</p>
      <div class="flex gap-3 justify-center">
        <button @click="goLobby"
          class="inline-flex items-center gap-[6px] py-[10px] px-6 border-none rounded-[10px] text-[14px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark">
          返回大厅
        </button>
        <button @click="replay"
          class="inline-flex items-center gap-[6px] py-[10px] px-6 rounded-[10px] text-[14px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple">
          重玩
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const game = useGameStore()

const endingData = computed(() => game.ending)
const endingType = computed(() => endingData.value?.type || 'normal')

const typeClass = computed(() => {
  if (!endingData.value) return 'text-text-dim'
  switch (endingType.value) {
    case 'perfect': return 'text-[#ffd700]'
    case 'good': return 'text-brand-purple'
    case 'bad': return 'text-text-dimmer'
    default: return 'text-text-dim'
  }
})

const typeLabel = computed(() => {
  if (!endingData.value) return 'THE END'
  switch (endingType.value) {
    case 'perfect': return '★ PERFECT ENDING'
    case 'good': return 'GOOD ENDING'
    case 'bad': return 'BAD ENDING'
    default: return 'ENDING'
  }
})

function goLobby() {
  game.returnToLobby()
  router.push('/')
}

function replay() {
  const gameId = game.currentScene?.game_id
  game.returnToLobby()
  if (gameId) router.push('/play/' + gameId)
  else router.push('/')
}
</script>
