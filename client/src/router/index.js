import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/login', name: 'game-login', component: () => import('../views/GameLogin.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/UserProfile.vue'), meta: { requiresAuth: true } },
  { path: '/leaderboard', name: 'leaderboard', component: () => import('../views/PropLeaderboard.vue'), meta: { requiresAuth: true } },
  { path: '/lobby', redirect: '/' },
  { path: '/game', name: 'game', component: () => import('../views/GamePlayer.vue'), meta: { requiresAuth: true } },
  { path: '/intro/:gameId', name: 'intro', component: () => import('../views/GameIntro.vue'), meta: { requiresAuth: true } },
  { path: '/play/:gameId', name: 'play', component: () => import('../views/GamePlayer.vue'), meta: { requiresAuth: true } },
  { path: '/ending', name: 'ending', component: () => import('../views/Ending.vue'), meta: { requiresAuth: true } },

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
      { path: 'dialogue-library', name: 'dialogue-library', component: () => import('../views/AdminDialogueLibrary.vue') },
      { path: 'characters', name: 'admin-characters', component: () => import('../views/AdminCharacters.vue') },
      { path: 'attributes', name: 'admin-attributes', component: () => import('../views/AdminAttributes.vue') },
      { path: 'props', name: 'admin-props', component: () => import('../views/AdminProps.vue') },
      { path: 'games', name: 'admin-games', component: () => import('../views/AdminGames.vue') },
      { path: 'themes', name: 'admin-themes', component: () => import('../views/AdminThemes.vue') },
      { path: 'users', name: 'admin-users', component: () => import('../views/AdminUsers.vue') },
      { path: 'recharge', name: 'admin-recharge', component: () => import('../views/AdminRecharge.vue') },
      { path: 'points-log', name: 'admin-points-log', component: () => import('../views/AdminPointsLog.vue') },
      { path: 'settings', name: 'admin-settings', component: () => import('../views/AdminSettings.vue') }
    ]
  },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()
  if (!auth.initialized && auth.isLoggedIn) {
    await auth.fetchMe()
  } else if (!auth.initialized) {
    auth.initialized = true
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return next('/login?redirect=' + encodeURIComponent(to.fullPath))
  }
  if (to.meta.requiresAdmin && !(auth.isAdmin || auth.isEditor)) return next('/')
  next()
})

export default router
