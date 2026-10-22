<template>
  <div class="space-y-4">
    <!-- 顶部：游戏选择 -->
    <div class="flex items-end gap-3 flex-wrap">
      <div>
        <label class="block text-xs text-text-dim mb-1">选择游戏</label>
        <select v-model="selectedGameId" class="picker">
          <option :value="null" disabled>请选择游戏</option>
          <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }} (#{{ g.id }})</option>
        </select>
      </div>
      <div class="ml-auto">
        <button class="btn-purple" :disabled="!selectedGameId" @click="openEditModal()">+ 添加对白素材</button>
      </div>
    </div>

    <!-- 说明 -->
    <div class="text-[12px] text-text-dim leading-relaxed bg-surface-dark border border-border-dim rounded-lg px-4 py-2.5">
      对白库是素材池：按游戏预先写好常用对白和提问文本（条目之间没有父子关系）。
      到 场景编辑 → 💬对白 → 添加对白/子节点/提问 时，可直接从库里选取；树状关系在场景对白里组装。
    </div>

    <!-- 列表 -->
    <div v-if="!selectedGameId" class="text-center py-10 text-text-dimmest text-sm">请先选择游戏</div>
    <div v-else-if="!items.length" class="text-center py-10 text-text-dimmest text-sm">该游戏暂无对白素材，点击上方按钮添加</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      <div v-for="item in items" :key="item.id"
        class="border border-border-dim rounded-lg p-3 bg-surface-darkest flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span v-if="item.node_type === 'option'" class="inline-flex items-center px-2 py-[1px] rounded text-[10px] bg-amber-500/15 text-amber-400">❓ 提问</span>
          <span v-else class="inline-flex items-center px-2 py-[1px] rounded text-[10px] bg-brand-purple/15 text-brand-purple">💬 对白</span>
          <span v-if="item.speaker" class="inline-flex items-center px-2 py-[1px] rounded text-[10px] bg-white/5 text-text-dim">{{ item.speaker }}</span>
        </div>
        <div class="text-[13px] text-white leading-relaxed break-words">{{ item.text }}</div>
        <div v-if="hasI18n(item)" class="text-[11px] text-text-dimmest leading-snug">
          <span v-if="i18nOf(item, 'en')">EN: {{ i18nOf(item, 'en') }}<br></span>
          <span v-if="i18nOf(item, 'ja')">JA: {{ i18nOf(item, 'ja') }}<br></span>
          <span v-if="i18nOf(item, 'ko')">KO: {{ i18nOf(item, 'ko') }}</span>
        </div>
        <div class="flex items-center gap-2 mt-auto pt-1">
          <span class="text-[10px] text-text-dimmest mr-auto">
            <template v-if="item.node_type !== 'option' && item.show_time > 0">建议第 {{ item.show_time }}s 触发 · </template>排序 {{ item.sort_order }}
          </span>
          <button class="d-btn bg-[#2563eb] hover:bg-[#1d4ed8]" @click="openEditModal(item.id)">编辑</button>
          <button class="d-btn bg-[#dc2626] hover:bg-[#b91c1c]" @click="deleteItem(item.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <AppModal
      :visible="editVisible"
      :title="editingId > 0 ? '编辑对白素材' : '添加对白素材'"
      :wide="true"
      @close="editVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">素材类型</label>
        <div class="flex gap-4">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input v-model="form.node_type" type="radio" value="line" class="w-auto accent-brand-purple" />
            <span class="text-[13px] text-white">💬 对白</span>
          </label>
          <label class="inline-flex items-centergap-2 cursor-pointer">
            <input v-model="form.node_type" type="radio" value="option" class="w-auto accent-brand-purple" />
            <span class="text-[13px] text-white">❓ 提问</span>
          </label>
        </div>
        <p class="text-[11px] text-text-dimmer mt-1">素材无层级关系；提问（问句）添加到场景后，其子选项和后续对白在场景对白树里继续编排</p>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">说话人 <span class="text-text-dimmer">(选择角色自动填充, 或手写)</span></label>
        <div class="flex gap-2">
          <select v-model="form.character_id" class="picker flex-1" @change="onFormCharChange">
            <option :value="null">不关联角色</option>
            <option v-for="ch in characters" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
          </select>
          <input v-model="form.speaker" placeholder="说话人名" class="picker flex-1" />
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">{{ form.node_type === 'option' ? '提问文本 *（玩家看到的问句）' : '对白文本 *' }}</label>
        <textarea v-model="form.text" rows="2" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言文本</label>
        <div class="grid grid-cols-3 gap-2">
          <textarea v-model="form.text_en" placeholder="English" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="form.text_ja" placeholder="日本語" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="form.text_ko" placeholder="한국어" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-[14px]">
        <div>
          <label class="block text-xs text-text-dim mb-1">建议触发时间(秒) <span class="text-text-dimmer">(对白类, 可空=0)</span></label>
          <input v-model.number="form.show_time" type="number" min="0" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">排序 <span class="text-text-dimmer">(库内显示顺序)</span></label>
          <input v-model.number="form.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>

      <template #actions>
        <button class="btn-ghost" @click="editVisible = false">取消</button>
        <button class="btn-purple" @click="saveItem">保存</button>
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
const items = ref([])

async function loadGames() {
  try { const r = await get('/games?limit=100'); games.value = r.games || [] } catch {}
}

// ========= 角色管理 =========
const characters = ref([])  // 角色下拉数据（角色增删改在独立的"角色管理"菜单页）

async function loadCharacters() {
  if (!selectedGameId.value) { characters.value = []; return }
  try {
    const r = await get('/characters/game/' + selectedGameId.value)
    characters.value = r.characters || []
  } catch (e) {}
}

async function loadItems() {
  if (!selectedGameId.value) { items.value = []; return }
  try {
    const r = await get('/dialogue-library/game/' + selectedGameId.value)
    items.value = r.dialogues || []
  } catch (e) { show('加载对白库失败') }
}

function i18nOf(item, lang) {
  try { return JSON.parse(item.text_i18n || '{}')[lang] || '' } catch { return '' }
}
function hasI18n(item) {
  return !!(i18nOf(item, 'en') || i18nOf(item, 'ja') || i18nOf(item, 'ko'))
}

// 切换游戏 → 重新加载该游戏的库条目 + 角色
watch(selectedGameId, () => { loadItems(); loadCharacters() })

// 编辑
const editVisible = ref(false)
const editingId = ref(0)
const form = ref(getEmptyForm())

function getEmptyForm() {
  return { node_type: 'line', character_id: null, speaker: '', text: '',
    text_en: '', text_ja: '', text_ko: '', show_time: 0, sort_order: 0 }
}

// 表单里选择角色 → 说话人自动填角色名
function onFormCharChange() {
  if (form.value.character_id) {
    const ch = characters.value.find(c => c.id === form.value.character_id)
    if (ch) form.value.speaker = ch.name
  }
}

function openEditModal(id = 0) {
  if (!selectedGameId.value && id === 0) return show('请先选择游戏')
  editingId.value = id
  if (id > 0) {
    const found = items.value.find(d => d.id === id)
    if (found) {
      form.value = {
        node_type: found.node_type || 'line',
        character_id: found.character_id || null,
        speaker: found.speaker || '',
        text: found.text || '',
        text_en: i18nOf(found, 'en'),
        text_ja: i18nOf(found, 'ja'),
        text_ko: i18nOf(found, 'ko'),
        show_time: found.show_time ?? 0,
        sort_order: found.sort_order || 0
      }
    }
  } else {
    form.value = getEmptyForm()
  }
  editVisible.value = true
}

async function saveItem() {
  if (!form.value.text) return show('请输入文本')
  const i18n = {}
  if (form.value.text_en) i18n.en = form.value.text_en
  if (form.value.text_ja) i18n.ja = form.value.text_ja
  if (form.value.text_ko) i18n.ko = form.value.text_ko
  const data = {
    game_id: selectedGameId.value,
    node_type: form.value.node_type,
    character_id: form.value.character_id || null,
    speaker: form.value.speaker || null,
    text: form.value.text,
    text_i18n: Object.keys(i18n).length ? JSON.stringify(i18n) : null,
    show_time: parseInt(form.value.show_time) || 0,
    sort_order: parseInt(form.value.sort_order) || 0
  }
  try {
    if (editingId.value > 0) {
      await put('/dialogue-library/' + editingId.value, data)
    } else {
      await post('/dialogue-library', data)
    }
    show('保存成功')
    editVisible.value = false
    loadItems()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteItem(id) {
  if (!confirm('删除该对白素材?（场景中已导入的副本不受影响）')) return
  try {
    await del('/dialogue-library/' + id)
    show('已删除')
    loadItems()
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
.btn-cyan {
  @apply inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed;
}
.btn-ghost {
  @apply inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple;
}
.d-btn {
  @apply inline-flex items-center px-2 py-[4px] border-none rounded-md text-[11px] cursor-pointer text-white transition-all duration-200;
}
</style>
