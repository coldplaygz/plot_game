import { ref } from 'vue'

const toasts = ref([])
let uid = 0

export function useToast() {
  function show(msg, duration = 2500) {
    const id = ++uid
    toasts.value.push({ id, msg })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }
  return { toasts, show }
}
