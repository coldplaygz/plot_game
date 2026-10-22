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

// 旧版本页面加载新 dist 时，懒加载 chunk 404 → 自动刷新一次（sessionStorage 防循环）
window.addEventListener('vite:preloadError', (e) => {
  if (!sessionStorage.getItem('pg_preload_reloaded')) {
    sessionStorage.setItem('pg_preload_reloaded', '1')
    window.location.reload()
  }
})
router.onError((error, to) => {
  // 懒加载路由 chunk 拉取失败（部署后旧页面引用旧文件名）→ 刷新到目标路由
  const msg = String(error?.message || '')
  if ((msg.includes('Failed to fetch dynamically imported module') || msg.includes('Unable to preload CSS')) &&
      !sessionStorage.getItem('pg_preload_reloaded')) {
    sessionStorage.setItem('pg_preload_reloaded', '1')
    window.location.assign(to?.fullPath || window.location.pathname)
  }
})

app.mount('#app')
