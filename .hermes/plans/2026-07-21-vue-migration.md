# Vue.js 3 + Vite 迁移实施计划

> **For Hermes:** 逐任务执行，每完成一个任务提交一次。

**目标：** 将"心动时刻"两个原生 JS SPA 迁移为 Vue.js 3 + Vite 项目。

**架构：** Vite 开发服务器代理 API 到 Express (3000)，生产 `vite build` 输出到 `client/dist/`，Express 静态托管。Vue Router (history mode) 区分游戏/管理端路由，Pinia 管理状态，Tailwind CSS 通过 PostCSS 插件接入。

**技术栈：** Vue 3 (Composition API) + Vite + Vue Router + Pinia + Tailwind CSS + Express

**原则：**
- Express 后端零改动（路由、数据库、文件结构不变）
- `public/index.html` 和 `public/admin.html` 保留不动直到迁移验证通过
- 生产环境 Express 同时服务新旧前端，Nginx 无需改动
- 视频/媒体文件 `uploads/` 目录完全不变

---

### Task 0: 创建 Vue + Vite 项目

**目标：** 初始化 client/ 子目录，安装依赖。

**文件：**
- 创建：`client/package.json`
- 创建：`client/vite.config.js`
- 创建：`client/index.html`
- 创建：`client/tailwind.config.js`
- 创建：`client/postcss.config.js`
- 创建：`client/src/main.js`
- 创建：`client/src/App.vue`
- 创建：`client/src/style.css`

**步骤 1: 初始化 package.json**

```bash
mkdir -p client/src/client/src/views client/src/components client/src/stores client/src/composables client/src/router
cd client
npm init -y
```

**步骤 2: 安装依赖**

```bash
cd C:/plot_game/client
npm install vue vue-router pinia axios
npm install -D vite @vitejs/plugin-vue tailwindcss @tailwindcss/vite
```

**步骤 3: 创建 client/package.json 的 scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**步骤 4: 创建 client/vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
```

**步骤 5: 创建 client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>心动时刻</title>
</head>
<body class="bg-black text-white font-sans overflow-hidden h-screen w-screen select-none">
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**步骤 6: 创建 client/src/main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

**步骤 7: 创建 client/src/App.vue**

```vue
<template>
  <router-view />
</template>
```

**步骤 8: 创建 client/src/style.css**

```css
@import "tailwindcss";

@theme {
  --color-brand-purple: #7c3aed;
  --color-brand-purple-dark: #6d28d9;
  --color-brand-pink: #e040fb;
  --color-brand-pink2: #ec4899;
  --color-brand-pink3: #ff6b9d;
  --color-brand-cyan: #06b6d4;
  --color-surface-darkest: #0a0a14;
  --color-surface-dark: #0f0f1a;
  --color-surface-card: #1a1a2e;
  --color-surface-login: #140a28;
  --color-surface-overlay: #141428;
  --color-border-dim: #2a2a4a;
  --color-border-accent: #3a2060;
  --color-text-dim: #888;
  --color-text-dimmer: #666;
  --color-text-dimmest: #555;
  --color-text-muted: #aaa;
  --color-text-subtle: #ccc;
}

@layer base {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}
```

**验证：** `cd client && npm run dev` 应启动在 localhost:5173，访问显示空白页（无报错）。

---

### Task 1: API 封装 + 认证 Store

**目标：** 创建 axios 实例 + Pinia auth store，替代原生的 `api()` 函数和 token 管理。

**文件：**
- 创建：`client/src/composables/useApi.js`
- 创建：`client/src/stores/auth.js`
- 创建：`client/src/composables/useToast.js`

**步骤 1: 创建 client/src/composables/useApi.js**

```js
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('plot_game_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r.data,
  err => {
    const msg = err.response?.data?.error || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export function useApi() {
  return {
    get: (url, params) => api.get(url, { params }),
    post: (url, data) => api.post(url, data),
    put: (url, data) => api.put(url, data),
    del: (url) => api.delete(url),
    // 文件上传（返回原生 axios promise 以便用 onUploadProgress）
    upload: (url, formData, onProgress) => {
      const token = localStorage.getItem('plot_game_token')
      return axios.post(url, formData, {
        baseURL: '/api',
        headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress
      }).then(r => r.data)
    }
  }
}
```

**步骤 2: 创建 client/src/stores/auth.js**

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '../composables/useApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('plot_game_token'))

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isEditor = computed(() => user.value?.role === 'admin' || user.value?.role === 'editor')

  const { post, get } = useApi()

  async function login(username, password) {
    const res = await post('/auth/login', { username, password })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('plot_game_token', res.token)
    return res.user
  }

  async function register(username, password, nickname) {
    const res = await post('/auth/register', { username, password, nickname })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('plot_game_token', res.token)
    return res.user
  }

  async function fetchMe() {
    try {
      const res = await get('/auth/me')
      user.value = res.user
      return res.user
    } catch { logout() }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('plot_game_token')
  }

  return { user, token, isLoggedIn, isAdmin, isEditor, login, register, fetchMe, logout }
})
```

**步骤 3: 创建 client/src/composables/useToast.js**

```js
import { ref } from 'vue'

const toasts = ref([])
let id = 0

export function useToast() {
  function show(msg, duration = 2500) {
    const uid = ++id
    toasts.value.push({ id: uid, msg })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== uid)
    }, duration)
  }
  return { toasts, show }
}
```

---

### Task 2: 路由配置

**目标：** 设置 Vue Router，定义所有游戏端和管理端的路由。

**文件：**
- 创建：`client/src/router/index.js`

**步骤 1: 创建 client/src/router/index.js**

```js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  // 游戏端
  { path: '/', name: 'game-login', component: () => import('../views/GameLogin.vue') },
  { path: '/lobby', name: 'lobby', component: () => import('../views/Lobby.vue'), meta: { requiresAuth: true } },
  { path: '/game', name: 'game', component: () => import('../views/GamePlayer.vue'), meta: { requiresAuth: true } },
  { path: '/ending', name: 'ending', component: () => import('../views/Ending.vue'), meta: { requiresAuth: true } },
  { path: '/gallery', name: 'gallery', component: () => import('../views/Gallery.vue'), meta: { requiresAuth: true } },

  // 管理端
  { path: '/admin/login', name: 'admin-login', component: () => import('../views/AdminLogin.vue') },
  {
    path: '/admin',
    component: () => import('../views/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('../views/AdminDashboard.vue') },
      { path: 'videos', name: 'videos', component: () => import('../views/AdminVideos.vue') },
      { path: 'scenes', name: 'scenes', component: () => import('../views/AdminScenes.vue') },
      { path: 'characters', name: 'characters', component: () => import('../views/AdminCharacters.vue') },
      { path: 'endings', name: 'endings', component: () => import('../views/AdminEndings.vue') }
    ]
  },

  // 404
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return next('/')
  if (to.meta.requiresAdmin && !auth.isAdmin && !auth.isEditor) return next('/')
  next()
})

export default router
```

---

### Task 3: Toast 全局组件

**目标：** Toast 通知组件，代替原来的 `toast()` 函数。

**文件：**
- 创建：`client/src/components/AppToast.vue`
- 修改：`client/src/App.vue`

**步骤 1: 创建 client/src/components/AppToast.vue**

```vue
<template>
  <div class="fixed top-5 left-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="px-6 py-2.5 bg-brand-purple/90 rounded-[20px] text-sm text-white animate-toast whitespace-nowrap"
    >{{ t.msg }}</div>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast'
const { toasts } = useToast()
</script>

<style scoped>
.animate-toast { animation: toastIn .3s ease, toastOut .3s ease 2s forwards; }
@keyframes toastIn { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
@keyframes toastOut { from { opacity: 1 } to { opacity: 0 } }
</style>
```

**步骤 2: 更新 client/src/App.vue**

```vue
<template>
  <router-view />
  <AppToast />
</template>

<script setup>
import AppToast from './components/AppToast.vue'
</script>
```

---

### Task 4: 游戏端登录页

**目标：** Vue 版游戏登录/注册页，支持登录/注册切换。

**文件：**
- 创建：`client/src/views/GameLogin.vue`

实现 GameLogin.vue，功能对标原 `public/index.html` 的 `#loginPage`：
- 用户名/密码输入
- 登录/注册切换（含昵称字段的显示/隐藏）
- 错误提示
- 成功后调用 `auth.login()` / `auth.register()`，跳转 `/lobby`

---

### Task 5: 游戏端大厅页

**目标：** 大厅页，4 个菜单按钮 + 用户栏。

**文件：**
- 创建：`client/src/views/Lobby.vue`

功能对标原 `#lobbyPage`：
- 页面进入时确认登录态（onMounted fetchMe）
- 显示用户名
- 4 个按钮：开始新游戏 / 继续游戏(读档) / 结局图鉴 / 退出登录
- 退出调用 `auth.logout()` + router.push('/')

---

### Task 6: 游戏状态 Store + 游戏播放器

**目标：** Pinia game store 管理游戏状态，GamePlayer 视图整合视频播放 + 选择 + 好感度 + 语言。

**文件：**
- 创建：`client/src/stores/game.js`
- 创建：`client/src/views/GamePlayer.vue`
- 创建：`client/src/components/ChoiceOverlay.vue`
- 创建：`client/src/components/AffectionPanel.vue`
- 创建：`client/src/components/LangBar.vue`
- 创建：`client/src/components/PauseMenu.vue`

**game store 核心状态：**
```js
{
  currentScene: null,
  affections: {},
  characters: [],
  isEnding: false,
  ending: null,
  choiceDelayId: null,
  timerInterval: null,
  showingChoices: false
}
```

**GamePlayer.vue 职责：**
- `<video>` 播放控制（src、load、play、pause、onended）
- 跳过按钮（choice_delay > 0 时显示）
- 场景标题显示
- 好感度变化动画（浮动 +▼▼）
- 结局检测 → router.push('/ending', { state: { ending } })

**ChoiceOverlay.vue 职责：**
- 选项按钮渲染（含好感度提示 ❤️/💔）
- 倒计时条（CSS 自定义属性 `--w`）
- 选择后调用 `makeChoice()` → 加载下一个场景

**LangBar.vue 职责：**
- 音轨选择 `<select>` + 外部音频播放
- 字幕 toggle + 选择

**AffectionPanel.vue 职责：**
- 角色好感度条渲染
- 使用 CSS 自定义属性 `--w` 控制宽度
- 数据库角色颜色通过 `style="background:${color}"` 设置（AGENTS.md 允许例外）

---

### Task 7: 存档/读档弹窗

**目标：** 9 槽位存档管理，支持保存和读取。

**文件：**
- 创建：`client/src/components/SaveLoadModal.vue`

- 从 GamePlayer 中触发（暂停菜单 → 存档/读档按钮）
- 9 个槽位 grid 布局
- 存档：调用 POST /api/saves
- 读档：调用 GET /api/saves/:id/load，恢复好感度和场景

---

### Task 8: 结局页 + 图鉴页

**目标：** 结局展示和结局收集图鉴。

**文件：**
- 创建：`client/src/views/Ending.vue`
- 创建：`client/src/views/Gallery.vue`

**Ending.vue：** 通过 router state 接收 ending 对象，显示类型(perfect/good/bad)、标题、描述，"返回大厅" 按钮。

**Gallery.vue：** 获取全部结局 + 我的解锁状态，grid 展示，未解锁显示 "???" 且透明度降低。

---

### Task 9: 管理端布局 + 登录

**目标：** 管理端侧边栏布局 + 独立登录页。

**文件：**
- 创建：`client/src/views/AdminLogin.vue`
- 创建：`client/src/views/AdminLayout.vue`

**AdminLogin.vue：** 独立登录页，验证角色非 player，成功后跳转 /admin

**AdminLayout.vue：** 侧边栏(200px) + 主内容区，sticky sidebar：
- Logo + 导航链接(videos/scenes/characters/endings/dashboard)
- 底部用户名 + 退出
- 使用 `<router-view>` 嵌套子路由

---

### Task 10: 管理端功能页

**目标：** 5 个管理页面的 Vue 实现。

**文件：**
- 创建：`client/src/views/AdminDashboard.vue`
- 创建：`client/src/views/AdminVideos.vue`
- 创建：`client/src/views/AdminScenes.vue`
- 创建：`client/src/views/AdminCharacters.vue`
- 创建：`client/src/views/AdminEndings.vue`
- 创建：`client/src/components/AppModal.vue`
- 创建：`client/src/components/AppPagination.vue`
- 创建：`client/src/components/VideoPlayerModal.vue`
- 创建：`client/src/components/UploadProgress.vue`

**各页功能对标原 admin.html：**

**Dashboard：** 4 个 stat-card (视频/场景/角色/结局计数) + 工作流程说明

**Videos：**
- 视频列表表格（分页）
- 上传视频（带 XHR 进度条，使用 CSS 自定义属性 --w）
- 播放视频（弹窗 video）
- 替换视频
- 删除视频
- 音轨/字幕管理弹窗（上传/删除）

**Scenes：**
- 场景列表表格（分页）
- 创建/编辑场景弹窗
- 选项管理（好感度规则 + 条件规则）
- 删除场景

**Characters：**
- 角色列表表格（分页）
- 创建/编辑角色弹窗（含颜色选择器）

**Endings：**
- 结局列表表格（分页）
- 创建/编辑结局弹窗

---

### Task 11: Express 适配生产构建

**目标：** 生产环境 Express 服务 Vue 构建产物，SPA fallback。

**文件：**
- 修改：`server.js`

**修改内容：** 在 `app.use(express.static('public'))` 之后添加：

```js
// 生产环境服务 Vue 前端构建产物
app.use(express.static('client/dist'));
// SPA fallback — 所有非 /api 非 /uploads 请求返回 index.html
app.get(/^(?!\/(api|uploads))/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});
```

同时在 server.js 顶部添加 `const path = require('path');`

**注意：** 保留 `express.static('public')` 以便旧版 `index.html` 和 `admin.html` 仍可访问（`/index.html`, `/admin.html`），确保迁移期间零停机。

---

### Task 12: 构建验证 + .gitignore

**目标：** 确认构建成功，更新 .gitignore。

**文件：**
- 修改：`.gitignore`

**步骤：**
```bash
cd C:/plot_game/client && npm run build
```

验证 `client/dist/` 目录生成。

更新 `.gitignore` 添加 `client/dist/`（构建产物不入 git）。

---

### Task 13: 清理 + 部署

**目标：** 部署到生产环境，验证新旧共存。

**步骤 1：** 本地全流程测试
- `npm run dev` 在 root → Express on :3000
- `cd client && npm run dev` → Vite on :5173
- 测试游戏流程：登录 → 新游戏 → 选择 → 存档 → 读档 → 结局 → 图鉴
- 测试管理流程：登录 → 各管理页 CRUD

**步骤 2：** 构建 + 上传

```bash
cd C:/plot_game/client && npm run build
# scp client/dist + server.js 到生产
scp -i alxg1.pem -r client/dist root@47.238.106.118:/var/www/html/plot_game/client/
scp -i alxg1.pem server.js root@47.238.106.118:/var/www/html/plot_game/
ssh -i alxg1.pem root@47.238.106.118 "cd /var/www/html/plot_game && pm2 restart plot-game --update-env"
```

**步骤 3：** 生产验证
```bash
curl -s http://sp.yy388.xyz/          # 应返回 Vue 页面
curl -s http://sp.yy388.xyz/admin     # 应返回 Vue 管理端
curl -s http://sp.yy388.xyz/api/health # API 正常
```

---

## 完成检查清单

- [ ] `client/` 项目结构建立，`npm run dev` 启动
- [ ] API 封装 + auth store 可用
- [ ] 游戏端完整流程：登录 → 大厅 → 新游戏 → 选择 → 结局 → 图鉴
- [ ] 存档/读档功能正常
- [ ] 音轨/字幕切换正常
- [ ] 管理端完整流程：登录 → 各管理页 CRUD → 退出
- [ ] 好感度面板实时更新
- [ ] 倒计时功能正常
- [ ] 视频播放不受隐藏容器 bug 影响
- [ ] 生产构建 + Express 托管正常
- [ ] 旧版 `/index.html` 和 `/admin.html` 仍可访问
