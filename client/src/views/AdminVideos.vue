<template>
  <div>
    <h2 class="text-xl text-white mb-5">🎬 视频管理</h2>

    <!-- Filter -->
    <div class="flex items-center gap-3 mb-4">
      <label class="text-xs text-text-dim">筛选游戏：</label>
      <select v-model="filterGameId" @change="loadVideos"
        class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
        <option :value="null">全部游戏</option>
        <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
      </select>
    </div>

    <!-- Batch Upload -->
    <div class="bg-surface-card border border-border-dim rounded-xl p-5 mb-5">
      <h3 class="text-sm font-bold text-white mb-3">📦 批量上传</h3>
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label class="text-xs text-text-dim">视频文件（可多选）</label>
          <input
            ref="batchFileInput"
            type="file"
            multiple
            accept=".mp4,.webm,.mov,.avi,.mkv"
            class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple"
            @change="onBatchFilesSelected"
          />
          <span v-if="batchFiles.length" class="text-xs text-text-dim">已选择 {{ batchFiles.length }} 个文件</span>
        </div>
        <div class="flex flex-col gap-1 min-w-[160px]">
          <label class="text-xs text-text-dim">归属游戏</label>
          <select
            v-model="batchGameId"
            class="w-full px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple"
          >
            <option :value="null">— 不归属游戏 —</option>
            <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
          </select>
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-1.5 text-xs text-text-dim cursor-pointer whitespace-nowrap">
            <input v-model="batchAutoScenes" type="checkbox" class="rounded" />
            同时为每个视频创建场景
          </label>
          <button
            class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-purple text-white border-none rounded-lg text-sm cursor-pointer hover:bg-brand-purple-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="batchUploading || !batchFiles.length"
            @click="batchUpload"
          >{{ batchUploading ? '上传中 ' + batchPercent + '%' : '批量上传' }}</button>
        </div>
      </div>
      <!-- Batch Progress -->
      <div v-if="batchUploading" class="mt-3">
        <div class="flex justify-between text-xs text-text-dim mb-1">
          <span>{{ batchStatus }}</span>
          <span>{{ batchDone }}/{{ batchTotal }}</span>
        </div>
        <div class="w-full h-2 bg-surface-darkest rounded-full overflow-hidden mb-1">
          <div class="h-full bg-brand-purple transition-all duration-300" :style="{ width: batchPercent + '%' }"></div>
        </div>
        <div class="text-[11px] text-text-dimmer">{{ batchLoaded }} / {{ batchTotalSize }}</div>
      </div>
      <!-- Batch Result -->
      <div v-if="batchResult" class="mt-3 p-3 bg-[#0a1a0a] border border-[#22c55e]/30 rounded-lg text-sm text-[#22c55e]">
        {{ batchResult }}
      </div>
      <div v-if="batchErrors.length" class="mt-2 space-y-1">
        <div v-for="(err, i) in batchErrors" :key="i" class="p-2 bg-[#1a0a0a] border border-[#ef4444]/30 rounded text-xs text-[#ef4444]">{{ err }}</div>
      </div>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标题</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">归属游戏</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">文件名</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">大小</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">时长</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">状态</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">关联</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">日期</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!videos.length">
          <td colspan="10" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无视频</td>
        </tr>
        <tr v-for="v in pageVideos" :key="v.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ v.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ v.title }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">{{ v.game_title || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ v.filename }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (v.file_size / 1024 / 1024).toFixed(1) }}MB</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (v.duration || 0).toFixed(0) }}s</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <span v-if="v.transcode_status === 'queued'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full text-[11px]">🕐 排队中</span>
            <span v-else-if="v.transcode_status === 'transcoding'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full text-[11px]">⏳ 转码中</span>
            <span v-else-if="v.transcode_status === 'failed'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-full text-[11px]">⚠ 转码失败</span>
            <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-[11px]">✓ 就绪</span>
          </td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ v.scene_count || 0 }}个场景</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ formatDate(v.created_at) }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#059669] text-white hover:bg-[#047857]" @click="playVideo(v)">▶</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple ml-1" @click="manageMedia(v)">🎵字幕</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple ml-1" @click="replaceVideo(v)">🔄</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteVideo(v.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <AppPagination
      :page="page"
      :total="videos.length"
      :pageSize="pageSize"
      @update="onPageChange"
    />

    <!-- Video Player Modal -->
    <VideoPlayerModal
      :visible="playerVisible"
      :video="playerVideo"
      @close="playerVisible = false"
    />

    <!-- Media Management Modal -->
    <AppModal
      :visible="mediaModalVisible"
      :title="'🎵 音轨 & 字幕 - ' + (mediaVideo?.title || '')"
      :wide="true"
      @close="mediaModalVisible = false"
    >
      <!-- Audio Tracks -->
      <div class="mt-5 pt-4 border-t border-border-dim">
        <h4 class="text-sm text-text-subtle mb-[10px]">🎤 音轨</h4>
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">语言</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标签</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">大小</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">默认</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!audios.length">
              <td colspan="5" class="text-text-dimmest px-[14px] py-[10px]">暂无音轨</td>
            </tr>
            <tr v-for="a in audios" :key="'a'+a.id" class="hover:bg-[#1a1a3e]">
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ a.language }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ a.label }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (a.file_size / 1024).toFixed(1) }}KB</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ a.is_default ? '✅' : '' }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c]" @click="deleteMediaItem('audio', a.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <!-- Audio Upload -->
        <div class="flex gap-2 items-center mt-2 flex-wrap">
          <select v-model="audioLang" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
          <input v-model="audioLabel" placeholder="标签(如: 中文配音)" class="flex-1 min-w-[100px] px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none" />
          <input ref="audioFileInput" type="file" accept=".mp3,.m4a,.aac,.ogg,.wav" class="w-[120px] px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none" />
          <label class="text-xs text-text-dim whitespace-nowrap"><input v-model="audioDefault" type="checkbox" class="mr-1" /> 默认</label>
          <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="uploadMediaItem('audio')">上传音轨</button>
        </div>
      </div>

      <!-- Subtitle Tracks -->
      <div class="mt-5 pt-4 border-t border-border-dim">
        <h4 class="text-sm text-text-subtle mb-[10px]">📝 字幕</h4>
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">语言</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标签</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">大小</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">默认</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!subtitles.length">
              <td colspan="5" class="text-text-dimmest px-[14px] py-[10px]">暂无字幕</td>
            </tr>
            <tr v-for="s in subtitles" :key="'s'+s.id" class="hover:bg-[#1a1a3e]">
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.language }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.label }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (s.file_size / 1024).toFixed(1) }}KB</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.is_default ? '✅' : '' }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c]" @click="deleteMediaItem('subtitle', s.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <!-- Subtitle Upload -->
        <div class="flex gap-2 items-center mt-2 flex-wrap">
          <select v-model="subLang" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
          <input v-model="subLabel" placeholder="标签(如: 中文字幕)" class="flex-1 min-w-[100px] px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none" />
          <input ref="subFileInput" type="file" accept=".srt,.vtt,.ass,.ssa" class="w-[120px] px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none" />
          <label class="text-xs text-text-dim whitespace-nowrap"><input v-model="subDefault" type="checkbox" class="mr-1" /> 默认</label>
          <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="uploadMediaItem('subtitle')">上传字幕</button>
        </div>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="refreshMedia">刷新</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="mediaModalVisible = false">关闭</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppPagination from '../components/AppPagination.vue'
import VideoPlayerModal from '../components/VideoPlayerModal.vue'
import AppModal from '../components/AppModal.vue'

const { get, del, upload } = useApi()
const { show } = useToast()

// Data
const videos = ref([])
const page = ref(1)
const pageSize = ref(10)
const videoCache = ref({})

const games = ref([])
const filterGameId = ref(null)

// Batch Upload
const batchFileInput = ref(null)
const batchFiles = ref([])
const batchGameId = ref(null)
const batchAutoScenes = ref(false)
const batchUploading = ref(false)
const batchPercent = ref(0)
const batchLoaded = ref('')
const batchTotalSize = ref('')
const batchStatus = ref('')
const batchDone = ref(0)
const batchTotal = ref(0)
const batchResult = ref('')
const batchErrors = ref([])

// Single Upload (for replace, media)
const uploading = ref(false)
const uploadPercent = ref(0)
const uploadLoaded = ref('')
const uploadTotal = ref('')

// Player
const playerVisible = ref(false)
const playerVideo = ref(null)

// Media Management
const mediaModalVisible = ref(false)
const mediaVideo = ref(null)
const audios = ref([])
const subtitles = ref([])
const audioLang = ref('zh')
const audioLabel = ref('')
const audioDefault = ref(false)
const audioFileInput = ref(null)
const subLang = ref('zh')
const subLabel = ref('')
const subDefault = ref(false)
const subFileInput = ref(null)

// Computed
const pageVideos = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return videos.value.slice(start, start + pageSize.value)
})

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString()
}

function onPageChange(p, ps) {
  page.value = p
  pageSize.value = ps
}

function checkTranscoding(v, action) {
  if (v.transcode_status === 'queued' || v.transcode_status === 'transcoding') {
    const hint = v.transcode_status === 'queued' ? '排队等待转码中' : '正在转码中'
    show(`⚠ 该视频${hint}，请等待转码完成后再${action}`)
    return false
  }
  return true
}

function onBatchFilesSelected() {
  batchFiles.value = Array.from(batchFileInput.value?.files || [])
  batchResult.value = ''
  batchErrors.value = []
}

async function loadVideos() {
  try {
    const params = { limit: 200 }
    if (filterGameId.value) params.game_id = filterGameId.value
    const r = await get('/videos', params)
    videos.value = r.videos || []
    const cache = {}
    videos.value.forEach(v => { cache[v.id] = v })
    videoCache.value = cache
  } catch (e) {
    show('加载视频失败: ' + e.message)
  }
}

async function loadGames() {
  try {
    const r = await get('/games')
    games.value = r.games || []
  } catch (e) {
    // silently ignore
  }
}

function uploadWithXHR(url, formData, onSuccess) {
  uploading.value = true
  uploadPercent.value = 0
  uploadLoaded.value = '0MB'
  uploadTotal.value = '0MB'

  const token = localStorage.getItem('plot_game_token')
  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/api' + url)
  if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100)
      uploadPercent.value = pct
      uploadLoaded.value = (e.loaded / 1024 / 1024).toFixed(1) + 'MB'
      uploadTotal.value = (e.total / 1024 / 1024).toFixed(1) + 'MB'
    }
  }

  xhr.onload = () => {
    uploading.value = false
    try {
      const r = JSON.parse(xhr.responseText)
      if (r.error) { show('上传失败: ' + r.error); return }
      onSuccess(r)
    } catch (e) { show('响应解析失败') }
  }

  xhr.onerror = () => { uploading.value = false; show('网络错误') }
  xhr.send(formData)
}

async function batchUpload() {
  if (!batchFiles.value.length) return show('请选择文件')

  batchResult.value = ''
  batchErrors.value = []
  batchUploading.value = true
  batchDone.value = 0
  batchTotal.value = batchFiles.value.length
  batchPercent.value = 0

  const token = localStorage.getItem('plot_game_token')
  const results = { videos: [], scenes: [], errors: [] }
  const files = [...batchFiles.value]
  let uploadedSize = 0
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  batchTotalSize.value = (totalSize / 1024 / 1024).toFixed(1) + 'MB'

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    batchStatus.value = '正在上传: ' + file.name

    const fd = new FormData()
    fd.append('video', file)
    fd.append('title', file.name.replace(/\.[^.]+$/, ''))
    if (batchGameId.value) fd.append('game_id', batchGameId.value)
    if (batchAutoScenes.value) fd.append('auto_create_scene', '1')

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/videos')
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)

        let uploadDone = false
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const done = uploadedSize + e.loaded
            batchPercent.value = Math.round((done / totalSize) * 100)
            batchLoaded.value = (done / 1024 / 1024).toFixed(1) + 'MB'
            if (e.loaded >= e.total - 1) {
              uploadDone = true
              batchStatus.value = '正在转码: ' + file.name
            }
          }
        }

        xhr.onload = () => {
          try {
            const r = JSON.parse(xhr.responseText)
            if (r.error) {
              results.errors.push(file.name + ': ' + r.error)
            } else {
              if (r.video) results.videos.push(r.video)
              if (r.scene) results.scenes.push(r.scene)
            }
          } catch (e) {
            results.errors.push(file.name + ': 响应解析失败')
          }
          uploadedSize += file.size
          resolve()
        }

        xhr.onerror = () => {
          results.errors.push(file.name + ': 网络错误')
          uploadedSize += file.size
          resolve()
        }

        xhr.send(fd)
      })
    } catch (e) {
      results.errors.push(file.name + ': ' + e.message)
      uploadedSize += file.size
    }

    batchDone.value = i + 1
  }

  batchUploading.value = false
  batchStatus.value = ''

  const videoCount = results.videos.length
  const sceneCount = results.scenes.length
  batchResult.value = '成功上传 ' + videoCount + ' 个视频，创建 ' + sceneCount + ' 个场景'
  batchErrors.value = results.errors

  if (videoCount > 0) {
    batchFiles.value = []
    if (batchFileInput.value) batchFileInput.value.value = ''
    loadVideos()
  }
}

function playVideo(v) {
  if (!checkTranscoding(v, '播放')) return
  playerVideo.value = v
  playerVisible.value = true
}

async function deleteVideo(id) {
  const v = videos.value.find(x => x.id === id)
  if (v && !checkTranscoding(v, '删除')) return
  if (!confirm('确定删除? 关联场景也将被删除!')) return
  try {
    await del('/videos/' + id)
    show('已删除')
    loadVideos()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

function replaceVideo(v) {
  if (!checkTranscoding(v, '替换')) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mp4,.webm,.mov,.avi,.mkv'
  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return
    if (!confirm(`确定用 "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) 替换 "${v.title}"？`)) return

    const fd = new FormData()
    fd.append('video', file)

    uploadWithXHR('/videos/' + v.id + '/replace', fd, () => {
      show('视频已替换!')
      loadVideos()
    })
  }
  input.click()
}

async function manageMedia(v) {
  if (!checkTranscoding(v, '管理音轨字幕')) return
  mediaVideo.value = v
  mediaModalVisible.value = true
  await refreshMedia()
}

async function refreshMedia() {
  if (!mediaVideo.value) return
  try {
    const [aRes, sRes] = await Promise.all([
      get('/media/' + mediaVideo.value.id + '/audios'),
      get('/media/' + mediaVideo.value.id + '/subtitles')
    ])
    audios.value = aRes.audios || []
    subtitles.value = sRes.subtitles || []
  } catch (e) {
    show('加载媒体信息失败')
  }
}

async function uploadMediaItem(type) {
  if (!mediaVideo.value) return
  const fileInput = type === 'audio' ? audioFileInput : subFileInput
  const file = fileInput.value?.files?.[0]
  if (!file) return show('请选择文件')
  const language = type === 'audio' ? audioLang.value : subLang.value
  const label = type === 'audio' ? (audioLabel.value.trim() || language) : (subLabel.value.trim() || language)
  const isDefault = type === 'audio' ? (audioDefault.value ? '1' : '0') : (subDefault.value ? '1' : '0')

  const fd = new FormData()
  fd.append('file', file)
  fd.append('language', language)
  fd.append('label', label)
  fd.append('is_default', isDefault)

  const url = '/media/' + mediaVideo.value.id + '/' + (type === 'audio' ? 'audios' : 'subtitles')

  uploadWithXHR(url, fd, () => {
    show('上传成功')
    refreshMedia()
  })
}

async function deleteMediaItem(type, id) {
  if (!confirm('确定删除？')) return
  if (!mediaVideo.value) return
  const url = '/media/' + mediaVideo.value.id + '/' + (type === 'audio' ? 'audios' : 'subtitles') + '/' + id
  try {
    await del(url)
    show('已删除')
    refreshMedia()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

onMounted(() => {
  loadVideos()
  loadGames()
})
</script>
