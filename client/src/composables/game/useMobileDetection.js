/**
 * 移动端检测
 * 从 GamePlayer.vue 抽出
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useMobileDetection() {
  const isMobile = ref(false)

  function updateMobileDetection() {
    isMobile.value = window.innerWidth < 768 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  }

  onMounted(() => {
    updateMobileDetection()
    window.addEventListener('resize', updateMobileDetection)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateMobileDetection)
  })

  return { isMobile, updateMobileDetection }
}
