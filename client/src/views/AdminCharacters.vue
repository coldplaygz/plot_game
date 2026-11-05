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
      角色按游戏归属，用于对白形象显示：在对白管理/场景对白编辑时下拉选择角色，播放器对白以「角色立绘形象 + 名牌对话框」样式显示。建议上传透明背景（PNG）的整身形象图。
    </div>

    <!-- 角色卡片列表 -->
    <div v-if="!selectedGameId" class="text-center py-10 text-text-dimmest text-sm">请先选择游戏</div>
    <div v-else-if="!characters.length" class="text-center py-10 text-text-dimmest text-sm">该游戏暂无角色，点击右上角添加</div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div v-for="ch in characters" :key="ch.id"
        class="border border-border-dim rounded-xl p-4 bg-surface-darkest flex flex-col items-center text-center gap-2">
        <img v-if="ch.avatar" :src="'/' + ch.avatar"
          class="w-24 h-28 rounded-lg object-contain bg-white/5 border-2 shrink-0"
          :style="{ borderColor: ch.color || '#e91e63' }" />
        <div v-else class="w-24 h-28 rounded-lg flex items-center justify-center text-white text-xl shrink-0"
          :style="{ background: ch.color || '#e91e63' }">{{ ch.name.charAt(0) }}</div>
        <div class="text-white text-[14px] flex items-center gap-1.5">
          <span>{{ ch.name }}</span>
          <span v-if="ch.is_protagonist"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border bg-amber-500/15 border-amber-400/40 text-amber-300">👑 主角</span>
        </div>
        <div class="text-text-dimmest text-[10px]">排序 {{ ch.sort_order }} · {{ ch.dialogue_count || 0 }} 条对白引用 · {{ (ch.expressions || []).length }} 个表情</div>
        <button v-if="(ch.expressions || []).length || editingExprOf !== ch.id"
          class="d-btn bg-white/10 hover:bg-white/20" @click="openExprEditor(ch)">😀 表情</button>
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
          class="h-24 w-20 rounded-lg object-contain bg-white/5 border-2 shrink-0"
          :style="{ borderColor: charForm.color || '#e91e63' }" />
        <div v-else class="h-24 w-20 rounded-lg flex items-center justify-center text-white text-lg shrink-0"
          :style="{ background: charForm.color || '#e91e63' }">{{ charForm.name ? charForm.name.charAt(0) : '?' }}</div>
        <label class="btn-ghost cursor-pointer">
          {{ charForm.id ? '更换形象图' : '上传形象图' }}
          <input type="file" accept="image/*" class="hidden" @change="onCharAvatarChange" />
        </label>
        <span v-if="charForm.avatarFile" class="text-[11px] text-text-dimmer truncate max-w-[160px]">{{ charForm.avatarFile.name }}</span>
        <span v-else-if="charForm.id && charForm.hasAvatar" class="text-[11px] text-text-dimmer">保留现有形象图</span>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">角色名 *</label>
        <input v-model="charForm.name" placeholder="如: 林小雨" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="grid grid-cols-2 gap-3 mb-[14px]">
        <div>
          <label class="block text-xs text-text-dim mb-1">主题色 <span class="text-text-dimmer">(对话框名牌底色)</span></label>
          <input v-model="charForm.color" placeholder="#e91e63" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">排序</label>
          <input v-model.number="charForm.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>
      <label class="flex items-start gap-2.5 mb-[14px] cursor-pointer select-none">
        <input v-model="charForm.is_protagonist" type="checkbox" class="mt-0.5 w-4 h-4 accent-purple-600 shrink-0" />
        <span class="text-[12px] leading-relaxed">
          <span class="text-amber-300">👑 设为主角</span>
          <span class="block text-text-dim">每个游戏仅一名主角（设新主角自动取消旧主角）。玩家开始游戏输入的名字将作为主角在对白中显示的说话人名。</span>
        </span>
      </label>

      <template #actions>
        <button class="btn-ghost" @click="formOpen = false">取消</button>
        <button class="btn-purple" @click="saveChar">{{ charForm.id ? '保存修改' : '创建角色' }}</button>
      </template>
    </AppModal>

    <!-- 表情编辑弹窗 -->
    <AppModal
      :visible="exprOpen"
      :title="'表情管理 - ' + (exprChar?.name || '')"
      @close="exprOpen = false"
    >
      <div class="text-[12px] text-text-dim mb-3">为同一角色上传不同表情/姿态的形象图（生气/开心…），对白编辑时选择对应表情，播放器显示该形象。</div>

      <!-- 已有表情列表 -->
      <div v-if="!(exprChar?.expressions || []).length" class="text-center py-4 text-text-dimmest text-sm mb-3">暂无表情，先在下方添加</div>
      <div v-else class="flex flex-wrap gap-2 mb-4">
        <div v-for="e in exprChar.expressions" :key="e.key"
          class="flex flex-col items-center gap-1 border border-border-dim rounded-lg p-2 bg-surface-darkest">
          <img :src="'/' + e.avatar" class="w-14 h-16 rounded-lg object-contain bg-white/5 border-2" :style="{ borderColor: exprChar.color || '#e91e63' }" />
          <span class="text-[11px] text-white">{{ e.label }}</span>
          <div class="flex gap-1">
            <!-- 替换形象图：同 key 覆盖上传, 引用该表情的对白无需改动（不会像删除那样失败） -->
            <button class="d-btn bg-brand-purple/70 hover:bg-brand-purple" @click="replaceExpr(e)">替换</button>
            <button class="d-btn bg-[#dc2626] hover:bg-[#b91c1c]" @click="deleteExpr(e.key)">删除</button>
          </div>
          <input v-if="replacingKey === e.key" type="file" accept="image/*" class="hidden"
            :ref="el => { if (el) replaceInputEl = el }" @change="onReplaceFileChange($event, e)" />
        </div>
      </div>

      <!-- 添加表情表单 -->
      <div class="border border-border-dim rounded-lg p-3 bg-surface-dark space-y-2.5">
        <div class="text-xs text-text-dim">添加/覆盖表情（同 key 覆盖旧图）</div>
        <div class="flex items-center gap-2.5">
          <img v-if="exprPreview" :src="exprPreview" class="w-14 h-16 rounded-lg object-contain bg-white/5 border border-border-dim shrink-0" />
          <div v-else class="w-14 h-16 rounded-lg bg-white/5 shrink-0"></div>
          <label class="btn-ghost cursor-pointer">
            上传表情形象图
            <input type="file" accept="image/*" class="hidden" @change="onExprFileChange" />
          </label>
          <span v-if="exprFile" class="text-[11px] text-text-dimmer truncate max-w-[140px]">{{ exprFile.name }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] text-text-dim mb-1">表情名称 * <span class="text-text-dimmer">(如: 生气)</span></label>
            <input v-model="exprForm.label" class="w-full px-2.5 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
          <div>
            <label class="block text-[11px] text-text-dim mb-1">表情key * <span class="text-text-dimmer">(英文/数字/下划线, 如: angry)</span></label>
            <input v-model="exprForm.key" class="w-full px-2.5 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
        </div>
        <button class="btn-purple" @click="saveExpr">保存表情</button>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
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
  return { id: 0, name: '', color: '#e91e63', sort_order: 0, is_protagonist: false, avatarFile: null, hasAvatar: false }
}

function onCharAvatarChange(e) {
  const f = e.target.files[0]
  charForm.value.avatarFile = f || null
  charAvatarPreview.value = f ? URL.createObjectURL(f) : null
}

// ═══ 表情管理 ═══
const exprOpen = ref(false)
const exprChar = ref(null)     // 当前编辑表情的角色（引用列表内对象, 保存后实时刷新）
const exprFile = ref(null)
const exprPreview = ref(null)
const exprForm = ref({ key: '', label: '' })

function openExprEditor(ch) {
  exprChar.value = ch
  exprFile.value = null
  exprPreview.value = null
  exprForm.value = { key: '', label: '' }
  exprOpen.value = true
}

function onExprFileChange(e) {
  const f = e.target.files[0]
  exprFile.value = f || null
  exprPreview.value = f ? URL.createObjectURL(f) : null
}

async function saveExpr() {
  if (!exprFile.value) return show('请上传表情图片')
  if (!exprForm.value.key.trim()) return show('请填写表情key')
  if (!exprForm.value.label.trim()) return show('请填写表情名称')
  const fd = new FormData()
  fd.append('image', exprFile.value)
  fd.append('key', exprForm.value.key.trim())
  fd.append('label', exprForm.value.label.trim())
  try {
    const r = await post(`/characters/${exprChar.value.id}/expressions`, fd)
    show(r.message || '表情已保存')
    // 就地更新列表（避免整个面板重载使滚动位置复位）
    try { exprChar.value.expressions = r.expressions || [] } catch {}
    exprFile.value = null
    exprPreview.value = null
    exprForm.value = { key: '', label: '' }
  } catch (e) { show('保存失败: ' + e.message) }
}

// ═══ 替换表情形象图（同 key 覆盖：引用该表情的对白自动换图, 无需先取消引用） ═══
const replacingKey = ref(null)
let replaceInputEl = null

function replaceExpr(e) {
  replacingKey.value = e.key
  // 等隐藏 input 渲染出来再唤起文件选择
  nextTick(() => { if (replaceInputEl) replaceInputEl.click() })
}

async function onReplaceFileChange(ev, e) {
  const f = ev.target.files && ev.target.files[0]
  ev.target.value = ''           // 允许再次选同一文件
  replacingKey.value = null
  if (!f) return
  const fd = new FormData()
  fd.append('image', f)
  fd.append('key', e.key)        // 同 key → 服务端覆盖旧图并删旧文件
  fd.append('label', e.label)
  try {
    const r = await post(`/characters/${exprChar.value.id}/expressions`, fd)
    show(`「${e.label}」形象图已替换`)
    try { exprChar.value.expressions = r.expressions || [] } catch {}
  } catch (err) { show('替换失败: ' + err.message) }
}

async function deleteExpr(key) {
  if (!confirm('删除该表情?')) return
  try {
    const r = await del(`/characters/${exprChar.value.id}/expressions/${key}`)
    exprChar.value.expressions = r.expressions || []
    show('已删除')
  } catch (e) { show('删除失败: ' + e.message) }
}

function openCharEdit(ch) {
  charForm.value = { id: ch.id, name: ch.name, color: ch.color || '#e91e63',
    sort_order: ch.sort_order || 0, is_protagonist: !!ch.is_protagonist, avatarFile: null, hasAvatar: !!ch.avatar }
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
  fd.append('is_protagonist', charForm.value.is_protagonist ? '1' : '0')
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
