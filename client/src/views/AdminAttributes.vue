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
        <button class="btn-purple" :disabled="!selectedGameId" @click="openEdit()">+ 添加属性</button>
      </div>
    </div>

    <div class="text-[12px] text-text-dim leading-relaxed bg-surface-dark border border-border-dim rounded-lg px-4 py-2.5">
      每个游戏可自定义属性（如：好感度、暴力值、信任值）。玩家在场景对白的提问选项中做出选择时，对应属性按预设增减（+-N）。
      属性在 场景编辑 → 对白选项的"属性影响"中设置影响值。
    </div>

    <!-- 属性列表 -->
    <div v-if="!selectedGameId" class="text-center py-10 text-text-dimmest text-sm">请先选择游戏</div>
    <div v-else-if="!attributes.length" class="text-center py-10 text-text-dimmest text-sm">该游戏暂无自定义属性，点击右上角添加</div>
    <div v-else class="space-y-2">
      <div v-for="attr in attributes" :key="attr.id"
        class="flex items-center gap-3 border border-border-dim rounded-lg px-4 py-3 bg-surface-darkest">
        <div class="flex-1 min-w-0">
          <div class="text-white text-[14px]">{{ attr.name }}
            <span class="text-text-dimmest text-[11px] ml-2">{{ attr.attr_key }}</span>
          </div>
          <div class="text-text-dimmest text-[11px] mt-0.5">
            初始值 {{ attr.default_value }} · 被 {{ attr.effect_count }} 个选项引用
          </div>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button class="d-btn bg-[#2563eb] hover:bg-[#1d4ed8]" @click="openEdit(attr)">编辑</button>
          <button class="d-btn bg-[#dc2626] hover:bg-[#b91c1c]" @click="deleteAttr(attr)">删除</button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <AppModal
      :visible="editVisible"
      :title="editingId > 0 ? '编辑属性 #' + editingId : '添加属性'"
      @close="editVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">属性名 * <span class="text-text-dimmer">(玩家看到的中文名, 如: 好感度)</span></label>
        <input v-model="form.name" placeholder="好感度" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="grid grid-cols-2 gap-3 mb-[14px]">
        <div>
          <label class="block text-xs text-text-dim mb-1">初始值 <span class="text-text-dimmer">(固定 0, 玩家从零开始)</span></label>
          <input :value="0" disabled class="w-full px-3 py-[9px] bg-black/30 border border-border-dim rounded-lg text-text-dim text-[13px]" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">排序</label>
          <input v-model.number="form.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">属性键 <span class="text-text-dimmer">(英文/数字/下划线, 留空自动生成; 被引用后不可改)</span></label>
        <input v-model="form.attr_key" placeholder="如: favor / violence" :disabled="editingId > 0 && form.effect_count > 0"
          class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple disabled:opacity-40" />
      </div>

      <template #actions>
        <button class="btn-ghost" @click="editVisible = false">取消</button>
        <button class="btn-purple" @click="saveAttr">保存</button>
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
const attributes = ref([])

async function loadGames() {
  try { const r = await get('/games?limit=100'); games.value = r.games || [] } catch {}
}

async function loadAttributes() {
  if (!selectedGameId.value) { attributes.value = []; return }
  try {
    const r = await get('/game-attributes/game/' + selectedGameId.value)
    attributes.value = r.attributes || []
  } catch (e) { show('加载属性失败') }
}

watch(selectedGameId, loadAttributes)

const editVisible = ref(false)
const editingId = ref(0)
const form = ref(getEmptyForm())

function getEmptyForm() {
  return { name: '', attr_key: '', default_value: 0, sort_order: 0, effect_count: 0 }
}

function openEdit(attr = null) {
  if (!selectedGameId.value && !attr) return show('请先选择游戏')
  editingId.value = attr ? attr.id : 0
  form.value = attr ? {
    name: attr.name, attr_key: attr.attr_key,
    default_value: attr.default_value, sort_order: attr.sort_order,
    effect_count: attr.effect_count || 0
  } : getEmptyForm()
  editVisible.value = true
}

async function saveAttr() {
  if (!form.value.name.trim()) return show('请输入属性名')
  const data = {
    game_id: selectedGameId.value,
    name: form.value.name,
    attr_key: form.value.attr_key || undefined,
    default_value: parseInt(form.value.default_value) || 0,
    sort_order: parseInt(form.value.sort_order) || 0
  }
  try {
    if (editingId.value > 0) {
      await put('/game-attributes/' + editingId.value, data)
      show('已更新')
    } else {
      await post('/game-attributes', data)
      show('已创建')
    }
    editVisible.value = false
    loadAttributes()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteAttr(attr) {
  const extra = attr.effect_count > 0 ? `该属性被 ${attr.effect_count} 个选项引用，删除后这些选项的影响也会移除。` : ''
  if (!confirm(`删除属性「${attr.name}」? ${extra}`)) return
  try {
    await del('/game-attributes/' + attr.id)
    show('已删除')
    loadAttributes()
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
