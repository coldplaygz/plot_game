<template>
  <div class="fixed inset-0 flex items-center justify-center bg-black/[0.92] z-[30]">
    <div class="bg-surface-login/95 border border-border-accent rounded-[20px] p-8 w-[560px] max-w-[90vw]">
      <h2 class="text-center mb-5 text-[22px] text-white">{{ mode === 'save' ? '💾 保存游戏' : '📂 读取存档' }}</h2>

      <div v-if="loading" class="text-text-dim text-center py-10">加载中...</div>

      <div v-else class="grid grid-cols-3 gap-3 mb-5">
        <div
          v-for="(slot, idx) in slots"
          :key="idx"
          @click="handleSlotClick(slot)"
          class="bg-black/40 border border-border-dim rounded-[12px] p-4 cursor-pointer text-center min-h-[100px] flex flex-col justify-center transition-all duration-200 hover:border-brand-purple"
          :class="{ 'text-[#444] text-[13px]': !slot.save }"
        >
          <template v-if="slot.save">
            <div class="text-[11px] text-text-dimmer">存档位 {{ slot.num }}</div>
            <div class="text-[13px] text-text-subtle mt-1">{{ slot.save.title }}</div>
            <div class="text-[10px] text-text-dimmest">{{ slot.save.scene_title || '' }} · {{ formatTime(slot.save.updated_at) }}</div>
          </template>
          <template v-else>
            <div class="text-[11px] text-text-dimmer">存档位 {{ slot.num }}</div>
            <span>空</span>
          </template>
        </div>
      </div>

      <div class="flex gap-[10px] justify-center">
        <button @click="$emit('close')"
          class="inline-flex items-center gap-[6px] py-[10px] px-6 border-none rounded-[10px] text-[14px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple">
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useToast } from '../composables/useToast'
import { useApi } from '../composables/useApi'

const props = defineProps({
  mode: { type: String, required: true }, // 'save' | 'load'
  visible: { type: Boolean, default: true }
})
const emit = defineEmits(['close'])

const router = useRouter()
const game = useGameStore()
const toast = useToast()
const { get, post } = useApi()

const loading = ref(true)
const saves = ref([])

const slots = computed(() => {
  const result = []
  for (let i = 1; i <= 9; i++) {
    const save = saves.value.find(s => s.slot === i)
    result.push({ num: i, save: save || null })
  }
  return result
})

onMounted(async () => {
  try {
    const res = await get('/saves')
    saves.value = res.saves || []
  } catch (e) {
    toast.show('加载存档列表失败')
  } finally {
    loading.value = false
  }
})

async function handleSlotClick(slot) {
  if (props.mode === 'save') {
    if (!game.currentScene) {
      toast.show('没有进行中的游戏')
      return
    }
    const success = await game.saveGame(slot.num, game.currentScene.title)
    if (success) {
      saves.value = [] // force refresh on next open
      emit('close')
      router.push('/game')
    }
  } else {
    // load mode
    if (!slot.save) return
    const success = await game.loadGame(slot.save.id)
    if (success) {
      emit('close')
      router.push('/game')
    }
  }
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}
</script>
