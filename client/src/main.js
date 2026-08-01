import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

// 清理历史残留的 Service Worker（项目未使用 PWA，避免 SW 缓存导致更新不生效）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister())
  }).catch(() => {})
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
