<template>
  <div>
    <h2 class="text-xl text-white mb-5">📊 积分记录</h2>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4 items-center">
      <label class="text-xs text-text-dim">用户：</label>
      <select v-model="filterUserId" @change="loadLogs"
        class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
        <option :value="null">全部用户</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.nickname || u.username }}</option>
      </select>
      <label class="text-xs text-text-dim ml-2">类型：</label>
      <select v-model="filterType" @change="loadLogs"
        class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
        <option value="">全部</option>
        <option value="recharge">充值</option>
        <option value="choice">游戏消费</option>
        <option value="admin">管理员调整</option>
        <option value="refund">退款</option>
      </select>
      <span class="text-xs text-text-dimmer ml-auto">共 {{ pagination.total }} 条</span>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">用户</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">类型</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">积分变动</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作人</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">余额</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">备注</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!logs.length">
          <td colspan="8" class="text-center py-[50px] text-text-dimmest text-sm">暂无记录</td>
        </tr>
        <tr v-for="l in logs" :key="l.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ l.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ l.nickname || l.username }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <span :class="typeClass(l.type)" class="px-2 py-0.5 rounded text-xs">{{ typeLabel(l.type) }}</span>
          </td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] font-medium" :class="l.points > 0 ? 'text-green-400' : 'text-red-400'">
            {{ l.points > 0 ? '+' : '' }}{{ l.points }}
          </td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">{{ operatorLabel(l) }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ l.balance }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">{{ l.remark || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer text-xs">{{ formatTime(l.created_at) }}</td>
        </tr>
      </tbody>
    </table>

    <AppPagination :page="page" :total="pagination.total" :pageSize="pageSize" @update="onPageChange" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import AppPagination from '../components/AppPagination.vue'

const { get } = useApi()

const logs = ref([])
const users = ref([])
const filterUserId = ref(null)
const filterType = ref('')
const page = ref(1)
const pageSize = ref(50)
const pagination = ref({ total: 0 })

const typeMap = { recharge: '充值', choice: '消费', admin: '调整', refund: '退款' }
function typeLabel(t) { return typeMap[t] || t }
function operatorLabel(l) {
  if (l.type === 'choice') return '系统'
  if (l.type === 'recharge' && !l.operator_name) return '自助充值'
  return l.operator_name || '-'
}
function typeClass(t) {
  const m = { recharge: 'bg-green-500/15 text-green-400', choice: 'bg-red-500/15 text-red-400', admin: 'bg-blue-500/15 text-blue-400', refund: 'bg-yellow-500/15 text-yellow-400' }
  return m[t] || 'bg-zinc-500/15 text-zinc-400'
}
function formatTime(d) { return d ? new Date(d).toLocaleString() : '-' }

async function loadLogs() {
  try {
    const params = { page: page.value, limit: pageSize.value }
    if (filterUserId.value) params.user_id = filterUserId.value
    if (filterType.value) params.type = filterType.value
    const r = await get('/points/admin/log', params)
    logs.value = r.logs || []
    pagination.value = r.pagination || { total: 0 }
  } catch (e) { /* ignore */ }
}

async function loadUsers() {
  try {
    const r = await get('/users', { limit: 200 })
    users.value = r.users || []
  } catch {}
}

function onPageChange(p, ps) {
  page.value = p
  pageSize.value = ps
  loadLogs()
}

onMounted(() => { loadLogs(); loadUsers() })
</script>
