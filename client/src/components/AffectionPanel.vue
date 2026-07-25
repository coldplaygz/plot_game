<template>
  <div v-if="characters && characters.length > 0" class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[5] transition-opacity duration-500"
    :class="visible ? 'opacity-100' : 'opacity-0'">
    <div v-for="c in characters" :key="c.id"
      class="flex items-center gap-[6px] bg-black/60 py-[6px] px-[10px] rounded-[20px] border border-white/[0.08]">
      <div class="w-2 h-2 rounded-full" :style="{ background: c.color }"></div>
      <span class="text-[11px] text-text-muted w-10 text-right">{{ c.name }}</span>
      <div class="w-20 h-1 bg-white/10 rounded-sm overflow-hidden">
        <div class="h-full rounded-sm transition-[width] duration-500 ease"
          :style="{ '--w': barPercent(c) + '%', width: 'var(--w)', background: c.color }"></div>
      </div>
      <span class="text-[10px] text-text-dimmer w-6">{{ formatVal(c) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  characters: { type: Array, default: () => [] },
  affections: { type: Object, default: () => ({}) }
})

const visible = ref(false)

function barPercent(c) {
  const val = props.affections[c.id] || 0
  return Math.min(100, Math.max(0, 50 + val * 0.5))
}

function formatVal(c) {
  const val = props.affections[c.id] || 0
  return val > 0 ? '+' + val : val
}

watch(() => props.characters, (val) => {
  visible.value = val && val.length > 0
}, { immediate: true })
</script>
