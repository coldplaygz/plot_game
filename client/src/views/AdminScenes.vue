<template>
  <div>
    <h2 class="text-xl text-white mb-5">📝 场景编辑</h2>

    <!-- Filter + Toolbar -->
    <div class="flex gap-[10px] mb-4 flex-wrap items-center">
      <label class="text-xs text-text-dim">筛选游戏：</label>
      <select v-model="filterGameId" @change="loadScenes"
        class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
        <option :value="null">全部游戏</option>
        <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
      </select>
      <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark ml-3" @click="openSceneModal(0)">+ 创建场景</button>
      <span class="text-text-dimmer text-xs ml-3">⭐ = 起始场景 | 🏁 = 结局场景</span>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标题</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">归属游戏</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">章节</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">视频</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">选项数</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">结局</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!pageScenes.length">
          <td colspan="8" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无场景</td>
        </tr>
        <tr v-for="s in pageScenes" :key="s.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.is_start ? '⭐ ' : '' }}{{ s.title }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">{{ s.game_title || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.chapter || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.video_title || '无视频' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.choice_count || 0 }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.is_ending ? '🏁 ' + (s.ending_title || '') : '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openSceneModal(s.id)">编辑</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#059669] text-white hover:bg-[#047857] ml-1" @click="openChoicesModal(s.id)">选项({{ s.choice_count || 0 }})</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteScene(s.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <AppPagination
      :page="page"
      :total="scenes.length"
      :pageSize="pageSize"
      @update="onPageChange"
    />

    <!-- Scene Edit Modal -->
    <AppModal
      :visible="sceneModalVisible"
      :title="editingSceneId > 0 ? '编辑场景' : '创建场景'"
      :wide="true"
      @close="sceneModalVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">场景标题 *</label>
        <input v-model="sceneForm.title" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言标题</label>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="sceneForm.title_en" placeholder="English" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="sceneForm.title_ja" placeholder="日本語" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="sceneForm.title_ko" placeholder="한국어" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">描述</label>
        <textarea v-model="sceneForm.description" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y min-h-[70px]"></textarea>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言描述</label>
        <div class="grid grid-cols-3 gap-2">
          <textarea v-model="sceneForm.desc_en" placeholder="English" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="sceneForm.desc_ja" placeholder="日本語" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="sceneForm.desc_ko" placeholder="한국어" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">归属游戏 * <span class="text-text-dimmer">(切换会重新过滤视频列表)</span></label>
        <select v-model="sceneForm.game_id" @change="onSceneGameIdChange" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">— 不归属游戏 —</option>
          <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">关联视频 * <span v-if="modalGameId" class="text-text-dimmer">(仅显示该场景所属游戏的视频)</span></label>
        <select v-model="sceneForm.video_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">--选择视频--</option>
          <option v-for="v in videoList" :key="v.id" :value="v.id">{{ v.title }} ({{ v.filename }})</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">章节</label>
        <input v-model="sceneForm.chapter" placeholder="如: 第一章" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px] flex items-center gap-2">
        <label class="text-xs text-text-dim">起始场景</label>
        <input v-model="sceneForm.is_start" type="checkbox" class="w-auto" />
        <span class="text-text-dim text-[11px]">(仅一个)</span>
      </div>
      <div class="mb-[14px] flex items-center gap-2">
        <label class="text-xs text-text-dim">结局场景</label>
        <input v-model="sceneForm.is_ending" type="checkbox" class="w-auto" />
        <select v-model="sceneForm.ending_id" class="flex-1 px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">--选择结局--</option>
          <option v-for="e in endingList" :key="e.id" :value="e.id">{{ e.title }} ({{ e.type }})</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">选择限时(秒)</label>
        <input v-model.number="sceneForm.choice_timer" type="number" min="0" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">选项弹出延迟(秒, 0=视频播完)</label>
        <input v-model.number="sceneForm.choice_delay" type="number" min="0" placeholder="0=自动取视频时长" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="sceneModalVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveScene">保存</button>
      </template>
    </AppModal>

    <!-- Choices Modal -->
    <AppModal
      :visible="choicesModalVisible"
      :title="'选项管理 - 场景#' + choicesSceneId"
      :wide="true"
      @close="choicesModalVisible = false"
    >
      <div class="mb-4 text-text-dim text-[13px]">场景: {{ choicesSceneTitle }}</div>
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">选项文本</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">跳转场景</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">积分</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">条件</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!choices.length">
            <td colspan="6" class="text-text-dimmest px-[14px] py-[10px]">暂无选项</td>
          </tr>
          <tr v-for="c in choices" :key="c.id" class="hover:bg-[#1a1a3e]">
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.id }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.text }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.next_scene_title || '无' }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <span :class="c.point_cost > 0 ? 'text-brand-purple' : 'text-text-dimmest'">{{ c.point_cost > 0 ? '💎'+c.point_cost : '-' }}</span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <span v-if="!c.conditions?.length">-</span>
              <span
                v-for="cd in c.conditions"
                :key="cd.id"
                class="inline-flex items-center gap-[3px] px-2 py-[2px] rounded-[10px] text-[11px] mx-0.5 bg-zinc-500/15 text-zinc-400"
              >{{ cd.character_name }}好感{{ cd.operator }}{{ cd.value }}</span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openChoiceEditModal(c.id)">编辑</button>
              <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteChoiceItem(c.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-4">
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openChoiceEditModal(0)">+ 添加选项</button>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="choicesModalVisible = false">关闭</button>
      </template>
    </AppModal>

    <!-- Choice Edit Modal -->
    <AppModal
      :visible="choiceEditVisible"
      :title="editingChoiceId > 0 ? '编辑选项' : '添加选项'"
      :wide="true"
      @close="choiceEditVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">选项文本 *</label>
        <input v-model="choiceForm.text" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言选项文本</label>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="choiceForm.text_en" placeholder="English" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="choiceForm.text_ja" placeholder="日本語" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="choiceForm.text_ko" placeholder="한국어" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">跳转场景 <span class="text-text-dimmer">(仅显示同游戏的场景)</span></label>
        <select v-model="choiceForm.next_scene_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">无(停留)</option>
          <option v-for="s in allScenes" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">排序</label>
        <input v-model.number="choiceForm.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">单独计时(秒,0=用场景默认)</label>
        <input v-model.number="choiceForm.timer_seconds" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>

      <!-- Point Cost -->
      <div class="mt-5 pt-4 border-t border-border-dim">
        <h4 class="text-sm text-text-subtle mb-[10px]">💎 积分消耗</h4>
        <div class="flex items-center gap-2">
          <input v-model.number="choiceForm.point_cost" type="number" min="0" placeholder="消费积分" class="w-[120px] px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <span class="text-xs text-text-dim">积分/次 (0=免费)</span>
        </div>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="choiceEditVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveChoice">保存</button>
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

// Scene list
const scenes = ref([])
const page = ref(1)
const pageSize = ref(10)
const filterGameId = ref(null)
// 当前打开的场景弹窗所用的 game_id（编辑时取场景自身，新建时取 filterGameId）
const modalGameId = ref(null)
const games = ref([])

const pageScenes = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return scenes.value.slice(start, start + pageSize.value)
})

function onPageChange(p, ps) {
  page.value = p
  pageSize.value = ps
}

// Scene Edit Modal
const sceneModalVisible = ref(false)
const editingSceneId = ref(0)
const sceneForm = ref(getEmptySceneForm())
const videoList = ref([])
const endingList = ref([])

function getEmptySceneForm() {
  return {
    title: '', description: '', video_id: null, chapter: '',
    game_id: null,
    is_start: false, is_ending: false, ending_id: null,
    choice_timer: 10, choice_delay: 0,
    title_en: '', title_ja: '', title_ko: '',
    desc_en: '', desc_ja: '', desc_ko: ''
  }
}

// 按指定 game_id 加载视频列表（game_id 改变时调用）
async function loadVideosByGame(gameId) {
  try {
    const params = { limit: 200 }
    if (gameId) params.game_id = gameId
    const r = await get('/videos', params)
    videoList.value = r.videos || []
    if (!gameId) {
      show('提示：未归属游戏，视频列表包含全部视频，请确认引用正确')
    }
  } catch (e) {}
}

// 记录当前生效的 game_id（用于 @change 确认/取消时恢复）
let lastSceneGameId = null

// 场景表单 game_id 改变时：若已有视频关联，弹确认框，确认后清空 video_id 并重新加载视频列表
async function onSceneGameIdChange() {
  const newGameId = sceneForm.value.game_id || null

  // game_id 没变化，直接返回
  if (newGameId === lastSceneGameId) return

  // 若已关联视频，切换游戏会导致原视频被清除，需用户确认
  if (sceneForm.value.video_id) {
    const ok = confirm('修改归属游戏将清除当前关联的视频，确定要切换吗？')
    if (!ok) {
      // 取消：恢复 game_id 为原值
      sceneForm.value.game_id = lastSceneGameId
      return
    }
    // 确认：清除 video_id
    sceneForm.value.video_id = null
    show('已清除原关联视频，请重新选择')
  }

  lastSceneGameId = newGameId
  modalGameId.value = newGameId
  await loadVideosByGame(newGameId)
}

async function openSceneModal(id) {
  editingSceneId.value = id
  let sceneGameId = null
  if (id > 0) {
    try {
      const r = await get('/scenes/' + id)
      const s = r.scene || {}
      sceneGameId = s.game_id || null
      let i18n = {}, descI18n = {}
      try { i18n = JSON.parse(s.title_i18n || '{}') } catch {}
      try { descI18n = JSON.parse(s.description_i18n || '{}') } catch {}
      sceneForm.value = {
        title: s.title || '',
        description: s.description || '',
        video_id: s.video_id || null,
        chapter: s.chapter || '',
        game_id: s.game_id || null,
        is_start: !!s.is_start,
        is_ending: !!s.is_ending,
        ending_id: s.ending_id || null,
        choice_timer: s.choice_timer ?? 10,
        choice_delay: s.choice_delay ?? 0,
        title_en: i18n.en || '',
        title_ja: i18n.ja || '',
        title_ko: i18n.ko || '',
        desc_en: descI18n.en || '',
        desc_ja: descI18n.ja || '',
        desc_ko: descI18n.ko || ''
      }
    } catch (e) {
      show('加载场景失败')
      return
    }
  } else {
    sceneForm.value = getEmptySceneForm()
    sceneGameId = filterGameId.value || null
    sceneForm.value.game_id = sceneGameId
  }
  modalGameId.value = sceneGameId
  // 记录初始 game_id，供 onSceneGameIdChange 确认/取消时比对恢复
  lastSceneGameId = sceneGameId

  // 加载视频列表 + 结局列表
  await loadVideosByGame(sceneGameId)
  try { const r = await get('/endings'); endingList.value = r.endings || [] } catch (e) {}

  sceneModalVisible.value = true
}

async function saveScene() {
  const data = {
    title: sceneForm.value.title,
    description: sceneForm.value.description,
    video_id: sceneForm.value.video_id ? parseInt(sceneForm.value.video_id) : null,
    chapter: sceneForm.value.chapter,
    game_id: sceneForm.value.game_id || null,
    is_start: sceneForm.value.is_start,
    is_ending: sceneForm.value.is_ending,
    ending_id: sceneForm.value.ending_id ? parseInt(sceneForm.value.ending_id) : null,
    choice_timer: parseInt(sceneForm.value.choice_timer) || 10,
    choice_delay: parseInt(sceneForm.value.choice_delay) || 0
  }

  // 构建多语言 JSON
  const i18n = {}
  if (sceneForm.value.title_en) i18n.en = sceneForm.value.title_en
  if (sceneForm.value.title_ja) i18n.ja = sceneForm.value.title_ja
  if (sceneForm.value.title_ko) i18n.ko = sceneForm.value.title_ko
  if (Object.keys(i18n).length > 0) data.title_i18n = JSON.stringify(i18n)
  else data.title_i18n = null

  const descI18n = {}
  if (sceneForm.value.desc_en) descI18n.en = sceneForm.value.desc_en
  if (sceneForm.value.desc_ja) descI18n.ja = sceneForm.value.desc_ja
  if (sceneForm.value.desc_ko) descI18n.ko = sceneForm.value.desc_ko
  if (Object.keys(descI18n).length > 0) data.description_i18n = JSON.stringify(descI18n)
  else data.description_i18n = null

  if (!data.title || !data.video_id) return show('请填写标题和选择视频')

  try {
    if (editingSceneId.value > 0) {
      await put('/scenes/' + editingSceneId.value, data)
    } else {
      await post('/scenes', data)
    }
    show(editingSceneId.value > 0 ? '更新成功' : '创建成功')
    sceneModalVisible.value = false
    loadScenes()
  } catch (e) {
    show(e.message)
  }
}

async function deleteScene(id) {
  if (!confirm('确定删除此场景及所有选项?')) return
  try {
    await del('/scenes/' + id)
    show('已删除')
    loadScenes()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

// Choices Modal
const choicesModalVisible = ref(false)
const choicesSceneId = ref(0)
const choicesSceneTitle = ref('')
const choices = ref([])
const allScenes = ref([])

async function openChoicesModal(sceneId) {
  choicesSceneId.value = sceneId
  try {
    const [sr, cr] = await Promise.all([
      get('/scenes/' + sceneId),
      get('/choices/scene/' + sceneId)
    ])
    choicesSceneTitle.value = sr.scene?.title || ''
    choices.value = cr.choices || []
    // 按当前场景的 game_id 过滤跳转场景列表，避免跨游戏引用
    const sceneGameId = sr.scene?.game_id || null
    const params = {}
    if (sceneGameId) params.game_id = sceneGameId
    allScenes.value = await get('/scenes', params).then(r => r.scenes || []).catch(() => [])
    if (!sceneGameId) {
      show('提示：该场景未归属游戏，跳转场景列表包含全部场景，请确认引用正确')
    }
  } catch (e) {
    show('加载选项失败')
    return
  }
  choicesModalVisible.value = true
}

// Choice Edit Modal
const choiceEditVisible = ref(false)
const editingChoiceId = ref(0)
const choiceForm = ref(getEmptyChoiceForm())

function getEmptyChoiceForm() {
  return {
    text: '', next_scene_id: null, sort_order: 0, timer_seconds: 0,
    point_cost: 0,
    text_en: '', text_ja: '', text_ko: '',
    conditions: []
  }
}

function openChoiceEditModal(id) {
  editingChoiceId.value = id
  if (id > 0) {
    const found = choices.value.find(c => c.id === id)
    if (found) {
      let tI18n = {}
      try { tI18n = JSON.parse(found.text_i18n || '{}') } catch {}
      choiceForm.value = {
        text: found.text || '',
        next_scene_id: found.next_scene_id || null,
        sort_order: found.sort_order || 0,
        timer_seconds: found.timer_seconds || 0,
        point_cost: found.point_cost || 0,
        text_en: tI18n.en || '',
        text_ja: tI18n.ja || '',
        text_ko: tI18n.ko || '',
        conditions: found.conditions || []
      }
    } else {
      choiceForm.value = getEmptyChoiceForm()
    }
  } else {
    choiceForm.value = getEmptyChoiceForm()
  }
  choiceEditVisible.value = true
}

function addCondition() {
  choiceForm.value.conditions.push({
    character_id: null,
    operator: '>=',
    value: 0
  })
}

async function saveChoice() {
  const text = choiceForm.value.text
  if (!text) return show('请输入选项文本')

  const data = {
    scene_id: choicesSceneId.value,
    text,
    next_scene_id: choiceForm.value.next_scene_id ? parseInt(choiceForm.value.next_scene_id) : null,
    sort_order: parseInt(choiceForm.value.sort_order) || 0,
    timer_seconds: parseInt(choiceForm.value.timer_seconds) || 0,
    point_cost: parseInt(choiceForm.value.point_cost) || 0
  }

  const tI18n = {}
  if (choiceForm.value.text_en) tI18n.en = choiceForm.value.text_en
  if (choiceForm.value.text_ja) tI18n.ja = choiceForm.value.text_ja
  if (choiceForm.value.text_ko) tI18n.ko = choiceForm.value.text_ko
  if (Object.keys(tI18n).length > 0) data.text_i18n = JSON.stringify(tI18n)
  else data.text_i18n = null

  let choiceId = editingChoiceId.value
  try {
    if (choiceId > 0) {
      await put('/choices/' + choiceId, data)
    } else {
      const r = await post('/choices', data)
      if (r.error) return show(r.error)
      choiceId = r.choice.id
    }

    // Delete existing conditions, then re-create
    const existing = choices.value.find(c => c.id === choiceId)
    if (existing?.conditions) {
      for (let cd of existing.conditions) {
        try { await del('/choices/conditions/' + cd.id) } catch (e) { /* ignore */ }
      }
    }
    for (let cond of choiceForm.value.conditions) {
      if (cond.character_id) {
        await post('/choices/conditions', {
          target_type: 'choice',
          target_id: choiceId,
          character_id: parseInt(cond.character_id),
          operator: cond.operator,
          value: parseInt(cond.value) || 0
        })
      }
    }

    show('保存成功')
    choiceEditVisible.value = false
    openChoicesModal(choicesSceneId.value)
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteChoiceItem(id) {
  if (!confirm('确定删除?')) return
  try {
    await del('/choices/' + id)
    show('已删除')
    openChoicesModal(choicesSceneId.value)
  } catch (e) {
    show('删除失败')
  }
}

async function loadScenes() {
  try {
    const params = { limit: 500 }
    if (filterGameId.value) params.game_id = filterGameId.value
    const r = await get('/scenes', params)
    scenes.value = r.scenes || []
  } catch (e) {
    show('加载场景失败: ' + e.message)
  }
}

async function loadGames() {
  try { const r = await get('/games'); games.value = r.games || []; } catch {}
}

onMounted(() => { loadScenes(); loadGames(); })
</script>
