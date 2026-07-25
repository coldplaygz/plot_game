<template>
  <div class="fixed top-5 left-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="px-6 py-2.5 bg-brand-purple/90 rounded-[20px] text-sm text-white animate-toast whitespace-nowrap"
    >{{ t.msg }}</div>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast'
const { toasts } = useToast()
</script>

<style scoped>
.animate-toast { animation: toastIn .3s ease, toastOut .3s ease 2s forwards; }
@keyframes toastIn { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
@keyframes toastOut { from { opacity: 1 } to { opacity: 0 } }
</style>
