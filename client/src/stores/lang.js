import { defineStore } from 'pinia'
import { ref } from 'vue'

const SUPPORTED = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
]

function detectLanguage() {
  const stored = localStorage.getItem('plot_game_lang')
  if (stored) return stored
  return null // 未设置时返回 null，由 APP 初始化时从系统配置读取
}

export const useLangStore = defineStore('lang', () => {
  const current = ref(detectLanguage() || 'zh')

  function initFromSystem(sysLang) {
    const stored = localStorage.getItem('plot_game_lang')
    if (!stored && sysLang) {
      current.value = sysLang
    }
  }

  function setLang(code) {
    current.value = code
    localStorage.setItem('plot_game_lang', code)
  }

  return { current, setLang, initFromSystem, supported: SUPPORTED }
})
