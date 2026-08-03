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
      <div class="flex-1"></div>
      <button v-if="selectedIds.size > 0" @click="batchDelete"
        class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c]">
        🗑 批量删除 ({{ selectedIds.size }})
      </button>
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
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0 w-10">
            <input type="checkbox" :checked="allSelected" @change="toggleSelectAll"
              class="accent-brand-purple cursor-pointer" />
          </th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标题</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">归属游戏</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">文件名</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">大小</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">时长</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">状态</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">HLS</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">关联</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">日期</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!videos.length">
          <td colspan="12" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无视频</td>
        </tr>
        <tr v-for="v in pageVideos" :key="v.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <input type="checkbox" :checked="selectedIds.has(v.id)" @change="toggleSelect(v.id)"
              class="accent-brand-purple cursor-pointer" />
          </td>
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
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <span v-if="v.hls_status === 'queued'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full text-[11px]">🕐 排队</span>
            <span v-else-if="v.hls_status === 'transcoding'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full text-[11px]">⏳ 打包</span>
            <span v-else-if="v.hls_status === 'failed'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-full text-[11px]">⚠ 失败</span>
            <span v-else-if="v.hls_status === 'done'" class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-[11px]">✓ HLS</span>
            <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 text-text-dimmer border border-border-dim rounded-full text-[11px]">—</span>
          </td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ v.scene_count || 0 }}个场景</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ formatDate(v.created_at) }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#059669] text-white hover:bg-[#047857]" @click="playVideo(v)">▶</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple ml-1" @click="editVideo(v)" title="编辑视频信息">✏️</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple ml-1" @click="manageMedia(v)">🎵字幕</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple ml-1" @click="replaceVideo(v)">🔄</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#7c3aed] text-white hover:bg-[#6d28d9] ml-1" @click="rebuildHls(v)" title="重建 HLS 多音轨流">HLS</button>
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
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">HLS</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!audios.length">
              <td colspan="6" class="text-text-dimmest px-[14px] py-[10px]">暂无音轨</td>
            </tr>
            <tr v-for="a in audios" :key="'a'+a.id" class="hover:bg-[#1a1a3e]">
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ a.language }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ a.label }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (a.file_size / 1024).toFixed(1) }}KB</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ a.is_default ? '✅' : '' }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <span v-if="a.hls_status === 'done'" class="text-green-400 text-[11px]">✓</span>
                <span v-else-if="a.hls_status === 'failed'" class="text-red-400 text-[11px]">⚠</span>
                <span v-else class="text-text-dimmer text-[11px]">—</span>
              </td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <button v-if="playingAudioId === a.id" class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" @click="stopAudio()">⏹ 停止</button>
                <button v-else class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#059669] text-white hover:bg-[#047857]" @click="playAudio(a)">▶ 试听</button>
                <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteMediaItem('audio', a.id)">删除</button>
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
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">HLS</th>
              <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!subtitles.length">
              <td colspan="6" class="text-text-dimmest px-[14px] py-[10px]">暂无字幕</td>
            </tr>
            <tr v-for="s in subtitles" :key="'s'+s.id" class="hover:bg-[#1a1a3e]">
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.language }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.label }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ (s.file_size / 1024).toFixed(1) }}KB</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.is_default ? '✅' : '' }}</td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <span v-if="s.hls_status === 'done'" class="text-green-400 text-[11px]">✓</span>
                <span v-else-if="s.hls_status === 'failed'" class="text-red-400 text-[11px]">⚠</span>
                <span v-else class="text-text-dimmer text-[11px]">—</span>
              </td>
              <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="openSubtitleEdit(s)">✏️ 编辑</button>
                <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteMediaItem('subtitle', s.id)">删除</button>
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

      <!-- 上传进度条 -->
      <div v-if="mediaUploading || mediaUploadText" class="mt-3 px-1">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs text-text-dim truncate flex-1">{{ mediaUploadText }}</span>
        </div>
        <div v-if="mediaUploading" class="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-brand-purple to-brand-pink rounded-full transition-[width] duration-200" :style="{ width: mediaUploadPercent + '%' }"></div>
        </div>
      </div>

      <template #actions>
        <!-- 左侧：HLS 重建按钮 + 进度 -->
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <button
            class="inline-flex items-center gap-[5px] px-[14px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 shrink-0"
            :class="(hlsRebuilding || mediaUploading)
              ? 'bg-surface-darkest text-text-dim cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-purple to-brand-pink text-white hover:opacity-90'"
            :disabled="hlsRebuilding || mediaUploading"
            :title="mediaUploading ? '请等待上传完成' : ''"
            @click="rebuildHlsFromMedia"
          >
            <svg v-if="hlsRebuilding" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span>{{ hlsRebuilding ? '重建中...' : (mediaUploading ? '上传中...' : '🔄 重建 HLS') }}</span>
          </button>
          <span v-if="hlsProgressText" class="text-xs text-text-dim truncate">{{ hlsProgressText }}</span>
        </div>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple shrink-0" @click="refreshMedia">刷新</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple shrink-0" @click="closeMediaModal">关闭</button>
      </template>
    </AppModal>

    <!-- 字幕编辑弹窗 -->
    <AppModal
      :visible="subEditVisible"
      :title="'✏️ 编辑字幕 - ' + (subEditLabel || '')"
      @close="subEditVisible = false"
    >
      <div class="mt-2">
        <textarea v-model="subEditContent" rows="14" spellcheck="false"
          class="w-full px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] font-mono outline-none focus:border-brand-purple resize-y"
          placeholder="WEBVTT&#10;&#10;00:00:01.000 --> 00:00:03.000&#10;字幕内容"></textarea>
        <p class="text-[11px] text-text-dimmer mt-1">保存后自动同步 HLS 副本，无需重建</p>
      </div>
      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark shrink-0" @click="saveSubtitleEdit" :disabled="subSaving">
          {{ subSaving ? '保存中...' : '保存' }}
        </button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple shrink-0" @click="subEditVisible = false">取消</button>
      </template>
    </AppModal>

    <!-- Edit Video Modal -->
    <AppModal
      :visible="editModalVisible"
      :title="'✏️ 编辑视频 - ' + (editForm.title || '')"
      @close="editModalVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">视频标题 *</label>
        <input v-model="editForm.title" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">归属游戏</label>
        <select v-model="editForm.game_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">— 不归属游戏 —</option>
          <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
        </select>
        <p class="text-[11px] text-text-dimmer mt-1">修改归属游戏会同步更新该视频关联场景的归属。</p>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveEditVideo">保存</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="editModalVisible = false">取消</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppPagination from '../components/AppPagination.vue'
import VideoPlayerModal from '../components/VideoPlayerModal.vue'
import AppModal from '../components/AppModal.vue'

const { get, post, put, del, upload } = useApi()
const { show } = useToast()

// Data
const videos = ref([])
const page = ref(1)
const pageSize = ref(10)
const videoCache = ref({})

// 批量删除选中
const selectedIds = ref(new Set())
const allSelected = computed(() => {
  const ids = pageVideos.value.map(v => v.id)
  return ids.length > 0 && ids.every(id => selectedIds.value.has(id))
})
function toggleSelect(id) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}
function toggleSelectAll() {
  const s = new Set(selectedIds.value)
  const ids = pageVideos.value.map(v => v.id)
  const allOn = ids.every(id => s.has(id))
  if (allOn) ids.forEach(id => s.delete(id))
  else ids.forEach(id => s.add(id))
  selectedIds.value = s
}
async function batchDelete() {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return
  if (!confirm(`确定删除选中的 ${ids.length} 个视频?\n关联的场景、选项也将一并删除!`)) return
  try {
    const res = await post('/videos/batch-delete', { ids })
    show(res.message || '批量删除成功')
    selectedIds.value = new Set()
    loadVideos()
  } catch (e) {
    show('批量删除失败: ' + e.message)
  }
}

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

// HLS 重建
const rebuildingAll = ref(false)

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

// 音轨试听
const playingAudioId = ref(null)
let audioPreview = null
function stopAudio() {
  if (audioPreview) {
    audioPreview.pause()
    audioPreview.src = ''
    audioPreview = null
  }
  playingAudioId.value = null
}
function playAudio(a) {
  stopAudio()
  if (!a?.file_path) return show('音轨文件不存在')
  const url = '/' + a.file_path.replace(/\\/g, '/')
  audioPreview = new Audio()
  audioPreview.src = url
  audioPreview.onended = () => { playingAudioId.value = null }
  audioPreview.onerror = () => { show('播放失败'); stopAudio() }
  audioPreview.play().catch(() => show('播放失败'))
  playingAudioId.value = a.id
}

// 字幕编辑
const subEditVisible = ref(false)
const subEditId = ref(null)
const subEditVideoId = ref(null)
const subEditLabel = ref('')
const subEditContent = ref('')
const subSaving = ref(false)
async function openSubtitleEdit(s) {
  if (!s) return
  subEditId.value = s.id
  subEditVideoId.value = mediaVideo.value?.id
  subEditLabel.value = s.label || s.language || ''
  subEditContent.value = ''
  subEditVisible.value = true
  try {
    const r = await get(`/media/${subEditVideoId.value}/subtitles/${s.id}/content`)
    subEditContent.value = r.content || ''
  } catch (e) {
    show('读取字幕内容失败: ' + e.message)
  }
}
async function saveSubtitleEdit() {
  if (subSaving.value) return
  if (!subEditContent.value.trim()) return show('字幕内容不能为空')
  subSaving.value = true
  try {
    await put(`/media/${subEditVideoId.value}/subtitles/${subEditId.value}/content`, { content: subEditContent.value })
    show('字幕已保存')
    subEditVisible.value = false
    refreshMedia()
  } catch (e) {
    show('保存失败: ' + e.message)
  } finally {
    subSaving.value = false
  }
}

// HLS 重建进度（音轨字幕对话框内的按钮）
const hlsRebuilding = ref(false)
const hlsProgressText = ref('')
let hlsProgressTimer = null

// 音轨/字幕上传进度
const mediaUploading = ref(false)
const mediaUploadPercent = ref(0)
const mediaUploadText = ref('')

// 列表状态响应式轮询（transcode_status + hls_status）
// 仅对处于 queued/transcoding 状态的视频定期拉取最新状态，无进行中任务时自动停止
let statusPollTimer = null
const STATUS_POLL_INTERVAL = 3000
const IN_PROGRESS_STATES = ['queued', 'transcoding']

function hasInProgressVideos() {
  return videos.value.some(v =>
    IN_PROGRESS_STATES.includes(v.transcode_status) ||
    IN_PROGRESS_STATES.includes(v.hls_status)
  )
}

function startStatusPolling() {
  if (statusPollTimer) return
  statusPollTimer = setInterval(pollInProgressStatuses, STATUS_POLL_INTERVAL)
  console.log('[StatusPoll] 启动列表状态轮询')
}

function stopStatusPolling() {
  if (!statusPollTimer) return
  clearInterval(statusPollTimer)
  statusPollTimer = null
  console.log('[StatusPoll] 停止列表状态轮询')
}

async function pollInProgressStatuses() {
  // 收集所有进行中的视频
  const pending = videos.value.filter(v =>
    IN_PROGRESS_STATES.includes(v.transcode_status) ||
    IN_PROGRESS_STATES.includes(v.hls_status)
  )

  if (pending.length === 0) {
    // 没有进行中的任务，停止轮询
    stopStatusPolling()
    return
  }

  // 并行拉取每个进行中视频的最新状态
  await Promise.all(pending.map(async (v) => {
    try {
      const res = await get('/videos/' + v.id + '/hls-status')
      // 直接更新数组中对应项的属性，触发响应式渲染
      const target = videos.value.find(x => x.id === v.id)
      if (!target) return
      if (res.transcode_status !== undefined && target.transcode_status !== res.transcode_status) {
        target.transcode_status = res.transcode_status
      }
      if (res.hls_status !== undefined && target.hls_status !== res.hls_status) {
        target.hls_status = res.hls_status
        // HLS 状态刚变为 done/failed 时，同步刷新缓存
        if (res.hls_status === 'done' || res.hls_status === 'failed') {
          videoCache.value[v.id] = { ...target }
        }
      }
    } catch (e) {
      // 单个视频查询失败不中断其他轮询
      console.warn('[StatusPoll] 查询 #' + v.id + ' 状态失败:', e.message)
    }
  }))
}

// Edit Video
const editModalVisible = ref(false)
const editVideoId = ref(null)
const editForm = ref({ title: '', game_id: null })
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
    // 加载后若有进行中的任务，启动状态轮询；否则停止
    if (hasInProgressVideos()) {
      startStatusPolling()
    } else {
      stopStatusPolling()
    }
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

// 编辑视频元数据（标题、归属游戏）
function editVideo(v) {
  editVideoId.value = v.id
  editForm.value = {
    title: v.title || '',
    game_id: v.game_id || null
  }
  editModalVisible.value = true
}

async function saveEditVideo() {
  if (!editForm.value.title.trim()) return show('标题不能为空')
  try {
    await put('/videos/' + editVideoId.value, {
      title: editForm.value.title.trim(),
      game_id: editForm.value.game_id || null
    })
    show('更新成功')
    editModalVisible.value = false
    loadVideos()
  } catch (e) {
    show('更新失败: ' + (e.message || '未知错误'))
  }
}

// 重建单个视频的 HLS 多音轨流
async function rebuildHls(v) {
  if (!confirm(`确定重建视频 "${v.title}" 的 HLS 多音轨流？\n（将重新切片视频/音轨/字幕）`)) return
  try {
    await post('/videos/' + v.id + '/rebuild-hls')
    show('HLS 重建任务已加入队列')
    // 乐观更新：立即将本地状态置为 queued，触发 UI 响应
    v.hls_status = 'queued'
    startStatusPolling()
  } catch (e) {
    show('HLS 重建失败: ' + (e.message || '未知错误'))
  }
}

// 音轨字幕对话框内：触发 HLS 重建 + 轮询进度
async function rebuildHlsFromMedia() {
  if (!mediaVideo.value || hlsRebuilding.value || mediaUploading.value) return
  const v = mediaVideo.value
  if (!confirm(`确定重建 "${v.title}" 的 HLS？\n（音轨+字幕已配置完成后点击，将重新切片视频/音轨/字幕）`)) return

  hlsRebuilding.value = true
  hlsProgressText.value = '提交重建任务...'

  try {
    await post('/videos/' + v.id + '/rebuild-hls')
    hlsProgressText.value = '已加入队列，等待转码...'
    // 乐观更新列表中对应视频的状态，并启动列表轮询（关闭对话框后仍能继续更新）
    const target = videos.value.find(x => x.id === v.id)
    if (target) target.hls_status = 'queued'
    startStatusPolling()
    // 启动对话框内进度轮询
    startHlsProgressPolling(v.id)
  } catch (e) {
    hlsRebuilding.value = false
    hlsProgressText.value = ''
    show('HLS 重建失败: ' + (e.message || '未知错误'))
  }
}

// 轮询 HLS 转码进度
function startHlsProgressPolling(videoId) {
  if (hlsProgressTimer) clearInterval(hlsProgressTimer)

  hlsProgressTimer = setInterval(async () => {
    try {
      const res = await get('/videos/' + videoId + '/hls-status')
      const status = res.hls_status
      const audioStatuses = (res.audios || []).map(a => a.hls_status)
      const subStatuses = (res.subtitles || []).map(s => s.hls_status)

      // 状态文本
      if (status === 'queued') {
        hlsProgressText.value = '排队中...'
      } else if (status === 'transcoding') {
        const audioDone = audioStatuses.filter(s => s === 'done').length
        const audioTotal = audioStatuses.length
        const subDone = subStatuses.filter(s => s === 'done').length
        const subTotal = subStatuses.length
        hlsProgressText.value = `转码中... 视频/音轨 ${audioDone}/${audioTotal} 字幕 ${subDone}/${subTotal}`
      } else if (status === 'done') {
        hlsProgressText.value = '✅ 重建完成'
        hlsRebuilding.value = false
        clearInterval(hlsProgressTimer)
        hlsProgressTimer = null
        // 刷新音轨/字幕列表（hls_status 已更新）+ 视频列表
        refreshMedia()
        loadVideos()
        setTimeout(() => { hlsProgressText.value = '' }, 3000)
      } else if (status === 'failed') {
        hlsProgressText.value = '❌ 重建失败'
        hlsRebuilding.value = false
        clearInterval(hlsProgressTimer)
        hlsProgressTimer = null
        show('HLS 重建失败，请检查服务器日志')
      }
    } catch (e) {
      // 轮询出错不停止，继续尝试
      console.warn('轮询 HLS 状态失败:', e)
    }
  }, 2000)
}

// 关闭音轨字幕对话框时清理（仅清理对话框内轮询，列表状态轮询独立运行）
function closeMediaModal() {
  stopAudio()
  subEditVisible.value = false
  if (hlsProgressTimer) {
    clearInterval(hlsProgressTimer)
    hlsProgressTimer = null
  }
  hlsRebuilding.value = false
  hlsProgressText.value = ''
  mediaUploading.value = false
  mediaUploadPercent.value = 0
  mediaUploadText.value = ''
  mediaModalVisible.value = false
}

// 一键重建所有存量视频的 HLS
async function rebuildAllHls() {
  if (!videos.value.length) {
    show('暂无视频可重建')
    return
  }
  if (!confirm(`确定将所有 ${videos.value.length} 个视频加入 HLS 重建队列？\n（会重新切片所有视频/音轨/字幕，耗时较长）`)) return
  rebuildingAll.value = true
  try {
    const res = await post('/videos/rebuild-hls-all')
    show(`已加入 ${res.total} 个视频到 HLS 重建队列`)
    // 乐观更新所有视频为 queued，启动列表轮询
    videos.value.forEach(v => { v.hls_status = 'queued' })
    startStatusPolling()
  } catch (e) {
    show('批量重建失败: ' + (e.message || '未知错误'))
  } finally {
    rebuildingAll.value = false
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

  // 独立 XHR 带进度显示
  mediaUploading.value = true
  mediaUploadPercent.value = 0
  mediaUploadText.value = `上传${type === 'audio' ? '音轨' : '字幕'}: ${file.name} (0%)`

  const token = localStorage.getItem('plot_game_token')
  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/api' + url)
  if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100)
      mediaUploadPercent.value = pct
      mediaUploadText.value = `上传${type === 'audio' ? '音轨' : '字幕'}: ${file.name} (${pct}% - ${(e.loaded / 1024 / 1024).toFixed(1)}/${(e.total / 1024 / 1024).toFixed(1)}MB)`
    }
  }

  xhr.onload = () => {
    mediaUploading.value = false
    mediaUploadPercent.value = 0
    try {
      const r = JSON.parse(xhr.responseText)
      if (r.error) {
        mediaUploadText.value = ''
        show('上传失败: ' + r.error)
        return
      }
      mediaUploadText.value = `✅ ${type === 'audio' ? '音轨' : '字幕'}上传完成，需点击「重建 HLS」生效`
      // 清空文件选择框
      if (fileInput.value) fileInput.value.value = ''
      refreshMedia()
      // 3秒后清空提示
      setTimeout(() => { mediaUploadText.value = '' }, 3000)
    } catch (e) {
      mediaUploadText.value = ''
      show('响应解析失败')
    }
  }

  xhr.onerror = () => {
    mediaUploading.value = false
    mediaUploadPercent.value = 0
    mediaUploadText.value = ''
    show('网络错误')
  }

  xhr.send(fd)
}

async function deleteMediaItem(type, id) {
  if (!confirm('确定删除？')) return
  if (!mediaVideo.value) return
  const url = '/media/' + mediaVideo.value.id + '/' + (type === 'audio' ? 'audios' : 'subtitles') + '/' + id
  try {
    await del(url)
    show(type === 'audio' ? '音轨已删除，需点击「重建 HLS」生效' : '字幕已删除，需点击「重建 HLS」生效')
    refreshMedia()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

onMounted(() => {
  loadVideos()
  loadGames()
})

// 组件卸载时清理所有定时器，避免内存泄漏
onUnmounted(() => {
  stopStatusPolling()
  if (hlsProgressTimer) {
    clearInterval(hlsProgressTimer)
    hlsProgressTimer = null
  }
})
</script>
