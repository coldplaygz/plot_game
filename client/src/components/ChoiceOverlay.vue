<template>
  <div class="w-full bg-gradient-to-t from-black/85 via-black/60 to-transparent pt-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] px-4 sm:px-6">
    <!-- Timer -->
    <div v-if="timerSeconds > 0" class="text-center mb-4">
      <div class="h-[3px] bg-white/10 rounded-sm overflow-hidden w-full max-w-[300px] mx-auto">
        <div class="h-full bg-gradient-to-r from-brand-purple to-brand-pink transition-[width] duration-100 linear" :style="{ width: timerPercent + '%' }"></div>
      </div>
      <div class="text-text-dim text-[12px] mt-[6px]">{{ Math.ceil(remaining) }}s</div>
    </div>

    <!-- Choice Buttons -->
    <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mx-auto max-w-[360px] sm:max-w-3xl max-h-[40dvh] overflow-y-auto sm:overflow-visible">
      <button
        v-for="(c, idx) in choices"
        :key="c.id"
        @click="$emit('choose', c.id)"
        class="w-full sm:flex-1 sm:min-w-[160px] sm:max-w-[280px] py-4 px-6 bg-surface-login/85 border border-brand-purple/30 rounded-[14px] text-text-subtle text-[15px] cursor-pointer text-center relative overflow-hidden backdrop-blur-[8px] transition-all duration-[0.25s] hover:bg-brand-purple/25 hover:border-brand-purple hover:text-white active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(124,58,237,0.25)]"
      >
        {{ c.text }}
        <div v-if="c.point_cost > 0" class="text-[11px] text-brand-purple mt-[6px]">💎 {{ c.point_cost }} 积分</div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  choices: { type: Array, required: true },
  timerSeconds: { type: Number, default: 0 }
})
defineEmits(['choose'])

const remaining = ref(props.timerSeconds)
const timerPercent = ref(100)
let interval = null

function startTimer() {
  if (props.timerSeconds <= 0) return
  remaining.value = props.timerSeconds
  timerPercent.value = 100
  interval = setInterval(() => {
    remaining.value -= 0.1
    timerPercent.value = Math.max(0, (remaining.value / props.timerSeconds) * 100)
    if (remaining.value <= 0) {
      clearInterval(interval)
      // 时间到不清除选项，也不替用户选择
    }
  }, 100)
}

onMounted(() => {
  startTimer()
})

onBeforeUnmount(() => {
  clearInterval(interval)
})
</script>
