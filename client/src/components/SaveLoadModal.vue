<template>
  <div class="fixed inset-0 flex items-center justify-center bg-black/[0.92] z-[50]">
    <div class="bg-surface-login/95 border border-border-accent rounded-[20px] p-8 w-[600px] max-w-[90vw]">
      <h2 class="text-center mb-5 text-[22px] text-white">{{ mode === 'save' ? '💾 保存游戏' : '📂 读取存档' }}</h2>

      <div v-if="loading" class="text-text-dim text-center py-10">加载中...</div>

      <div v-else class="grid grid-cols-3 gap-3 mb-5">
        <div
          v-for="(slot, idx) in slots"
          :key="idx"
          @click="handleSlotClick(slot)"
          class="relative bg-black/40 border border-border-dim rounded-[12px] p-4 cursor-pointer text-center min-h-[110px] flex flex-col justify-center transition-all duration-200 hover:border-brand-purple"
          :class="{ 'text-[#444] text-[13px]': !slot.save && mode === 'load' }"
        >
          <template v-if="slot.save">
            <span
              @click.stop="deleteSave(slot.save.id)"
              class="absolute top-1 right-2 text-text-dimmest text-[14px] cursor-pointer opacity-0 hover:text-red-500 transition-opacity"
              :class="'group-hover:opacity-100'"
              title="删除"
            >×</span>
            <div class="text-[11px] text-text-dimmer">存档位 {{ slot.num }}</div>
            <div class="text-[13px] text-text-subtle mt-1">{{ slot.save.chapter ? slot.save.chapter + ' · ' : '' }}{{ slot.save.title || slot.save.scene_title || '' }}</div>
            <div class="text-[10px] text-text-dimmest mt-[2px]">{{ formatPlayTime(slot.save.play_time) }} · {{ formatTime(slot.save.updated_at) }}</div>
          </template>
          <template v-else>
            <div class="text-[11px] text-text-dimmer">存档位 {{ slot.num }}</div>
            <span>空</span>
          </template>
        </div>
      </div>

      <div class="flex gap-[10px] justify-center">
        <button @click="$emit('close')"
          class="inline-flex items-center gap-[6px] py-[10px] px-6 rounded-[10px] text-[14px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple">
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
  mode: { type: String, required: true }
})
const emit = defineEmits(['close'])

const router = useRouter()
const game = useGameStore()
const toast = useToast()
const { get, del } = useApi()

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
    const params = {}
    if (game.currentScene?.game_id) params.game_id = game.currentScene.game_id
    const res = await get('/saves', params)
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
    if (success) emit('close')
  } else {
    if (!slot.save) return
    const success = await game.loadGame(slot.save.id)
    if (success) {
      emit('close')
      router.push('/game')
    }
  }
}

async function deleteSave(saveId) {
  try {
    await del('/saves/' + saveId)
    saves.value = saves.value.filter(s => s.id !== saveId)
    toast.show('存档已删除')
  } catch (e) {
    toast.show('删除失败')
  }
}

function formatPlayTime(seconds) {
  if (!seconds || seconds <= 0) return '0分钟'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return h + '小时' + m + '分钟'
  if (m > 0) return m + '分钟'
  return seconds + '秒'
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}
</script>
