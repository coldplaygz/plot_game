<template>
  <div class="flex gap-[6px] justify-center mt-4 items-center">
    <button
      class="bg-white/5 border border-border-dim text-text-dim px-[14px] py-[6px] rounded-md text-[13px] cursor-pointer transition-all duration-200 hover:bg-brand-purple/20 hover:border-brand-purple hover:text-white disabled:opacity-30 disabled:cursor-default"
      :disabled="page <= 1"
      @click="$emit('update', 1, pageSize)"
    >«</button>
    <button
      class="bg-white/5 border border-border-dim text-text-dim px-[14px] py-[6px] rounded-md text-[13px] cursor-pointer transition-all duration-200 hover:bg-brand-purple/20 hover:border-brand-purple hover:text-white disabled:opacity-30 disabled:cursor-default"
      :disabled="page <= 1"
      @click="$emit('update', page - 1, pageSize)"
    >‹</button>

    <span class="text-xs text-text-dimmer">{{ page }} / {{ totalPages }} (共{{ total }}条)</span>

    <button
      class="bg-white/5 border border-border-dim text-text-dim px-[14px] py-[6px] rounded-md text-[13px] cursor-pointer transition-all duration-200 hover:bg-brand-purple/20 hover:border-brand-purple hover:text-white disabled:opacity-30 disabled:cursor-default"
      :disabled="page >= totalPages"
      @click="$emit('update', page + 1, pageSize)"
    >›</button>
    <button
      class="bg-white/5 border border-border-dim text-text-dim px-[14px] py-[6px] rounded-md text-[13px] cursor-pointer transition-all duration-200 hover:bg-brand-purple/20 hover:border-brand-purple hover:text-white disabled:opacity-30 disabled:cursor-default"
      :disabled="page >= totalPages"
      @click="$emit('update', totalPages, pageSize)"
    >»</button>

    <select
      :value="pageSize"
      class="bg-surface-darkest border border-border-dim rounded-md text-text-dim px-2 py-1 text-xs"
      @change="$emit('update', 1, Number($event.target.value))"
    >
      <option :value="10">10条/页</option>
      <option :value="20">20条/页</option>
      <option :value="50">50条/页</option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 }
})

defineEmits(['update'])

const totalPages = computed(() => Math.ceil(props.total / props.pageSize) || 1)
</script>
