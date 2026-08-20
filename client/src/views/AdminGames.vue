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
            <div v-if="coverUrl(g)" class="w-[60px] h-[34px] rounded overflow-hidden">
              <video v-if="isVideoCover(coverUrl(g))" :src="'/' + coverUrl(g)" muted playsinline class="w-full h-full object-cover" @error="onCoverVideoError" />
              <img v-else :src="'/' + coverUrl(g)" :alt="g.title" class="w-full h-full object-cover" />
            </div>
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
          <label class="block text-xs text-text-dim mb-2">封面（图片或视频，后设置的自动替换现有封面）</label>
          <div class="flex items-start gap-4">
            <!-- 统一预览区 -->
            <div class="relative shrink-0">
              <div class="relative w-[160px] h-[90px] rounded-lg overflow-hidden border border-border-dim bg-surface-darkest flex items-center justify-center">
                <!-- H.264 转码遮罩（转码期间源文件会被替换，暂不播放） -->
                <div v-if="coverTranscoding" class="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center gap-1">
                  <svg class="animate-spin w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span class="text-[10px] text-yellow-400">{{ coverVideoStatus === 'queued' ? '排队等待转码' : 'H.264 转码中' }}</span>
                </div>
                <video v-if="form.cover_preview && isVideoCover(form.cover_preview)" :src="form.cover_preview.startsWith('data:') ? form.cover_preview : '/' + form.cover_preview" muted loop autoplay playsinline class="w-full h-full object-cover" @error="onCoverVideoError" />
                <img v-else-if="form.cover_preview" :src="form.cover_preview.startsWith('data:') ? form.cover_preview : '/' + form.cover_preview" alt="封面预览" class="w-full h-full object-cover" />
                <span v-else class="text-text-dimmest text-[11px]">暂无封面</span>
              </div>
              <button v-if="form.cover_preview" type="button" class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-white text-[11px] leading-none flex items-center justify-center hover:bg-red-600 transition-colors" title="清除封面" @click="clearCover">✕</button>
            </div>
            <!-- 操作入口：图片/视频分开 -->
            <div class="flex-1 min-w-0 space-y-2">
              <button type="button" class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-xs hover:border-brand-purple transition-all flex items-center gap-2" @click="coverInput.click()">
                <span class="text-sm">🖼️</span>
                <span class="flex-1 text-left">{{ form.cover_preview && !isVideoCover(form.cover_preview) ? '更换图片' : '上传图片' }}</span>
                <span class="text-[10px] text-text-dimmest whitespace-nowrap">JPG/PNG/WebP</span>
              </button>
              <button type="button" class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-xs hover:border-brand-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" :disabled="coverUploading" @click="triggerCoverVideoUpload">
                <span class="text-sm">🎬</span>
                <span class="flex-1 text-left">{{ coverUploading ? '上传中 ' + coverUploadPercent + '%' : (form.cover_video_id ? '重新上传视频' : '上传视频') }}</span>
                <span class="text-[10px] text-text-dimmest whitespace-nowrap">MP4</span>
              </button>
              <button type="button" class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-xs hover:border-brand-purple transition-all flex items-center gap-2" @click="openCoverVideoPicker">
                <span class="text-sm">📚</span>
                <span class="flex-1 text-left">从视频库选择</span>
                <span v-if="form.cover_video_id" class="text-[10px] whitespace-nowrap" :class="coverTranscoding ? 'text-yellow-400' : 'text-[#f59e0b]'">已选 #{{ form.cover_video_id }}{{ coverTranscoding ? ' ⏳' : '' }}</span>
              </button>
            </div>
          </div>
          <!-- 隐藏文件选择框 -->
          <input ref="coverInput" type="file" accept=".jpg,.jpeg,.png,.webp,.gif" class="hidden" @change="onCoverSelected" />
          <input ref="coverVideoFileInput" type="file" accept=".mp4,.webm,.mov,.avi,.mkv" class="hidden" @change="onCoverVideoSelected" />
          <!-- 上传进度 -->
          <div v-if="coverUploading || coverUploadStatus" class="mt-2">
            <div class="flex justify-between text-xs text-text-dim mb-1">
              <span class="truncate flex-1 mr-2">{{ coverUploadStatus }}</span>
              <span v-if="coverUploading">{{ coverUploadPercent }}%</span>
            </div>
            <div v-if="coverUploading" class="w-full h-2 bg-surface-darkest rounded-full overflow-hidden">
              <div class="h-full bg-brand-purple transition-all duration-300" :style="{ width: coverUploadPercent + '%' }"></div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <label class="flex items-center gap-2 text-xs text-text-dim cursor-pointer"><input v-model="form.is_published" type="checkbox" class="rounded" /> 发布（公开可见）</label>
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-text-dim whitespace-nowrap" title="开场页封面视频播完后，菜单背后循环播放视频最后 N 秒；0 = 整段循环">封面尾段循环(秒)</label>
            <input v-model.number="form.intro_tail_seconds" type="number" min="0" max="60"
              class="w-16 px-2 py-1.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-text-dim whitespace-nowrap" title="开场页开始游戏菜单在画面中的显示位置">开始菜单位置</label>
            <select v-model="form.menu_position"
              class="px-2 py-1.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
              <option v-for="mp in menuPositions" :key="mp.value" :value="mp.value">{{ mp.label }}</option>
            </select>
          </div>
        </div>
      </div>
      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="modalVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" :disabled="saving" @click="saveGame">{{ saving ? '保存中...' : '保存' }}</button>
      </template>
    </AppModal>

    <!-- 封面视频选择弹窗 -->
    <AppModal :visible="coverPickerVisible" title="选择封面视频" @close="coverPickerVisible = false">
      <div v-if="coverVideosLoading" class="text-center py-8 text-text-dimmer text-sm">加载中...</div>
      <div v-else-if="coverVideos.length === 0" class="text-center py-8 text-text-dimmer text-sm">
        暂无封面视频<br>
        <span class="text-[11px]">请点击下方"上传封面视频"按钮上传</span>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
        <div
          v-for="cv in coverVideos"
          :key="cv.id"
          class="cursor-pointer rounded-lg overflow-hidden border-2 transition-all"
          :class="form.cover_video_id === cv.id ? 'border-brand-purple' : 'border-border-dim hover:border-brand-purple/50'"
          @click="selectCoverVideo(cv)"
        >
          <div class="aspect-video bg-black">
            <video :src="'/' + cv.file_path + coverSrcSuffix(cv)" muted loop autoplay playsinline class="w-full h-full object-cover" @error="onCoverVideoError" />
          </div>
          <div class="p-2">
            <div class="text-xs text-white truncate">#{{ cv.id }} {{ cv.title }}</div>
            <div class="text-[10px] text-text-dimmer flex items-center gap-1.5">
              <span>{{ (cv.duration || 0).toFixed(0) }}s</span>
              <span v-if="cv.transcode_status === 'queued'" class="text-blue-400">🕐 排队中</span>
              <span v-else-if="cv.transcode_status === 'transcoding'" class="text-yellow-400">⏳ 转码中</span>
              <span v-else-if="cv.transcode_status === 'failed'" class="text-red-400">⚠ 转码失败</span>
            </div>
          </div>
        </div>
      </div>
      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark disabled:opacity-50 disabled:cursor-not-allowed" :disabled="coverUploading" @click="triggerCoverVideoUpload">{{ coverUploading ? '上传中...' : '上传封面视频' }}</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="coverPickerVisible = false">关闭</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  id: null, title: '', description: '', category: '', cover_image: null, cover_preview: null, cover_video_id: null, is_published: false,
  title_en: '', title_ja: '', title_ko: '', desc_en: '', desc_ja: '', desc_ko: '',
  intro_tail_seconds: 3, menu_position: 'center'
})

// 开始菜单位置选项（开场页）
const menuPositions = [
  { value: 'center', label: '居中' },
  { value: 'top', label: '顶部居中' },
  { value: 'bottom', label: '底部居中' },
  { value: 'left', label: '左侧居中' },
  { value: 'right', label: '右侧居中' },
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' }
]
const form = ref(emptyForm())

// 封面视频选择
const coverPickerVisible = ref(false)
const coverVideos = ref([])
const coverVideosLoading = ref(false)

// 封面视频上传（逻辑与视频管理一致，category='cover'，上传后走 H.264 转码队列）
const coverVideoFileInput = ref(null)
const coverUploading = ref(false)
const coverUploadPercent = ref(0)
const coverUploadStatus = ref('')

// 封面视频 H.264 转码状态跟踪（与视频管理一致：queued → transcoding → done/failed）
const coverVideoStatus = ref(null)
const coverTranscoding = computed(() => coverVideoStatus.value === 'queued' || coverVideoStatus.value === 'transcoding')
let coverTranscodeTimer = null

function stopCoverTranscodePolling() {
  if (coverTranscodeTimer) { clearInterval(coverTranscodeTimer); coverTranscodeTimer = null }
}

// 转码完成后源文件已被替换，且静态服务为 immutable 长缓存，
// 追加时间戳改变 URL 强制浏览器重新加载预览
function bustPreviewCache() {
  const p = form.value.cover_preview
  if (!p || p.startsWith('data:')) return
  form.value.cover_preview = p.split('?')[0] + '?t=' + Date.now()
}

// 封面视频加载失败自动重试（转码期间原文件不可解码 / 转码瞬间文件被替换导致 404）
// 每 5 秒重试一次，最多 12 次（约 1 分钟），带 retry 参数绕过缓存
function onCoverVideoError(e) {
  const el = e.target
  const retries = (parseInt(el.dataset.retries) || 0) + 1
  if (retries > 12) return
  el.dataset.retries = String(retries)
  setTimeout(() => {
    const base = (el.getAttribute('src') || '').split('?')[0]
    if (!base) return
    el.src = base + '?retry=' + retries
    el.load()
  }, 5000)
}

// 视频库弹窗：未完成转码的视频 URL 加状态后缀，
// 转码完成后状态变化 → URL 变化 → 避免命中转码前的缓存
function coverSrcSuffix(cv) {
  return cv.transcode_status && cv.transcode_status !== 'done' ? '?ts=' + cv.transcode_status : ''
}

// 轮询封面视频 H.264 转码状态，直到 done/failed
function startCoverTranscodePolling(videoId) {
  stopCoverTranscodePolling()
  coverVideoStatus.value = 'queued'
  coverUploadStatus.value = '🕐 H.264 转码排队中...'
  coverTranscodeTimer = setInterval(async () => {
    try {
      const res = await get('/videos/' + videoId + '/hls-status')
      coverVideoStatus.value = res.transcode_status
      if (res.transcode_status === 'queued') {
        coverUploadStatus.value = '🕐 H.264 转码排队中...'
      } else if (res.transcode_status === 'transcoding') {
        coverUploadStatus.value = '⏳ H.264 转码中，完成后自动生效...'
      } else if (res.transcode_status === 'done') {
        coverUploadStatus.value = '✅ 转码完成，封面视频已就绪'
        stopCoverTranscodePolling()
        bustPreviewCache() // 源文件已替换，强制重载预览
        loadCoverVideos() // 刷新选择器中的转码徽章
        setTimeout(() => { if (coverVideoStatus.value === 'done') coverUploadStatus.value = '' }, 3000)
      } else if (res.transcode_status === 'failed') {
        coverUploadStatus.value = '⚠ H.264 转码失败'
        stopCoverTranscodePolling()
        show('封面视频转码失败，请到视频管理查看详情或重新上传')
      }
    } catch (e) {
      // 单次查询失败不中断轮询
    }
  }, 2000)
}

function resetForm() {
  form.value = emptyForm()
  if (coverInput.value) coverInput.value.value = ''
  if (coverVideoFileInput.value) coverVideoFileInput.value.value = ''
  coverUploading.value = false
  coverUploadPercent.value = 0
  coverUploadStatus.value = ''
  stopCoverTranscodePolling()
  coverVideoStatus.value = null
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
  form.value = {
    id: g.id, title: g.title || '', description: g.description || '', category: g.category || '',
    cover_image: null, cover_preview: g.cover_video_path || g.cover_image || null, cover_video_id: g.cover_video_id || null,
    is_published: !!g.is_published,
    intro_tail_seconds: g.intro_tail_seconds ?? 3, menu_position: g.menu_position || 'center'
  }
  // 编辑时同步封面视频转码状态（仍在转码则显示遮罩）
  coverVideoStatus.value = g.cover_video_id ? (g.cover_transcode_status || null) : null
  loadI18n(g.title_i18n, 'title_')
  loadI18n(g.description_i18n, 'desc_')
  modalVisible.value = true
}

// 封面 URL（列表/预览用）：优先封面视频，其次封面图
function coverUrl(g) {
  if (g.cover_video_path) return g.cover_video_path
  return g.cover_image || ''
}

// 打开封面视频选择弹窗
async function openCoverVideoPicker() {
  coverPickerVisible.value = true
  await loadCoverVideos()
}

// 加载封面视频列表
async function loadCoverVideos() {
  coverVideosLoading.value = true
  try {
    const res = await get('/games/covers/list')
    coverVideos.value = res.covers || []
  } catch (e) { show('加载封面视频失败: ' + e.message) }
  finally { coverVideosLoading.value = false }
}

// 触发封面视频文件选择
function triggerCoverVideoUpload() {
  if (coverUploading.value) return
  coverVideoFileInput.value?.click()
}

// 选中封面视频文件后开始上传
function onCoverVideoSelected() {
  const file = coverVideoFileInput.value?.files?.[0]
  if (!file) return
  uploadCoverVideo(file)
}

// 上传封面视频（复用 /api/videos 接口，category='cover'，带进度显示）
function uploadCoverVideo(file) {
  coverUploading.value = true
  coverUploadPercent.value = 0
  coverUploadStatus.value = '准备上传: ' + file.name

  const fd = new FormData()
  fd.append('video', file)
  fd.append('title', file.name.replace(/\.[^.]+$/, ''))
  fd.append('category', 'cover')  // 视频类型固定为封面

  const token = localStorage.getItem('plot_game_token')
  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/api/videos')
  if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)

  let uploadDone = false
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100)
      coverUploadPercent.value = pct
      coverUploadStatus.value = `上传中: ${file.name} (${pct}% - ${(e.loaded / 1024 / 1024).toFixed(1)}/${(e.total / 1024 / 1024).toFixed(1)}MB)`
      if (e.loaded >= e.total - 1 && !uploadDone) {
        uploadDone = true
        coverUploadStatus.value = '服务器处理中（转码排队）: ' + file.name
      }
    }
  }

  xhr.onload = () => {
    coverUploading.value = false
    coverUploadPercent.value = 0
    try {
      const r = JSON.parse(xhr.responseText)
      if (r.error) {
        coverUploadStatus.value = ''
        show('上传失败: ' + r.error)
        return
      }
      coverUploadStatus.value = '✅ 上传完成: ' + (r.video?.title || file.name)
      // 上传完成后刷新列表并自动选中新视频，随后跟踪 H.264 转码进度（与视频管理一致）
      refreshAfterCoverUpload(r.video?.id)
      if (r.video?.id) startCoverTranscodePolling(r.video.id)
    } catch (e) {
      coverUploadStatus.value = ''
      show('响应解析失败')
    }
    // 清空文件输入，允许再次选择同一文件
    if (coverVideoFileInput.value) coverVideoFileInput.value.value = ''
  }

  xhr.onerror = () => {
    coverUploading.value = false
    coverUploadPercent.value = 0
    coverUploadStatus.value = ''
    show('网络错误')
    if (coverVideoFileInput.value) coverVideoFileInput.value.value = ''
  }

  xhr.send(fd)
}

// 上传完成后刷新封面视频列表，并自动选中刚上传的视频
async function refreshAfterCoverUpload(newVideoId) {
  await loadCoverVideos()
  if (newVideoId) {
    const cv = coverVideos.value.find(v => v.id === newVideoId)
    if (cv) {
      // 自动选中作为封面
      form.value.cover_video_id = cv.id
      form.value.cover_preview = cv.file_path
      coverVideoStatus.value = cv.transcode_status || null
      // 清除已上传的图片文件选择
      if (coverInput.value) coverInput.value.value = ''
      form.value.cover_image = null
    }
  }
}

// 选中封面视频（转码未完成的禁止选择，与视频管理 checkTranscoding 行为一致）
function selectCoverVideo(cv) {
  if (cv.transcode_status === 'queued' || cv.transcode_status === 'transcoding') {
    const hint = cv.transcode_status === 'queued' ? '排队等待转码中' : '正在转码中'
    return show(`⚠ 该封面视频${hint}，请等待转码完成后再选择`)
  }
  form.value.cover_video_id = cv.id
  form.value.cover_preview = cv.file_path
  coverVideoStatus.value = cv.transcode_status || null
  // 清除已上传的图片文件选择
  if (coverInput.value) coverInput.value.value = ''
  form.value.cover_image = null
  coverPickerVisible.value = false
}

// 清除封面（图片和视频一并清除）
function clearCover() {
  form.value.cover_video_id = null
  form.value.cover_preview = null
  form.value.cover_image = null
  if (coverInput.value) coverInput.value.value = ''
  if (coverVideoFileInput.value) coverVideoFileInput.value.value = ''
  stopCoverTranscodePolling()
  coverVideoStatus.value = null
  coverUploadStatus.value = ''
}

function onCoverSelected() {
  const file = coverInput.value?.files?.[0]
  if (!file) return
  form.value.cover_image = file
  // 图片与视频互斥：选图片时清除封面视频
  form.value.cover_video_id = null
  const reader = new FileReader()
  reader.onload = (e) => { form.value.cover_preview = e.target.result }
  reader.readAsDataURL(file)
}

// 判断封面是否为视频（路径以 .mp4 结尾，或 data URL 的 MIME 为 video/）
function isVideoCover(url) {
  if (!url) return false
  if (url.startsWith('data:')) return url.startsWith('data:video/')
  return /\.mp4(\?|$)/i.test(url)
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
    fd.append('intro_tail_seconds', String(Number.isFinite(parseInt(form.value.intro_tail_seconds)) ? parseInt(form.value.intro_tail_seconds) : 3))
    fd.append('menu_position', form.value.menu_position || 'center')
    const ti = buildI18n('title_'); if (ti) fd.append('title_i18n', ti)
    const di = buildI18n('desc_'); if (di) fd.append('description_i18n', di)
    if (form.value.cover_image instanceof File) fd.append('cover_image', form.value.cover_image)
    // 封面视频 ID（编辑时始终提交，包括 null，便于清除）
    if (isEditing.value || form.value.cover_video_id) {
      fd.append('cover_video_id', form.value.cover_video_id || '')
    }

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

// 新建/编辑弹窗关闭时停止转码轮询（服务端转码不受影响，状态可在视频管理查看）
watch(modalVisible, v => { if (!v) stopCoverTranscodePolling() })

// 组件卸载时清理定时器，避免内存泄漏
onUnmounted(stopCoverTranscodePolling)
</script>
