<template>
  <div>
    <h2 class="text-xl text-white mb-5">💰 充值管理</h2>

    <!-- Recharge Form -->
    <div class="bg-surface-card border border-border-dim rounded-xl p-5 mb-6">
      <h3 class="text-sm text-white mb-4 font-medium">新建充值</h3>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-text-dim mb-1">用户ID</label>
          <input
            v-model.number="form.user_id"
            type="number"
            min="1"
            placeholder="输入用户ID"
            class="w-32 px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
          />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">快捷查找</label>
          <div class="relative">
            <input
              v-model="userSearch"
              placeholder="输入用户名搜索..."
              class="w-48 px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
              @keyup.enter="searchUser"
            />
            <button @click="searchUser" class="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-brand-purple text-white text-xs rounded">搜</button>
          </div>
        </div>
        <div v-if="searchResults.length > 0" class="flex flex-wrap gap-1">
          <button
            v-for="u in searchResults"
            :key="u.id"
            @click="selectUser(u)"
            class="px-2 py-1 bg-white/10 text-text-dim text-xs rounded hover:bg-brand-purple/20 hover:text-brand-purple transition-colors"
          >{{ u.username }} (ID:{{ u.id }})</button>
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">充值金额(元)</label>
          <input
            v-model.number="form.amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="金额"
            class="w-32 px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
          />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">获得积分</label>
          <input
            v-model.number="form.points"
            type="number"
            min="1"
            placeholder="积分"
            class="w-32 px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
          />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">支付方式</label>
          <select v-model="form.payment_method" class="w-28 px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
            <option value="manual">手动充值</option>
            <option value="wechat">微信支付</option>
            <option value="alipay">支付宝</option>
            <option value="bank">银行转账</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">备注</label>
          <input
            v-model="form.remark"
            placeholder="备注信息"
            class="w-40 px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple"
          />
        </div>
        <button @click="doRecharge" class="px-5 py-2 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark transition-colors">
          确认充值
        </button>
      </div>
      <div v-if="rechargeError" class="text-red-400 text-xs mt-2">{{ rechargeError }}</div>
      <div v-if="rechargeSuccess" class="text-green-400 text-xs mt-2">{{ rechargeSuccess }}</div>
    </div>

    <!-- Records Table -->
    <div class="bg-surface-card border border-border-dim rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border-dim text-text-dim text-left text-xs uppercase">
              <th class="px-4 py-3">ID</th>
              <th class="px-4 py-3">用户</th>
              <th class="px-4 py-3">金额</th>
              <th class="px-4 py-3">积分</th>
              <th class="px-4 py-3">支付方式</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">操作员</th>
              <th class="px-4 py-3">备注</th>
              <th class="px-4 py-3">时间</th>
              <th class="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="border-b border-border-dim">
              <td colspan="10" class="px-4 py-8 text-center text-text-dimmer">加载中...</td>
            </tr>
            <tr v-else-if="records.length === 0" class="border-b border-border-dim">
              <td colspan="10" class="px-4 py-8 text-center text-text-dimmer">暂无充值记录</td>
            </tr>
            <tr v-for="r in records" :key="r.id" class="border-b border-border-dim/50 hover:bg-white/[0.02] transition-colors">
              <td class="px-4 py-3 text-text-dim">{{ r.id }}</td>
              <td class="px-4 py-3 text-white">{{ r.username || r.nickname || `#${r.user_id}` }}</td>
              <td class="px-4 py-3 text-brand-cyan font-semibold">¥{{ r.amount }}</td>
              <td class="px-4 py-3 text-brand-purple font-semibold">+{{ r.points }}</td>
              <td class="px-4 py-3 text-text-dim text-xs">{{ paymentLabel(r.payment_method) }}</td>
              <td class="px-4 py-3">
                <span :class="statusClass(r.status)" class="px-2 py-0.5 rounded text-xs">{{ statusLabel(r.status) }}</span>
              </td>
              <td class="px-4 py-3 text-text-dim text-xs">{{ r.operator_name || '-' }}</td>
              <td class="px-4 py-3 text-text-dim text-xs max-w-[120px] truncate">{{ r.remark || '-' }}</td>
              <td class="px-4 py-3 text-text-dim text-xs">{{ formatDate(r.created_at) }}</td>
              <td class="px-4 py-3">
                <select
                  v-if="r.status !== 'cancelled'"
                  @change="updateStatus(r, $event.target.value)"
                  class="px-2 py-1 bg-black/30 border border-border-dim rounded text-xs text-white outline-none"
                >
                  <option :selected="r.status === 'completed'" value="completed">已完成</option>
                  <option :selected="r.status === 'pending'" value="pending">待处理</option>
                  <option value="cancelled">取消</option>
                </select>
                <span v-else class="text-text-dimmest text-xs">已取消</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-2 px-4 py-3 border-t border-border-dim">
        <button
          v-for="p in pagination.totalPages"
          :key="p"
          @click="fetchRecords(p)"
          :class="p === pagination.page ? 'bg-brand-purple text-white' : 'bg-white/5 text-text-dim hover:bg-white/10'"
          class="w-8 h-8 rounded text-xs transition-colors"
        >{{ p }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'

const { get, post, put } = useApi()

const records = ref([])
const loading = ref(false)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

// Form
const form = ref({ user_id: null, amount: null, points: null, payment_method: 'manual', remark: '' })
const rechargeError = ref('')
const rechargeSuccess = ref('')

// User search
const userSearch = ref('')
const searchResults = ref([])

function paymentLabel(m) {
  const map = { manual: '手动充值', wechat: '微信支付', alipay: '支付宝', bank: '银行转账' }
  return map[m] || m
}

function statusLabel(s) {
  const map = { pending: '待处理', completed: '已完成', cancelled: '已取消' }
  return map[s] || s
}

function statusClass(s) {
  const map = { pending: 'bg-yellow-500/20 text-yellow-400', completed: 'bg-green-500/20 text-green-400', cancelled: 'bg-red-500/20 text-red-400' }
  return map[s] || ''
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function searchUser() {
  if (!userSearch.value.trim()) return
  try {
    const res = await get('/users', { search: userSearch.value.trim(), limit: 5 })
    searchResults.value = res.users || []
  } catch (e) {
    searchResults.value = []
  }
}

function selectUser(u) {
  form.value.user_id = u.id
  userSearch.value = u.username
  searchResults.value = []
}

async function doRecharge() {
  rechargeError.value = ''
  rechargeSuccess.value = ''
  const f = form.value
  if (!f.user_id || !f.amount || !f.points) {
    rechargeError.value = '请填写用户ID、金额和积分'
    return
  }
  if (f.amount <= 0 || f.points <= 0) {
    rechargeError.value = '金额和积分必须大于0'
    return
  }
  try {
    const res = await post('/recharge', {
      user_id: f.user_id,
      amount: f.amount,
      points: f.points,
      payment_method: f.payment_method,
      remark: f.remark
    })
    rechargeSuccess.value = `充值成功！用户 #${res.user_id} 获得 ${res.points} 积分，当前余额 ${res.balance} 积分`
    // Reset form
    form.value = { user_id: null, amount: null, points: null, payment_method: 'manual', remark: '' }
    userSearch.value = ''
    fetchRecords(1)
  } catch (e) {
    rechargeError.value = e.message
  }
}

async function fetchRecords(page = 1) {
  loading.value = true
  try {
    const res = await get('/recharge', { page, limit: pagination.value.limit })
    records.value = res.records || []
    pagination.value = res.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function updateStatus(record, newStatus) {
  try {
    await put(`/recharge/${record.id}`, { status: newStatus })
    record.status = newStatus
  } catch (e) {
    alert(e.message)
  }
}

onMounted(() => fetchRecords())
</script>
