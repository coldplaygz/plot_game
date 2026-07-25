<template>
  <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, #0f0f1a, #1a1a2e, #16213e)">
    <div class="bg-surface-card border border-border-dim rounded-2xl p-10 w-[380px]">
      <h1 class="text-center text-[22px] text-white mb-[6px]">后台管理</h1>
      <div class="text-center text-xs text-text-dimmer mb-7">长城AI互动短剧平台 · 内容管理系统</div>

      <div class="mb-4">
        <label class="block text-xs text-text-dim mb-[5px]">用户名</label>
        <input
          v-model="username"
          class="w-full px-[14px] py-[11px] bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
          placeholder="admin"
          @keydown.enter="handleLogin"
        />
      </div>
      <div class="mb-4">
        <label class="block text-xs text-text-dim mb-[5px]">密码</label>
        <input
          v-model="password"
          type="password"
          class="w-full px-[14px] py-[11px] bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
          placeholder="请输入密码"
          @keydown.enter="handleLogin"
        />
      </div>

      <div class="text-[#ef4444] text-xs text-center mt-[10px] min-h-[18px]">{{ error }}</div>

      <button
        class="w-full py-[11px] bg-brand-purple text-white border-none rounded-lg text-sm cursor-pointer hover:bg-brand-purple-dark transition-all"
        :disabled="loading"
        @click="handleLogin"
      >{{ loading ? '登录中...' : '登 录' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

const router = useRouter()
const auth = useAuthStore()
const { show } = useToast()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  try {
    const user = await auth.login(username.value.trim(), password.value)
    if (user.role === 'player') {
      auth.logout()
      error.value = '权限不足，需要管理员账号'
      loading.value = false
      return
    }
    show('登录成功')
    router.push('/admin')
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
