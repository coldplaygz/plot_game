<template>
  <div>
    <h2 class="text-xl text-white mb-5">🎮 游戏管理</h2>

    <!-- Toolbar -->
    <div class="flex gap-3 mb-5">
      <button class="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-purple text-white border-none rounded-lg text-sm cursor-pointer hover:bg-brand-purple-dark transition-all" @click="openCreate">+ 新建游戏</button>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">封面</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标题</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">分类</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">视频</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">场景</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">发布</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!games.length"><td colspan="8" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无游戏</td></tr>
        <tr v-for="g in games" :key="g.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ g.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <div v-if="g.cover_image" class="w-[60px] h-[34px] rounded overflow-hidden"><img :src="'/' + g.cover_image" :alt="g.title" class="w-full h-full object-cover" /></div>
            <div v-else class="w-[60px] h-[34px] rounded bg-surface-darkest flex items-center justify-center text-xs text-text-dimmest">{{ g.title?.charAt(0) || '?' }}</div>
          </td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] font-medium">{{ g.title }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]"><span v-if="g.category" class="px-2 py-0.5 bg-brand-purple/20 text-brand-purple text-xs rounded-full">{{ g.category }}</span><span v-else class="text-text-dimmest">-</span></td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ g.video_count || 0 }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ g.scene_count || 0 }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]"><span :class="g.is_published ? 'text-[#22c55e]' : 'text-text-dimmer'">{{ g.is_published ? '✅' : '—' }}</span></td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple mr-1" @click="openEdit(g)">编辑</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c]" @click="deleteGame(g.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Create/Edit Modal -->
    <AppModal :visible="modalVisible" :title="isEditing ? '编辑游戏' : '新建游戏'" @close="modalVisible = false">
      <div class="space-y-4 mt-2">
        <div>
          <label class="block text-xs text-text-dim mb-1">标题 <span class="text-red-500">*</span></label>
          <input v-model="form.title" class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" placeholder="游戏标题" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">🌐 多语言标题</label>
          <div class="grid grid-cols-3 gap-2">
            <input v-model="form.title_en" placeholder="English" class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
            <input v-model="form.title_ja" placeholder="日本語" class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
            <input v-model="form.title_ko" placeholder="한국어" class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">简介</label>
          <textarea v-model="form.description" rows="3" class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple resize-none" placeholder="游戏简介..."></textarea>
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">🌐 多语言简介</label>
          <div class="grid grid-cols-3 gap-2">
            <textarea v-model="form.desc_en" rows="2" placeholder="English" class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple resize-none"></textarea>
            <textarea v-model="form.desc_ja" rows="2" placeholder="日本語" class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple resize-none"></textarea>
            <textarea v-model="form.desc_ko" rows="2" placeholder="한국어" class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple resize-none"></textarea>
          </div>
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">分类</label>
          <input v-model="form.category" class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" placeholder="例如：悬疑、爱情、冒险" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">封面图片</label>
          <input ref="coverInput" type="file" accept=".jpg,.jpeg,.png,.webp" class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none" @change="onCoverSelected" />
          <div v-if="form.cover_preview" class="mt-2 w-[120px] h-[68px] rounded overflow-hidden border border-border-dim"><img :src="form.cover_preview.startsWith('data:') ? form.cover_preview : '/' + form.cover_preview" alt="预览" class="w-full h-full object-cover" /></div>
        </div>
        <div>
          <label class="flex items-center gap-2 text-xs text-text-dim cursor-pointer"><input v-model="form.is_published" type="checkbox" class="rounded" /> 发布（公开可见）</label>
        </div>
      </div>
      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="modalVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" :disabled="saving" @click="saveGame">{{ saving ? '保存中...' : '保存' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppModal from '../components/AppModal.vue'

const { get, post, put, del } = useApi()
const { show } = useToast()

const games = ref([])
const modalVisible = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const coverInput = ref(null)

const emptyForm = () => ({
  id: null, title: '', description: '', category: '', cover_image: null, cover_preview: null, is_published: false,
  title_en: '', title_ja: '', title_ko: '', desc_en: '', desc_ja: '', desc_ko: ''
})
const form = ref(emptyForm())

function resetForm() {
  form.value = emptyForm()
  if (coverInput.value) coverInput.value.value = ''
}

function buildI18n(prefix) {
  const o = {}
  if (form.value[prefix + 'en']) o.en = form.value[prefix + 'en']
  if (form.value[prefix + 'ja']) o.ja = form.value[prefix + 'ja']
  if (form.value[prefix + 'ko']) o.ko = form.value[prefix + 'ko']
  return Object.keys(o).length > 0 ? JSON.stringify(o) : null
}

function loadI18n(json, prefix) {
  try { const o = JSON.parse(json || '{}'); ['en','ja','ko'].forEach(k => form.value[prefix + k] = o[k] || '') } catch {}
}

async function loadGames() {
  try { const res = await get('/games'); games.value = res.games || [] } catch (e) { show('加载失败: ' + e.message) }
}

function openCreate() { resetForm(); isEditing.value = false; modalVisible.value = true }

function openEdit(g) {
  isEditing.value = true
  form.value = { id: g.id, title: g.title || '', description: g.description || '', category: g.category || '', cover_image: null, cover_preview: g.cover_image || null, is_published: !!g.is_published }
  loadI18n(g.title_i18n, 'title_')
  loadI18n(g.description_i18n, 'desc_')
  modalVisible.value = true
}

function onCoverSelected() {
  const file = coverInput.value?.files?.[0]
  if (!file) return
  form.value.cover_image = file
  const reader = new FileReader()
  reader.onload = (e) => { form.value.cover_preview = e.target.result }
  reader.readAsDataURL(file)
}

async function saveGame() {
  if (!form.value.title.trim()) return show('请输入游戏标题')
  saving.value = true
  try {
    const fd = new FormData()
    fd.append('title', form.value.title.trim())
    fd.append('description', form.value.description || '')
    fd.append('category', form.value.category || '')
    fd.append('is_published', form.value.is_published ? '1' : '0')
    const ti = buildI18n('title_'); if (ti) fd.append('title_i18n', ti)
    const di = buildI18n('desc_'); if (di) fd.append('description_i18n', di)
    if (form.value.cover_image instanceof File) fd.append('cover_image', form.value.cover_image)

    if (isEditing.value) { await put('/games/' + form.value.id, fd); show('游戏已更新') }
    else { await post('/games', fd); show('游戏已创建') }

    modalVisible.value = false; resetForm(); await loadGames()
  } catch (e) { show('保存失败: ' + e.message) }
  finally { saving.value = false }
}

async function deleteGame(id) {
  if (!confirm('确定删除该游戏？')) return
  try { await del('/games/' + id); show('已删除'); loadGames() }
  catch (e) { show('删除失败: ' + e.message) }
}

onMounted(loadGames)
</script>
