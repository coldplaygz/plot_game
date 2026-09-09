<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl text-white">🎨 选项主题</h2>
      <button @click="openModal(0)"
        class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark">
        + 新建主题
      </button>
    </div>

    <p class="text-xs text-text-dim mb-4">
      主题用于定制玩家播放器选项框的颜色与样式。每个游戏可绑定一个主题；预设主题不可删除。
    </p>

    <!-- 主题列表 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-if="!themes.length" class="col-span-full text-center py-[40px] text-text-dimmest">
        暂无主题
      </div>

      <div v-for="t in themes" :key="t.id"
        class="bg-surface-card border border-border-dim rounded-xl overflow-hidden flex flex-col">
        <!-- 预览区：用主题样式渲染两条示例选项 -->
        <div class="p-4 bg-surface-darkest flex flex-col gap-2" :style="varsFrom(t.style_config)">
          <div class="choice-btn flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border rounded-md">
            <span><span class="choice-number mr-1">1.</span>示例选项</span>
            <span class="choice-badge choice-cost inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]">💎 10</span>
          </div>
          <div class="choice-btn flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border rounded-md">
            <span><span class="choice-number mr-1">2.</span>已购选项示例</span>
            <span class="choice-badge choice-paid inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]">✓ 已购买</span>
          </div>
        </div>

        <!-- 信息 + 操作 -->
        <div class="p-3 flex-1 flex flex-col">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm text-white font-medium truncate">{{ t.name }}</span>
            <span v-if="t.is_preset"
              class="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
              预设
            </span>
          </div>
          <div class="text-[11px] text-text-dimmer mb-3 line-clamp-2 min-h-[28px]">{{ t.description || '—' }}</div>
          <div class="flex gap-2 mt-auto">
            <button @click="openModal(t.id)"
              class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple">
              ✏️ 编辑
            </button>
            <button v-if="!t.is_preset" @click="deleteTheme(t.id)"
              class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1">
              删除
            </button>
            <span v-else class="inline-flex items-center gap-[3px] px-3 py-[5px] text-xs text-text-dimmest">
              不可删除
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <AppModal :visible="modalVisible" :title="form.id > 0 ? '✏️ 编辑主题' : '➕ 新建主题'" @close="modalVisible = false">
      <div class="mt-2 space-y-3">
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="text-xs text-text-dim block mb-1">名称 <span class="text-red-500">*</span></label>
            <input v-model="form.name" placeholder="主题名称"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
          <div class="w-24">
            <label class="text-xs text-text-dim block mb-1">排序</label>
            <input v-model.number="form.sort_order" type="number" min="0"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
        </div>
        <div>
          <label class="text-xs text-text-dim block mb-1">描述</label>
          <input v-model="form.description" placeholder="主题简介"
            class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>

        <!-- 实时预览 -->
        <div>
          <label class="text-xs text-text-dim block mb-1">实时预览</label>
          <div class="p-3 bg-surface-darkest border border-border-dim rounded-lg flex flex-col gap-2" :style="varsFrom(form.style_config)">
            <div class="choice-btn flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border rounded-md">
              <span><span class="choice-number mr-1">1.</span>示例选项</span>
              <span class="choice-badge choice-cost inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]">💎 10</span>
            </div>
            <div class="choice-btn flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border rounded-md">
              <span><span class="choice-number mr-1">2.</span>已购选项示例</span>
              <span class="choice-badge choice-paid inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]">✓ 已购买</span>
            </div>
          </div>
        </div>

        <!-- 颜色配置：每项 color + text 双输入 -->
        <div class="space-y-2">
          <div v-for="f in styleFields" :key="f.key" class="flex items-center gap-2">
            <label class="text-xs text-text-dim w-28 shrink-0">{{ f.label }}</label>
            <input v-model="form.style_config[f.key]" type="color"
              class="w-8 h-8 rounded cursor-pointer bg-transparent border border-border-dim shrink-0"
              :title="'选择' + f.label" />
            <input v-model="form.style_config[f.key]" type="text" :placeholder="f.placeholder"
              class="flex-1 px-2 py-1 bg-surface-darkest border border-border-dim rounded-lg text-white text-xs outline-none focus:border-brand-purple font-mono" />
            <button type="button" @click="form.style_config[f.key] = ''"
              class="text-text-dimmest hover:text-red-400 text-xs px-1" title="清空此项（使用兜底）">×</button>
          </div>
        </div>

        <!-- 圆角 -->
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-dim w-28 shrink-0">圆角</label>
          <select v-model="form.style_config.radius"
            class="flex-1 px-2 py-1.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
            <option value="">默认 (8px)</option>
            <option value="0px">直角</option>
            <option value="4px">4px</option>
            <option value="8px">8px</option>
            <option value="10px">10px</option>
            <option value="12px">12px</option>
            <option value="16px">16px</option>
            <option value="9999px">胶囊</option>
          </select>
        </div>

        <div v-if="form.is_preset" class="text-[11px] text-text-dimmest">
          此为预设主题，可修改样式配置但不会被删除。
        </div>
      </div>

      <template #actions>
        <button @click="saveTheme"
          class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark shrink-0">保存</button>
        <button @click="modalVisible = false"
          class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple shrink-0">取消</button>
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

// 样式字段定义（与 GamePlayer.vue themeVars CSS 变量对应）
const styleFields = [
  { key: 'button_bg',     label: '按钮背景',  placeholder: 'rgba(0,0,0,0.55)' },
  { key: 'button_border', label: '按钮边框',  placeholder: 'rgba(255,255,255,0.15)' },
  { key: 'button_text',   label: '按钮文字',  placeholder: '#ffffff' },
  { key: 'hover_bg',      label: '悬停背景',  placeholder: 'rgba(139,92,246,0.4)' },
  { key: 'hover_border',  label: '悬停边框',  placeholder: '#8b5cf6' },
  { key: 'number_color',  label: '序号颜色',  placeholder: '#9ca3af' },
  { key: 'paid_bg',       label: '已购背景',  placeholder: 'rgba(74,222,128,0.15)' },
  { key: 'paid_text',     label: '已购文字',  placeholder: '#4ade80' },
  { key: 'paid_border',   label: '已购边框',  placeholder: 'rgba(74,222,128,0.3)' },
  { key: 'cost_bg',       label: '积分背景',  placeholder: 'rgba(251,191,36,0.15)' },
  { key: 'cost_text',     label: '积分文字',  placeholder: '#fbbf24' },
  { key: 'cost_border',   label: '积分边框',  placeholder: 'rgba(251,191,36,0.3)' }
]

const themes = ref([])
const modalVisible = ref(false)
const form = ref(getEmptyForm())

function getEmptyForm() {
  return {
    id: 0, name: '', description: '', is_preset: false, sort_order: 0,
    style_config: {
      button_bg: '', button_border: '', button_text: '',
      hover_bg: '', hover_border: '',
      number_color: '',
      paid_bg: '', paid_text: '', paid_border: '',
      cost_bg: '', cost_text: '', cost_border: '',
      radius: ''
    }
  }
}

// 将 style_config 转换为 CSS 变量字典（与 GamePlayer.vue themeVars 同步）
function varsFrom(cfg) {
  const c = cfg || {}
  const v = {}
  if (c.button_bg) v['--choice-bg'] = c.button_bg
  if (c.button_border) v['--choice-border'] = c.button_border
  if (c.button_text) v['--choice-text'] = c.button_text
  if (c.hover_bg) v['--choice-hover-bg'] = c.hover_bg
  if (c.hover_border) v['--choice-hover-border'] = c.hover_border
  if (c.number_color) v['--choice-number'] = c.number_color
  if (c.paid_bg) v['--choice-paid-bg'] = c.paid_bg
  if (c.paid_text) v['--choice-paid-text'] = c.paid_text
  if (c.paid_border) v['--choice-paid-border'] = c.paid_border
  if (c.cost_bg) v['--choice-cost-bg'] = c.cost_bg
  if (c.cost_text) v['--choice-cost-text'] = c.cost_text
  if (c.cost_border) v['--choice-cost-border'] = c.cost_border
  if (c.radius) v['--choice-radius'] = c.radius
  return v
}

async function loadThemes() {
  try {
    const r = await get('/themes')
    themes.value = r.themes || []
  } catch (e) { show('加载主题失败: ' + e.message) }
}

function openModal(id) {
  const found = themes.value.find(t => t.id === id)
  if (found) {
    const c = found.style_config || {}
    form.value = {
      id: found.id,
      name: found.name || '',
      description: found.description || '',
      is_preset: !!found.is_preset,
      sort_order: found.sort_order || 0,
      style_config: {
        button_bg: c.button_bg || '', button_border: c.button_border || '', button_text: c.button_text || '',
        hover_bg: c.hover_bg || '', hover_border: c.hover_border || '',
        number_color: c.number_color || '',
        paid_bg: c.paid_bg || '', paid_text: c.paid_text || '', paid_border: c.paid_border || '',
        cost_bg: c.cost_bg || '', cost_text: c.cost_text || '', cost_border: c.cost_border || '',
        radius: c.radius || ''
      }
    }
  } else {
    form.value = getEmptyForm()
  }
  modalVisible.value = true
}

async function saveTheme() {
  if (!form.value.name.trim()) return show('请输入主题名称')
  // 过滤空字符串字段（不写入），保留为 undefined 让后端兜底
  const cleaned = {}
  for (const k of Object.keys(form.value.style_config)) {
    const v = form.value.style_config[k]
    if (v !== '' && v != null) cleaned[k] = v
  }
  const data = {
    name: form.value.name.trim(),
    description: form.value.description || null,
    style_config: cleaned,
    sort_order: form.value.sort_order || 0
  }
  try {
    if (form.value.id > 0) {
      await put('/themes/' + form.value.id, data)
    } else {
      await post('/themes', data)
    }
    show('保存成功')
    modalVisible.value = false
    loadThemes()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteTheme(id) {
  if (!confirm('确定删除此主题?')) return
  try {
    await del('/themes/' + id)
    show('已删除')
    loadThemes()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

onMounted(loadThemes)
</script>

<style scoped>
/* 主题预览复用 GamePlayer.vue 中的 .choice-btn 样式（作用域隔离，需在此声明） */
.choice-btn {
  background: var(--choice-bg, rgba(0, 0, 0, 0.55));
  border-color: var(--choice-border, rgba(255, 255, 255, 0.15));
  color: var(--choice-text, #ffffff);
  border-radius: var(--choice-radius, 8px);
  border-style: solid;
  border-width: 1px;
}
.choice-btn:hover {
  background: var(--choice-hover-bg, rgba(139, 92, 246, 0.4));
  border-color: var(--choice-hover-border, #8b5cf6);
}
.choice-number {
  color: var(--choice-number, #9ca3af);
}
.choice-paid {
  background: var(--choice-paid-bg, rgba(74, 222, 128, 0.15));
  color: var(--choice-paid-text, #4ade80);
  border-color: var(--choice-paid-border, rgba(74, 222, 128, 0.3));
  border-style: solid;
  border-width: 1px;
}
.choice-cost {
  background: var(--choice-cost-bg, rgba(251, 191, 36, 0.15));
  color: var(--choice-cost-text, #fbbf24);
  border-color: var(--choice-cost-border, rgba(251, 191, 36, 0.3));
  border-style: solid;
  border-width: 1px;
}
</style>
