<template>
  <div
    v-if="text"
    class="flex justify-center pointer-events-none"
  >
    <span class="px-4 py-1.5 bg-black/75 text-white text-sm sm:text-base rounded-md leading-relaxed text-center max-w-[85%] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{{ text }}</span>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  videoEl: { type: Object, default: null }
})

const text = ref('')
const cues = ref([])
let currentIdx = -1
let timeHandler = null

function parseVTT(raw) {
  const result = []
  const blocks = raw.replace(/\r/g, '').split('\n\n')
  for (const block of blocks) {
    const lines = block.split('\n')
    const timeLine = lines.find(l => l.includes('-->'))
    if (!timeLine) continue
    const [startRaw, endRaw] = timeLine.split(' --> ')
    const start = parseTime(startRaw)
    const end = parseTime(endRaw)
    const txt = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim()
    if (txt && start >= 0) result.push({ start, end, text: txt })
  }
  return result.sort((a, b) => a.start - b.start)
}

function parseTime(t) {
  if (!t) return -1
  const m = t.match(/(\d+):(\d+):(\d+)\.(\d+)/)
  if (!m) return -1
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000
}

function findCue(time) {
  if (!cues.value.length) return null
  // binary search would be better but linear is fine for typical VTT files
  for (let i = 0; i < cues.value.length; i++) {
    if (time >= cues.value[i].start && time <= cues.value[i].end) {
      return cues.value[i]
    }
  }
  return null
}

function onTimeUpdate() {
  if (!props.videoEl) return
  const t = props.videoEl.currentTime
  const cue = findCue(t)
  if (cue) {
    text.value = cue.text
  } else {
    text.value = ''
  }
}

async function load(src) {
  text.value = ''
  cues.value = []
  if (!src) return
  try {
    const res = await fetch(src)
    if (!res.ok) return
    const raw = await res.text()
    cues.value = parseVTT(raw)
  } catch (e) {
    // silently fail
  }
}

watch(() => props.src, (val) => {
  load(val)
}, { immediate: true })

watch(() => props.videoEl, (el) => {
  if (timeHandler && props.videoEl) {
    props.videoEl.removeEventListener('timeupdate', timeHandler)
  }
  if (el) {
    timeHandler = () => onTimeUpdate()
    el.addEventListener('timeupdate', timeHandler)
  }
})

onBeforeUnmount(() => {
  if (props.videoEl && timeHandler) {
    props.videoEl.removeEventListener('timeupdate', timeHandler)
  }
})
</script>
