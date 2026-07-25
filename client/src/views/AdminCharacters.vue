<template>
  <div>
    <h2 class="text-xl text-white mb-5">👩 角色管理</h2>

    <!-- Toolbar -->
    <div class="flex gap-[10px] mb-4 flex-wrap items-center">
      <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openCharModal(0)">+ 添加角色</button>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">名称</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">性格</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">描述</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">状态</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!pageChars.length">
          <td colspan="6" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无角色</td>
        </tr>
        <tr v-for="c in pageChars" :key="c.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <span class="inline-block w-[10px] h-[10px] rounded-full mr-[6px]" :style="{ '--dot-color': c.color, background: 'var(--dot-color)' }"></span>
            {{ c.name }}
          </td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.personality || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (c.description || '').slice(0, 30) || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.is_hidden ? '🔒 隐藏' : '👁 可见' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openCharModal(c.id)">编辑</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <AppPagination
      :page="page"
      :total="characters.length"
      :pageSize="pageSize"
      @update="onPageChange"
    />

    <!-- Char Edit Modal -->
    <AppModal
      :visible="charModalVisible"
      :title="editingCharId > 0 ? '编辑角色' : '添加角色'"
      @close="charModalVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">角色名 *</label>
        <input v-model="charForm.name" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">性格标签</label>
        <input v-model="charForm.personality" placeholder="如: 温柔/善良/害羞" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">描述</label>
        <textarea v-model="charForm.description" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y min-h-[70px]"></textarea>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">主题色</label>
        <input v-model="charForm.color" type="color" class="w-[60px] h-[35px]" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">声优</label>
        <input v-model="charForm.voice_actor" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">生日</label>
        <input v-model="charForm.birthday" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px] flex items-center gap-2">
        <label class="text-xs text-text-dim">隐藏角色</label>
        <input v-model="charForm.is_hidden" type="checkbox" class="w-auto" />
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="charModalVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveChar">保存</button>
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

const { get, post, put } = useApi()
const { show } = useToast()

const characters = ref([])
const page = ref(1)
const pageSize = ref(10)

const pageChars = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return characters.value.slice(start, start + pageSize.value)
})

function onPageChange(p, ps) {
  page.value = p
  pageSize.value = ps
}

// Char Edit Modal
const charModalVisible = ref(false)
const editingCharId = ref(0)
const charForm = ref(getEmptyCharForm())

function getEmptyCharForm() {
  return {
    name: '', personality: '', description: '', color: '#e91e63',
    voice_actor: '', birthday: '', is_hidden: false
  }
}

async function openCharModal(id) {
  editingCharId.value = id
  if (id > 0) {
    try {
      const r = await get('/characters/' + id)
      const c = r.character || {}
      charForm.value = {
        name: c.name || '',
        personality: c.personality || '',
        description: c.description || '',
        color: c.color || '#e91e63',
        voice_actor: c.voice_actor || '',
        birthday: c.birthday || '',
        is_hidden: !!c.is_hidden
      }
    } catch (e) {
      show('加载角色失败')
      return
    }
  } else {
    charForm.value = getEmptyCharForm()
  }
  charModalVisible.value = true
}

async function saveChar() {
  const data = {
    name: charForm.value.name,
    personality: charForm.value.personality,
    description: charForm.value.description,
    color: charForm.value.color,
    voice_actor: charForm.value.voice_actor,
    birthday: charForm.value.birthday,
    is_hidden: charForm.value.is_hidden
  }
  if (!data.name) return show('请输入角色名')

  try {
    if (editingCharId.value > 0) {
      await put('/characters/' + editingCharId.value, data)
    } else {
      await post('/characters', data)
    }
    show('保存成功')
    charModalVisible.value = false
    loadCharacters()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function loadCharacters() {
  try {
    const r = await get('/characters/all')
    characters.value = r.characters || []
  } catch (e) {
    show('加载角色失败: ' + e.message)
  }
}

onMounted(loadCharacters)
</script>
