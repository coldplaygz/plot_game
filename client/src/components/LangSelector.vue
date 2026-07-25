<template>
  <div class="relative">
    <button
      @click="open = !open"
      class="flex items-center gap-1 px-2 py-1.5 bg-white/5 border border-border-dim rounded-lg text-xs text-text-dim hover:text-white hover:border-brand-purple transition-colors"
    >
      <span class="text-sm">{{ currentFlag }}</span>
      <span class="hidden sm:inline">{{ currentLabel }}</span>
      <span class="text-[10px]">▾</span>
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 bg-surface-card border border-border-dim rounded-lg overflow-hidden z-50 min-w-[120px]"
      @mouseleave="open = false"
    >
      <button
        v-for="l in lang.supported"
        :key="l.code"
        @click="select(l.code)"
        class="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-dim hover:bg-brand-purple/20 hover:text-white transition-colors text-left"
        :class="{ 'text-white bg-brand-purple/10': lang.current === l.code }"
      >
        <span class="text-sm">{{ l.flag }}</span>
        <span>{{ l.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLangStore } from '../stores/lang'

const lang = useLangStore()
const open = ref(false)

const currentFlag = computed(() => lang.supported.find(l => l.code === lang.current)?.flag || '🌐')
const currentLabel = computed(() => lang.supported.find(l => l.code === lang.current)?.label || '')

function select(code) {
  lang.setLang(code)
  open.value = false
}
</script>
