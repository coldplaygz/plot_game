import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '../composables/useApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('plot_game_token'))
  const initialized = ref(false)

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

  async function register(username, password, nickname, gender, age, preferences) {
    const res = await post('/auth/register', { username, password, nickname: nickname || username, gender, age, preferences })
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
    } catch {
      logout()
    } finally {
      initialized.value = true
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('plot_game_token')
  }

  return { user, token, initialized, isLoggedIn, isAdmin, isEditor, login, register, fetchMe, logout }
})
