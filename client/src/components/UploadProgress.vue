<template>
  <div v-if="visible" class="w-full h-1 bg-white/10 rounded-sm mt-2 overflow-hidden">
    <div
      class="h-full rounded-sm transition-all duration-300"
      style="--w: 0%; width: var(--w); background: linear-gradient(90deg, #7c3aed, #e040fb)"
      :style="{ '--w': percent + '%' }"
    ></div>
    <div class="text-[11px] text-text-dim mt-[3px]">{{ percent }}% ({{ loaded }} / {{ total }})</div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  percent: { type: Number, default: 0 },
  loaded: { type: String, default: '' },
  total: { type: String, default: '' }
})
</script>
