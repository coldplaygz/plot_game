<template>
  <div class="flex flex-col min-h-screen bg-surface-darkest">
    <!-- Header -->
    <header class="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border-dim bg-surface-dark/50">
      <div class="flex items-center gap-2">
        <button @click="router.push('/')" class="text-text-dim hover:text-white transition-colors text-sm">← 返回</button>
        <h1 class="text-base sm:text-lg font-bold text-white">个人中心</h1>
      </div>
      <div class="text-sm text-text-dim">💎 {{ auth.user?.points || 0 }} 积分</div>
    </header>

    <main class="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
      <!-- 账户信息 -->
      <section class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h2 class="text-sm font-bold text-text-subtle mb-4">📋 账户信息</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-text-dim">用户名</span><p class="text-white mt-0.5">{{ user?.username }}</p></div>
          <div><span class="text-text-dim">昵称</span><p class="text-white mt-0.5">{{ user?.nickname || '-' }}</p></div>
          <div><span class="text-text-dim">性别</span><p class="text-white mt-0.5">{{ genderLabel }}</p></div>
          <div><span class="text-text-dim">年龄</span><p class="text-white mt-0.5">{{ user?.age || '-' }}</p></div>
          <div class="col-span-2"><span class="text-text-dim">喜好</span><p class="text-white mt-0.5">{{ user?.preferences || '-' }}</p></div>
        </div>
        <button @click="showEdit = true" class="mt-4 px-4 py-2 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark transition-colors">编辑资料</button>
      </section>

      <!-- 积分余额 -->
      <section class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h2 class="text-sm font-bold text-text-subtle mb-3">💎 积分余额</h2>
        <p class="text-4xl font-bold text-brand-purple mb-1">{{ auth.user?.points || 0 }}</p>
        <p class="text-xs text-text-dim">积分可用于游戏中选择选项</p>
      </section>

      <!-- 充值 -->
      <section class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h2 class="text-sm font-bold text-text-subtle mb-4">💰 充值积分</h2>
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[100px]">
            <label class="text-xs text-text-dim block mb-1">充值金额 (元)</label>
            <input v-model.number="amount" type="number" min="1" step="1" placeholder="输入金额"
              class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div class="text-text-muted text-sm pb-2">= {{ (amount || 0) * 10 }} 积分</div>
          <button @click="doRecharge" :disabled="recharging || !amount"
            class="px-5 py-2.5 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark transition-colors disabled:opacity-50">
            {{ recharging ? '充值中...' : '确认充值' }}
          </button>
        </div>
      </section>

      <!-- 积分记录 -->
      <section class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h2 class="text-sm font-bold text-text-subtle mb-4">📊 积分记录</h2>
        <div v-if="!logs.length" class="text-text-dimmest text-sm text-center py-8">暂无记录</div>
        <div v-else class="space-y-2">
          <div v-for="l in logs" :key="l.id" class="flex justify-between items-center py-2 border-b border-border-dim/50 last:border-0 text-sm">
            <div>
              <span class="text-text-subtle">{{ typeLabel(l.type) }}</span>
              <span class="text-text-dimmer text-xs ml-2">{{ formatTime(l.created_at) }}</span>
            </div>
            <div :class="l.points > 0 ? 'text-green-400' : 'text-red-400'" class="font-medium">
              {{ l.points > 0 ? '+' : '' }}{{ l.points }}
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 编辑弹窗 -->
    <AppModal :visible="showEdit" title="编辑资料" @close="showEdit = false">
      <div class="space-y-4">
        <div><label class="text-xs text-text-dim">昵称</label><input v-model="editForm.nickname" class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple mt-1" /></div>
        <div>
          <label class="text-xs text-text-dim">性别</label>
          <div class="flex gap-3 mt-1">
            <label v-for="g in genders" :key="g.value" class="flex items-center gap-1 text-text-subtle text-sm cursor-pointer">
              <input type="radio" v-model="editForm.gender" :value="g.value" class="accent-brand-purple" /> {{ g.label }}
            </label>
          </div>
        </div>
        <div><label class="text-xs text-text-dim">年龄</label><select v-model="editForm.age" class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple mt-1"><option value="">请选择</option><option v-for="a in ages" :key="a" :value="a">{{ a }}岁</option></select></div>
        <div>
          <label class="text-xs text-text-dim">喜好</label>
          <div class="flex flex-wrap gap-2 mt-1">
            <button v-for="t in tags" :key="t" @click="toggleTag(t)" type="button"
              class="px-2.5 py-1 rounded-full text-xs border transition-all"
              :class="editForm.prefers.includes(t) ? 'bg-brand-purple/30 border-brand-purple text-white' : 'bg-white/5 border-border-dim text-text-dim'">{{ t }}</button>
          </div>
        </div>
      </div>
      <template #actions>
        <button @click="showEdit = false" class="px-4 py-2 bg-transparent border border-border-dim text-text-muted rounded-lg text-sm hover:text-white">取消</button>
        <button @click="saveProfile" class="px-4 py-2 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppModal from '../components/AppModal.vue'

const router = useRouter()
const auth = useAuthStore()
const { get, post, put } = useApi()
const { show } = useToast()

const user = computed(() => auth.user)
const logs = ref([])
const amount = ref(null)
const recharging = ref(false)
const showEdit = ref(false)

const genders = [{ value: 'male', label: '男' }, { value: 'female', label: '女' }, { value: 'other', label: '其他' }]
const ages = Array.from({ length: 48 }, (_, i) => i + 13)
const tags = ['恋爱', '都市', '商战', '悬疑', '古装', '科幻', '喜剧', '恐怖', '校园', '奇幻']

const editForm = ref({ nickname: '', gender: '', age: '', prefers: [] })

const genderLabel = computed(() => {
  const g = genders.find(x => x.value === user.value?.gender)
  return g ? g.label : '-'
})

function typeLabel(t) {
  const map = { recharge: '充值', choice: '游戏消费', admin: '管理员调整', refund: '退款' }
  return map[t] || t
}

function formatTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString()
}

function toggleTag(t) {
  const i = editForm.value.prefers.indexOf(t)
  if (i >= 0) editForm.value.prefers.splice(i, 1)
  else editForm.value.prefers.push(t)
}

async function loadLogs() {
  try {
    const r = await get('/points/log')
    logs.value = r.logs || []
  } catch (e) { /* ignore */ }
}

async function doRecharge() {
  if (!amount.value || amount.value < 1) return show('请输入有效金额')
  recharging.value = true
  try {
    const r = await post('/recharge/self', { amount: amount.value })
    auth.user.points = r.points
    show('充值成功! +' + r.added + ' 积分')
    amount.value = null
    loadLogs()
  } catch (e) {
    show(e.message || '充值失败')
  } finally {
    recharging.value = false
  }
}

function openEdit() {
  editForm.value = {
    nickname: user.value?.nickname || '',
    gender: user.value?.gender || '',
    age: user.value?.age || '',
    prefers: user.value?.preferences ? user.value.preferences.split(',') : []
  }
  showEdit.value = true
}

async function saveProfile() {
  try {
    const r = await put('/auth/me', {
      nickname: editForm.value.nickname,
      gender: editForm.value.gender || null,
      age: editForm.value.age || null,
      preferences: editForm.value.prefers.join(',') || null
    })
    auth.user = { ...auth.user, ...r.user }
    show('资料已更新')
    showEdit.value = false
  } catch (e) {
    show(e.message || '保存失败')
  }
}

onMounted(loadLogs)
</script>
