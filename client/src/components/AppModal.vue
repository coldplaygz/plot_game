<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      @click.self="$emit('close')"
    >
      <div
        class="bg-surface-card border border-border-dim rounded-[14px] p-7 w-[520px] max-w-[90vw] max-h-[85vh] overflow-y-auto"
        :class="{ 'w-[750px]': wide }"
      >
        <h3 class="text-base text-white mb-5">{{ title }}</h3>

        <slot />

        <div v-if="$slots.actions" class="flex gap-2 justify-end mt-5">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  wide: { type: Boolean, default: false }
})

defineEmits(['close'])
</script>
