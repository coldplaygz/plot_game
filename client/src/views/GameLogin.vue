<template>
  <div class="flex flex-col items-center justify-center h-screen w-screen fixed inset-0"
    style="background: radial-gradient(ellipse at center, #1a0a2e 0%, #0a0a14 70%)">
    <div class="bg-surface-login/90 border border-border-accent rounded-[20px] py-12 px-10 w-[420px] text-center backdrop-blur-[10px]">
      <h1 class="text-[32px] mb-1 bg-gradient-to-br from-brand-pink3 via-brand-purple to-brand-cyan bg-clip-text text-transparent">长城AI互动短剧平台</h1>
      <p class="text-text-dim text-[13px] mb-7">AI驱动的互动影像体验</p>

      <div class="mb-4 text-left">
        <label class="block text-[13px] text-text-muted mb-[5px]">用户名</label>
        <input v-model="username" placeholder="请输入用户名"
          class="w-full py-3 px-4 bg-black/50 border border-border-dim rounded-[10px] text-white text-[14px] outline-none transition-colors duration-200 focus:border-brand-purple"
          @keyup.enter="handleSubmit" />
      </div>

      <div class="mb-4 text-left">
        <label class="block text-[13px] text-text-muted mb-[5px]">密码</label>
        <input v-model="password" type="password" placeholder="请输入密码"
          class="w-full py-3 px-4 bg-black/50 border border-border-dim rounded-[10px] text-white text-[14px] outline-none transition-colors duration-200 focus:border-brand-purple"
          @keyup.enter="handleSubmit" />
      </div>

      <div v-if="isRegister" class="mb-4 text-left">
        <label class="block text-[13px] text-text-muted mb-[5px]">昵称</label>
        <input v-model="nickname" placeholder="请输入昵称"
          class="w-full py-3 px-4 bg-black/50 border border-border-dim rounded-[10px] text-white text-[14px] outline-none transition-colors duration-200 focus:border-brand-purple"
          @keyup.enter="handleSubmit" />
      </div>

      <div v-if="isRegister" class="mb-4 text-left">
        <label class="block text-[13px] text-text-muted mb-[5px]">性别</label>
        <div class="flex gap-3">
          <label v-for="g in genders" :key="g.value" class="flex items-center gap-1.5 text-text-subtle text-[14px] cursor-pointer">
            <input type="radio" v-model="gender" :value="g.value" class="accent-brand-purple" /> {{ g.label }}
          </label>
        </div>
      </div>

      <div v-if="isRegister" class="mb-4 text-left">
        <label class="block text-[13px] text-text-muted mb-[5px]">年龄</label>
        <select v-model="age"
          class="w-full py-3 px-4 bg-black/50 border border-border-dim rounded-[10px] text-white text-[14px] outline-none focus:border-brand-purple">
          <option value="">请选择</option>
          <option v-for="a in ageOptions" :key="a" :value="a">{{ a }}岁</option>
        </select>
      </div>

      <div v-if="isRegister" class="mb-4 text-left">
        <label class="block text-[13px] text-text-muted mb-[5px]">喜好（可多选）</label>
        <div class="flex flex-wrap gap-2">
          <button v-for="t in tagOptions" :key="t"
            @click="toggleTag(t)"
            type="button"
            class="px-3 py-1.5 rounded-full text-xs border transition-all"
            :class="prefers.includes(t) ? 'bg-brand-purple/30 border-brand-purple text-white' : 'bg-white/5 border-border-dim text-text-dim hover:border-brand-purple/50'"
          >{{ t }}</button>
        </div>
      </div>

      <div class="text-red-500 text-[13px] mt-2 min-h-[20px]">{{ errorMsg }}</div>

      <button @click="handleSubmit"
        class="w-full py-3 text-white border-none rounded-[10px] text-[15px] cursor-pointer mt-3 transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(124,58,237,0.4)]"
        style="background: linear-gradient(135deg, #7c3aed, #e040fb)">
        {{ isRegister ? '注 册' : '登 录' }}
      </button>

      <div class="text-text-dim text-[13px] mt-4 cursor-pointer select-none">
        {{ isRegister ? '已有账号？' : '还没有账号？' }}<span @click="toggleMode" class="text-brand-purple cursor-pointer">{{ isRegister ? '返回登录' : '立即注册' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const nickname = ref('')
const gender = ref('')
const age = ref('')
const prefers = ref([])
const isRegister = ref(false)
const errorMsg = ref('')

const genders = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' }
]
const ageOptions = Array.from({ length: 48 }, (_, i) => i + 13) // 13-60
const tagOptions = ['恋爱', '都市', '商战', '悬疑', '古装', '科幻', '喜剧', '恐怖', '校园', '奇幻']

function toggleTag(t) {
  const i = prefers.value.indexOf(t)
  if (i >= 0) prefers.value.splice(i, 1)
  else prefers.value.push(t)
}

function toggleMode() {
  isRegister.value = !isRegister.value
  errorMsg.value = ''
  gender.value = ''
  age.value = ''
  prefers.value = []
}

async function handleSubmit() {
  errorMsg.value = ''
  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  if (isRegister.value && password.value.length < 6) {
    errorMsg.value = '密码至少6位'
    return
  }
  try {
    if (isRegister.value) {
      await auth.register(
        username.value.trim(), password.value, nickname.value.trim() || username.value.trim(),
        gender.value || undefined, age.value || undefined, prefers.value.join(',') || undefined
      )
    } else {
      await auth.login(username.value.trim(), password.value)
    }
    const redirect = route.query.redirect
    if (redirect) router.push(redirect)
    else router.push('/')
  } catch (e) {
    errorMsg.value = e.message || '操作失败'
  }
}
</script>
