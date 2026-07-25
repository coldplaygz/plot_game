<template>
  <div>
    <h2 class="text-xl text-white mb-5">👥 用户管理</h2>

    <!-- Search & Stats -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <input
        v-model="searchQuery"
        placeholder="搜索用户名/昵称..."
        class="px-4 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none w-64 focus:border-brand-purple"
        @keyup.enter="fetchUsers(1)"
      />
      <button @click="fetchUsers(1)" class="px-4 py-2 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark transition-colors">
        搜索
      </button>
      <span class="text-text-dim text-xs ml-auto">
        共 {{ pagination.total }} 个用户
      </span>
    </div>

    <!-- Users Table -->
    <div class="bg-surface-card border border-border-dim rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border-dim text-text-dim text-left text-xs uppercase">
              <th class="px-4 py-3">ID</th>
              <th class="px-4 py-3">用户名</th>
              <th class="px-4 py-3">昵称</th>
              <th class="px-4 py-3">角色</th>
              <th class="px-4 py-3">性别</th>
              <th class="px-4 py-3">年龄</th>
              <th class="px-4 py-3">积分</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">注册时间</th>
              <th class="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="border-b border-border-dim">
              <td colspan="10" class="px-4 py-8 text-center text-text-dimmer">加载中...</td>
            </tr>
            <tr v-else-if="users.length === 0" class="border-b border-border-dim">
              <td colspan="10" class="px-4 py-8 text-center text-text-dimmer">暂无用户</td>
            </tr>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b border-border-dim/50 hover:bg-white/[0.02] transition-colors"
              :class="{ 'opacity-60': !u.is_active }"
            >
              <td class="px-4 py-3 text-text-dim">{{ u.id }}</td>
              <td class="px-4 py-3 text-white font-medium">{{ u.username }}</td>
              <td class="px-4 py-3 text-text-subtle">{{ u.nickname || '-' }}</td>
              <td class="px-4 py-3">
                <span :class="roleClass(u.role)" class="px-2 py-0.5 rounded text-xs">
                  {{ roleLabel(u.role) }}
                </span>
              </td>
              <td class="px-4 py-3 text-text-dim">{{ genderLabel(u.gender) }}</td>
              <td class="px-4 py-3 text-text-dim">{{ u.age || '-' }}</td>
              <td class="px-4 py-3">
                <span class="text-brand-cyan font-semibold">{{ u.points || 0 }}</span>
              </td>
              <td class="px-4 py-3">
                <span :class="u.is_active ? 'text-green-400' : 'text-red-400'" class="text-xs">
                  {{ u.is_active ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-4 py-3 text-text-dim text-xs">{{ formatDate(u.created_at) }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <button @click="openEdit(u)" class="px-2.5 py-1 bg-brand-purple/20 text-brand-purple text-xs rounded hover:bg-brand-purple/30 transition-colors">编辑</button>
                  <button
                    @click="toggleUser(u)"
                    :class="u.is_active ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'"
                    class="px-2.5 py-1 text-xs rounded transition-colors"
                  >{{ u.is_active ? '禁用' : '启用' }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-2 px-4 py-3 border-t border-border-dim">
        <button
          v-for="p in pagination.totalPages"
          :key="p"
          @click="fetchUsers(p)"
          :class="p === pagination.page ? 'bg-brand-purple text-white' : 'bg-white/5 text-text-dim hover:bg-white/10'"
          class="w-8 h-8 rounded text-xs transition-colors"
        >{{ p }}</button>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editUser" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="editUser = null">
      <div class="bg-surface-card border border-border-dim rounded-2xl p-6 w-[480px] max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg text-white mb-4">编辑用户 #{{ editUser.id }}</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-text-dim mb-1">昵称</label>
            <input v-model="editUser.nickname" class="w-full px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div>
            <label class="block text-xs text-text-dim mb-1">性别</label>
            <select v-model="editUser.gender" class="w-full px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
              <option value="">未设置</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-text-dim mb-1">年龄</label>
            <input v-model.number="editUser.age" type="number" min="1" max="120" class="w-full px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div>
            <label class="block text-xs text-text-dim mb-1">喜好</label>
            <input v-model="editUser.preferences" placeholder="逗号分隔" class="w-full px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div v-if="auth.isAdmin">
            <label class="block text-xs text-text-dim mb-1">角色</label>
            <select v-model="editUser.role" class="w-full px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
              <option value="player">玩家</option>
              <option value="editor">编辑</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div v-if="auth.isAdmin">
            <label class="block text-xs text-text-dim mb-1">积分</label>
            <input v-model.number="editUser.points" type="number" min="0" class="w-full px-3 py-2 bg-black/30 border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
        </div>

        <div class="flex gap-2 mt-5">
          <button @click="saveEdit" class="flex-1 py-2 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark transition-colors">保存</button>
          <button @click="editUser = null" class="px-4 py-2 bg-white/5 text-text-dim rounded-lg text-sm hover:bg-white/10 transition-colors">取消</button>
        </div>

        <div v-if="editError" class="text-red-400 text-xs mt-2">{{ editError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const { get, put, patch } = useApi()

const users = ref([])
const loading = ref(false)
const searchQuery = ref('')
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

// Edit modal
const editUser = ref(null)
const editError = ref('')

function roleLabel(role) {
  const map = { admin: '管理员', editor: '编辑', player: '玩家' }
  return map[role] || role
}

function roleClass(role) {
  const map = { admin: 'bg-red-500/20 text-red-400', editor: 'bg-blue-500/20 text-blue-400', player: 'bg-white/10 text-text-dim' }
  return map[role] || ''
}

function genderLabel(g) {
  const map = { male: '男', female: '女', other: '其他' }
  return map[g] || '-'
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function fetchUsers(page = 1) {
  loading.value = true
  try {
    const params = { page, limit: pagination.value.limit }
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
    const res = await get('/users', params)
    users.value = res.users || []
    pagination.value = res.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function toggleUser(u) {
  if (!confirm(`确定要${u.is_active ? '禁用' : '启用'}用户 "${u.username}" 吗？`)) return
  try {
    const res = await patch(`/users/${u.id}/toggle`)
    u.is_active = res.is_active ? 1 : 0
  } catch (e) {
    alert(e.message)
  }
}

function openEdit(u) {
  editUser.value = { ...u }
  editError.value = ''
}

async function saveEdit() {
  editError.value = ''
  const u = editUser.value
  if (!u) return
  try {
    const body = { nickname: u.nickname, gender: u.gender, age: u.age, preferences: u.preferences }
    if (auth.isAdmin) {
      body.role = u.role
      body.points = u.points
    }
    const res = await put(`/users/${u.id}`, body)
    // Update in list
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx >= 0) users.value[idx] = res.user
    editUser.value = null
  } catch (e) {
    editError.value = e.message
  }
}

onMounted(() => fetchUsers())
</script>
