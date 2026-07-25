<template>
  <div>
    <h2 class="text-xl text-white mb-5">🏆 结局管理</h2>

    <!-- Toolbar -->
    <div class="flex gap-[10px] mb-4 flex-wrap items-center">
      <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openEndingModal(0)">+ 添加结局</button>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标题</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">类型</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">角色</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">描述</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!pageEndings.length">
          <td colspan="6" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无结局</td>
        </tr>
        <tr v-for="e in pageEndings" :key="e.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ e.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ e.title }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ typeLabel(e.type) }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ charMap[e.character_id] || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (e.description || '').slice(0, 30) || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openEndingModal(e.id)">编辑</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteEndingItem(e.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <AppPagination
      :page="page"
      :total="endings.length"
      :pageSize="pageSize"
      @update="onPageChange"
    />

    <!-- Ending Edit Modal -->
    <AppModal
      :visible="endingModalVisible"
      :title="editingEndingId > 0 ? '编辑结局' : '添加结局'"
      @close="endingModalVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">结局标题 *</label>
        <input v-model="endingForm.title" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">描述</label>
        <textarea v-model="endingForm.description" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y min-h-[70px]"></textarea>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">类型</label>
        <select v-model="endingForm.type" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option value="perfect">完美</option>
          <option value="good">好结局</option>
          <option value="normal">普通</option>
          <option value="bad">坏结局</option>
          <option value="hidden">隐藏</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">关联角色</label>
        <select v-model="endingForm.character_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">无</option>
          <option v-for="c in charList" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">解锁条件描述</label>
        <input v-model="endingForm.unlock_condition" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="endingModalVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveEnding">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppPagination from '../components/AppPagination.vue'
import AppModal from '../components/AppModal.vue'

const { get, post, put, del } = useApi()
const { show } = useToast()

const endings = ref([])
const page = ref(1)
const pageSize = ref(10)
const charMap = ref({})

const pageEndings = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return endings.value.slice(start, start + pageSize.value)
})

function onPageChange(p, ps) {
  page.value = p
  pageSize.value = ps
}

function typeLabel(type) {
  const map = { perfect: '完美', good: '好结局', normal: '普通', bad: '坏结局', hidden: '隐藏' }
  return map[type] || type || 'normal'
}

// Ending Edit Modal
const endingModalVisible = ref(false)
const editingEndingId = ref(0)
const endingForm = ref(getEmptyEndingForm())
const charList = ref([])

function getEmptyEndingForm() {
  return {
    title: '', description: '', type: 'normal', character_id: null, unlock_condition: ''
  }
}

async function openEndingModal(id) {
  editingEndingId.value = id

  // Load characters for dropdown
  try {
    const cr = await get('/characters/all')
    charList.value = cr.characters || []
  } catch (e) { /* ignore */ }

  if (id > 0) {
    // Find ending from the list
    const found = endings.value.find(e => e.id === id)
    if (found) {
      endingForm.value = {
        title: found.title || '',
        description: found.description || '',
        type: found.type || 'normal',
        character_id: found.character_id || null,
        unlock_condition: found.unlock_condition || ''
      }
    } else {
      endingForm.value = getEmptyEndingForm()
    }
  } else {
    endingForm.value = getEmptyEndingForm()
  }
  endingModalVisible.value = true
}

async function saveEnding() {
  const data = {
    title: endingForm.value.title,
    description: endingForm.value.description,
    type: endingForm.value.type,
    character_id: endingForm.value.character_id ? parseInt(endingForm.value.character_id) : null,
    unlock_condition: endingForm.value.unlock_condition
  }
  if (!data.title) return show('请输入标题')

  try {
    if (editingEndingId.value > 0) {
      await put('/endings/' + editingEndingId.value, data)
    } else {
      await post('/endings', data)
    }
    show('保存成功')
    endingModalVisible.value = false
    loadEndings()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteEndingItem(id) {
  if (!confirm('确定删除?')) return
  try {
    await del('/endings/' + id)
    show('已删除')
    loadEndings()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

async function loadEndings() {
  try {
    const [er, cr] = await Promise.all([
      get('/endings'),
      get('/characters/all')
    ])
    endings.value = er.endings || []
    const map = {}
    ;(cr.characters || []).forEach(c => { map[c.id] = c.name })
    charMap.value = map
  } catch (e) {
    show('加载结局失败: ' + e.message)
  }
}

onMounted(loadEndings)
</script>
