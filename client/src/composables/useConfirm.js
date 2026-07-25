import { ref } from 'vue'

const visible = ref(false)
const title = ref('')
const message = ref('')
const icon = ref('')
const confirmText = ref('确定')
const cancelText = ref('')
const variant = ref('primary')

let resolvePromise = null

export function useConfirm() {
  function show(opts = {}) {
    return new Promise((resolve) => {
      title.value = opts.title || ''
      message.value = opts.message || ''
      icon.value = opts.icon || ''
      confirmText.value = opts.confirmText || '确定'
      cancelText.value = opts.cancelText || '取消'
      variant.value = opts.variant || 'primary'
      resolvePromise = resolve
      visible.value = true
    })
  }

  function onConfirm() {
    visible.value = false
    if (resolvePromise) { resolvePromise(true); resolvePromise = null }
  }

  function onCancel() {
    visible.value = false
    if (resolvePromise) { resolvePromise(false); resolvePromise = null }
  }

  return {
    dialogState: { visible, title, message, icon, confirmText, cancelText, variant },
    confirm: show,
    onConfirm,
    onCancel
  }
}
