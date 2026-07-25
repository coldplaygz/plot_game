<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[300] flex items-center justify-center flex-col bg-black/[0.92]"
      @keydown.escape="$emit('close')"
    >
      <video
        ref="videoRef"
        class="max-w-[95vw] max-h-[85vh] rounded-lg bg-black"
        controls
        playsinline
      ></video>
      <div class="flex items-center gap-3 mt-4">
        <span class="text-text-subtle text-sm">{{ video?.title || '' }} (ID:{{ video?.id }} | {{ fileSize }})</span>
        <button
          class="bg-white/10 border-none text-white px-4 py-[6px] rounded-md cursor-pointer text-[13px] hover:bg-red-500/50"
          @click="closePlayer"
        >✕ 关闭</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  video: { type: Object, default: null }
})

const emit = defineEmits(['close'])

const videoRef = ref(null)

const fileSize = computed(() => {
  if (!props.video?.file_size) return ''
  return (props.video.file_size / 1024 / 1024).toFixed(1) + 'MB'
})

function closePlayer() {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
  }
  emit('close')
}

// Fix: show modal first, then set src in next frame to prevent browser navigating to raw video
function setupVideo() {
  if (!videoRef.value || !props.video) return
  const player = videoRef.value
  player.pause()
  player.removeAttribute('src')

  requestAnimationFrame(() => {
    if (!player) return
    const path = (props.video.file_path || '').replace(/\\\\/g, '/')
    player.src = '/' + path
    player.load()
    player.play().catch(() => {})
  })
}

watch(() => props.visible, (val) => {
  if (val && props.video) {
    // Wait for DOM to render, then setup
    setTimeout(setupVideo, 50)
  }
})

function onEsc(e) {
  if (e.key === 'Escape' && props.visible) {
    closePlayer()
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    document.addEventListener('keydown', onEsc)
  } else {
    document.removeEventListener('keydown', onEsc)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEsc)
})
</script>
