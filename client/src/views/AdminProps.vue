<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl text-white">🎁 道具管理</h2>
      <button @click="openModal(0)"
        class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark">
        + 添加道具
      </button>
    </div>

    <!-- 道具列表 -->
    <div class="bg-surface-card border border-border-dim rounded-xl overflow-hidden">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">ID</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">图标</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">名称</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">类型</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">效果/关联视频</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">绑定场景</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">积分</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">排序</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">发布</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122]">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!props.length">
            <td colspan="10" class="text-center py-[40px] text-text-dimmest">暂无道具</td>
          </tr>
          <tr v-for="p in props" :key="p.id" class="hover:bg-[#1a1a3e]">
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ p.id }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-lg">{{ p.icon }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ p.name }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <span class="px-2 py-0.5 rounded-full text-[11px]"
                :class="p.type === 'fantasy' ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'">
                {{ p.type === 'fantasy' ? '🎬 幻想场景' : '✨ 效果' }}
              </span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">
              {{ p.type === 'fantasy' ? (p.video_filename || ('视频#' + p.video_id)) : (animationLabels[p.animation] || p.animation || '-') }}
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">
              <span v-if="p.type === 'fantasy' && p.scene_id" class="text-brand-purple">
                #{{ p.scene_id }} {{ p.scene_title || '场景已删除' }}{{ p.scene_chapter ? ' · ' + p.scene_chapter : '' }}
              </span>
              <span v-else-if="p.type === 'fantasy'" class="text-red-400">⚠ 未绑定</span>
              <span v-else class="text-text-dimmest">通用</span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ p.point_cost }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ p.sort_order }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ p.is_published ? '✅' : '🚫' }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <button @click="openModal(p.id)"
                class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple">✏️ 编辑</button>
              <button @click="deleteProp(p.id)"
                class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑弹窗 -->
    <AppModal :visible="modalVisible" :title="form.id > 0 ? '✏️ 编辑道具' : '➕ 添加道具'" @close="modalVisible = false">
      <div class="mt-2 space-y-3">
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="text-xs text-text-dim block mb-1">名称</label>
            <input v-model="form.name" placeholder="道具名称"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
          <div class="w-20">
            <label class="text-xs text-text-dim block mb-1">图标</label>
            <input v-model="form.icon" placeholder="🥚"
              class="w-full px-2 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-center text-[13px] outline-none focus:border-brand-purple" />
          </div>
        </div>

        <div class="flex gap-3">
          <div class="flex-1">
            <label class="text-xs text-text-dim block mb-1">类型</label>
            <select v-model="form.type" @change="onTypeChange"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
              <option value="effect">✨ 效果道具（动画）</option>
              <option value="fantasy">🎬 幻想场景道具（播放视频）</option>
            </select>
          </div>
          <div class="w-32">
            <label class="text-xs text-text-dim block mb-1">扣除积分</label>
            <input v-model.number="form.point_cost" type="number" min="0"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
        </div>

        <div v-if="form.type === 'effect'">
          <label class="text-xs text-text-dim block mb-1">动画效果</label>
          <select v-model="form.animation"
            class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
            <option v-for="(label, key) in animationLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div v-else class="space-y-3">
          <div>
            <label class="text-xs text-text-dim block mb-1">关联幻想场景视频</label>
            <select v-model="form.video_id"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
              <option :value="null">请选择视频</option>
              <option v-for="v in videos" :key="v.id" :value="v.id">{{ v.filename }} ({{ Math.round(v.duration || 0) }}s)</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-text-dim block mb-1">绑定场景 <span class="text-text-dimmest">（玩家进入该场景时才能使用此幻想场景）</span></label>
            <select v-model="form.scene_id"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
              <option :value="null">请选择场景</option>
              <option v-for="s in scenes" :key="s.id" :value="s.id">
                #{{ s.id }} {{ s.title || s.video_title || '未命名' }}{{ s.chapter ? ' · ' + s.chapter : '' }}{{ s.game_title ? ' · ' + s.game_title : '' }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex gap-3 items-end">
          <div class="w-32">
            <label class="text-xs text-text-dim block mb-1">排序</label>
            <input v-model.number="form.sort_order" type="number"
              class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          </div>
          <label class="text-xs text-text-dim flex items-center gap-1 pb-2">
            <input v-model="form.is_published" type="checkbox" class="mr-1" /> 发布
          </label>
        </div>
      </div>
      <template #actions>
        <button @click="saveProp"
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

const animationLabels = {
  egg: '🥚 扔鸡蛋',
  flower: '🌹 撒鲜花',
  heart: '💖 爱心飘动',
  star: '⭐ 星星散落',
  tomato: '🍅 砸番茄',
  confetti: '🎊 彩带撒落',
  firework: '🎆 烟花绽放',
  coin: '🪙 金币掉落'
}

const props = ref([])
const videos = ref([])
const scenes = ref([])
const modalVisible = ref(false)
const form = ref(getEmptyForm())

function getEmptyForm() {
  return {
    id: 0, name: '', type: 'effect', icon: '🥚', animation: 'egg',
    video_id: null, scene_id: null, point_cost: 0, sort_order: 0, is_published: true
  }
}

async function loadProps() {
  try {
    const r = await get('/props/all')
    props.value = r.props || []
  } catch (e) { show('加载道具失败: ' + e.message) }
}

async function loadVideos() {
  try {
    const r = await get('/videos', { limit: 200 })
    videos.value = r.videos || []
  } catch (e) {}
}

async function loadScenes() {
  try {
    const r = await get('/scenes', { limit: 500 })
    scenes.value = r.scenes || []
  } catch (e) {}
}

function openModal(id) {
  const found = props.value.find(p => p.id === id)
  if (found) {
    form.value = {
      id: found.id,
      name: found.name || '',
      type: found.type || 'effect',
      icon: found.icon || '🥚',
      animation: found.animation || 'egg',
      video_id: found.video_id || null,
      scene_id: found.scene_id || null,
      point_cost: found.point_cost || 0,
      sort_order: found.sort_order || 0,
      is_published: !!found.is_published
    }
  } else {
    form.value = getEmptyForm()
  }
  modalVisible.value = true
}

function onTypeChange() {
  if (form.value.type === 'fantasy') {
    form.value.animation = null
  } else {
    // 切回 effect：清空幻想场景专属字段
    form.value.video_id = null
    form.value.scene_id = null
  }
}

async function saveProp() {
  if (!form.value.name.trim()) return show('请输入道具名称')
  if (form.value.type === 'fantasy' && !form.value.video_id) return show('幻想场景道具必须关联视频')
  if (form.value.type === 'fantasy' && !form.value.scene_id) return show('幻想场景道具必须绑定到具体场景')
  const data = {
    name: form.value.name.trim(),
    type: form.value.type,
    icon: form.value.icon || '🎁',
    animation: form.value.type === 'effect' ? form.value.animation : null,
    video_id: form.value.type === 'fantasy' ? form.value.video_id : null,
    scene_id: form.value.type === 'fantasy' ? form.value.scene_id : null,
    point_cost: form.value.point_cost || 0,
    sort_order: form.value.sort_order || 0,
    is_published: form.value.is_published
  }
  try {
    if (form.value.id > 0) {
      await put('/props/' + form.value.id, data)
    } else {
      await post('/props', data)
    }
    show('保存成功')
    modalVisible.value = false
    loadProps()
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteProp(id) {
  if (!confirm('确定删除此道具?')) return
  try {
    await del('/props/' + id)
    show('已删除')
    loadProps()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

onMounted(() => { loadProps(); loadVideos(); loadScenes() })
</script>
