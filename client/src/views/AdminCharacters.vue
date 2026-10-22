<template>
  <div class="space-y-4">
    <!-- 顶部：游戏选择 + 添加 -->
    <div class="flex items-end gap-3 flex-wrap">
      <div>
        <label class="block text-xs text-text-dim mb-1">选择游戏</label>
        <select v-model="selectedGameId" class="picker">
          <option :value="null" disabled>请选择游戏</option>
          <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }} (#{{ g.id }})</option>
        </select>
      </div>
      <div class="ml-auto">
        <button class="btn-purple" :disabled="!selectedGameId" @click="resetCharForm(); formOpen = true">+ 添加角色</button>
      </div>
    </div>

    <div class="text-[12px] text-text-dim leading-relaxed bg-surface-dark border border-border-dim rounded-lg px-4 py-2.5">
      角色按游戏归属，用于对白头像显示：在对白管理/场景对白编辑时下拉选择角色，播放器对白气泡左侧显示对应头像。
    </div>

    <!-- 角色卡片列表 -->
    <div v-if="!selectedGameId" class="text-center py-10 text-text-dimmest text-sm">请先选择游戏</div>
    <div v-else-if="!characters.length" class="text-center py-10 text-text-dimmest text-sm">该游戏暂无角色，点击右上角添加</div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div v-for="ch in characters" :key="ch.id"
        class="border border-border-dim rounded-xl p-4 bg-surface-darkest flex flex-col items-center text-center gap-2">
        <img v-if="ch.avatar" :src="'/' + ch.avatar"
          class="w-16 h-16 rounded-full object-cover border-2 shrink-0"
          :style="{ borderColor: ch.color || '#e91e63' }" />
        <div v-else class="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl shrink-0"
          :style="{ background: ch.color || '#e91e63' }">{{ ch.name.charAt(0) }}</div>
        <div class="text-white text-[14px]">{{ ch.name }}</div>
        <div class="text-text-dimmest text-[10px]">排序 {{ ch.sort_order }} · {{ ch.dialogue_count || 0 }} 条对白引用</div>
        <div class="flex gap-1.5">
          <button class="d-btn bg-[#2563eb] hover:bg-[#1d4ed8]" @click="openCharEdit(ch)">编辑</button>
          <button class="d-btn bg-[#dc2626] hover:bg-[#b91c1c]" @click="deleteChar(ch.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑角色弹窗 -->
    <AppModal
      :visible="formOpen"
      :title="charForm.id ? '编辑角色 #' + charForm.id : '添加角色'"
      @close="formOpen = false"
    >
      <div class="flex items-center gap-3 mb-[14px]">
        <img v-if="charAvatarPreview" :src="charAvatarPreview"
          class="w-16 h-16 rounded-full object-cover border-2 shrink-0"
          :style="{ borderColor: charForm.color || '#e91e63' }" />
        <div v-else class="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg shrink-0"
          :style="{ background: charForm.color || '#e91e63' }">{{ charForm.name ? charForm.name.charAt(0) : '?' }}</div>
        <label class="btn-ghost cursor-pointer">
          {{ charForm.id ? '更换头像' : '上传头像' }}
          <input type="file" accept="image/*" class="hidden" @change="onCharAvatarChange" />
        </label>
        <span v-if="charForm.avatarFile" class="text-[11px] text-text-dimmer truncate max-w-[160px]">{{ charForm.avatarFile.name }}</span>
        <span v-else-if="charForm.id && charForm.hasAvatar" class="text-[11px] text-text-dimmer">保留现有头像</span>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">角色名 *</label>
        <input v-model="charForm.name" placeholder="如: 林小雨" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="grid grid-cols-2 gap-3 mb-[14px]">
        <div>
          <label class="block text-xs text-text-dim mb-1">主题色 <span class="text-text-dimmer">(头像边框/说话人名颜色)</span></label>
          <input v-model="charForm.color" placeholder="#e91e63" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">排序</label>
          <input v-model.number="charForm.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>

      <template #actions>
        <button class="btn-ghost" @click="formOpen = false">取消</button>
        <button class="btn-purple" @click="saveChar">{{ charForm.id ? '保存修改' : '创建角色' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppModal from '../components/AppModal.vue'

const { get, post, put, del } = useApi()
const { show } = useToast()

const games = ref([])
const selectedGameId = ref(null)
const characters = ref([])

async function loadGames() {
  try { const r = await get('/games?limit=100'); games.value = r.games || [] } catch {}
}

async function loadCharacters() {
  if (!selectedGameId.value) { characters.value = []; return }
  try {
    const r = await get('/characters/game/' + selectedGameId.value)
    characters.value = r.characters || []
  } catch (e) { show('加载角色失败') }
}

watch(selectedGameId, loadCharacters)

const formOpen = ref(false)
const charAvatarPreview = ref(null)
const charForm = ref(getEmptyCharForm())

function getEmptyCharForm() {
  return { id: 0, name: '', color: '#e91e63', sort_order: 0, avatarFile: null, hasAvatar: false }
}

function onCharAvatarChange(e) {
  const f = e.target.files[0]
  charForm.value.avatarFile = f || null
  charAvatarPreview.value = f ? URL.createObjectURL(f) : null
}

function openCharEdit(ch) {
  charForm.value = { id: ch.id, name: ch.name, color: ch.color || '#e91e63',
    sort_order: ch.sort_order || 0, avatarFile: null, hasAvatar: !!ch.avatar }
  charAvatarPreview.value = ch.avatar ? '/' + ch.avatar : null
  formOpen.value = true
}

function resetCharForm() {
  charForm.value = getEmptyCharForm()
  charAvatarPreview.value = null
}

async function saveChar() {
  if (!charForm.value.name.trim()) return show('请输入角色名')
  const fd = new FormData()
  fd.append('name', charForm.value.name)
  fd.append('color', charForm.value.color || '#e91e63')
  fd.append('sort_order', charForm.value.sort_order || 0)
  if (charForm.value.avatarFile) fd.append('avatar', charForm.value.avatarFile)
  try {
    if (charForm.value.id > 0) {
      await put('/characters/' + charForm.value.id, fd)
      show('角色已更新')
    } else {
      fd.append('game_id', selectedGameId.value)
      await post('/characters', fd)
      show('角色已创建')
    }
    formOpen.value = false
    resetCharForm()
    loadCharacters()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteChar(id) {
  if (!confirm('删除该角色?（场景对白保留, 角色关联解除）')) return
  try {
    await del('/characters/' + id)
    show('已删除')
    loadCharacters()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

onMounted(loadGames)
</script>

<style scoped>
@reference "../style.css";
.picker {
  @apply px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple;
}
.btn-purple {
  @apply inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark disabled:opacity-40 disabled:cursor-not-allowed;
}
.btn-ghost {
  @apply inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple;
}
.d-btn {
  @apply inline-flex items-center px-2.5 py-[5px] border-none rounded-md text-[11px] cursor-pointer text-white transition-all duration-200;
}
</style>
