<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="visible"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        @click.self="$emit('cancel')"
      >
        <div class="bg-surface-card border border-border-dim rounded-2xl p-8 w-[400px] max-w-[90vw] shadow-2xl shadow-black/50">
          <!-- Icon -->
          <div class="flex justify-center mb-4">
            <div class="w-14 h-14 rounded-full bg-brand-purple/15 flex items-center justify-center text-2xl">
              {{ icon || '💎' }}
            </div>
          </div>

          <!-- Title -->
          <h3 class="text-lg text-white font-bold text-center mb-2">{{ title }}</h3>

          <!-- Message -->
          <p class="text-sm text-text-dim text-center leading-relaxed whitespace-pre-line">{{ message }}</p>

          <!-- Buttons -->
          <div class="flex gap-3 mt-6">
            <button
              v-if="cancelText"
              @click="$emit('cancel')"
              class="flex-1 py-2.5 px-4 bg-transparent border border-border-dim text-text-muted rounded-xl text-sm hover:border-brand-purple hover:text-white transition-all duration-200"
            >{{ cancelText }}</button>
            <button
              @click="$emit('confirm')"
              class="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200"
              :class="confirmClass"
            >{{ confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  icon: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '' },
  variant: { type: String, default: 'primary' } // primary | danger
})

defineEmits(['confirm', 'cancel'])

const confirmClass = computed(() => {
  if (props.variant === 'danger') return 'bg-red-600 text-white hover:bg-red-700'
  return 'bg-brand-purple text-white hover:bg-brand-purple-dark'
})
</script>

<style scoped>
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-enter-active > div,
.confirm-leave-active > div {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
.confirm-enter-from > div {
  transform: scale(0.95);
  opacity: 0;
}
.confirm-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}
</style>
