<template>
  <div>
    <h2 class="text-xl text-white mb-5">📊 仪表盘</h2>

    <!-- Stats Cards -->
    <div class="grid gap-[14px] mb-6" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
      <div class="bg-surface-card border border-border-dim rounded-xl p-[18px]">
        <div class="text-[26px] font-bold text-brand-purple">{{ stats.games }}</div>
        <div class="text-xs text-text-dimmer mt-[3px]">游戏总数</div>
      </div>
      <div class="bg-surface-card border border-border-dim rounded-xl p-[18px]">
        <div class="text-[26px] font-bold text-brand-purple">{{ stats.videos }}</div>
        <div class="text-xs text-text-dimmer mt-[3px]">视频总数</div>
      </div>
      <div class="bg-surface-card border border-border-dim rounded-xl p-[18px]">
        <div class="text-[26px] font-bold text-brand-purple">{{ stats.scenes }}</div>
        <div class="text-xs text-text-dimmer mt-[3px]">场景节点</div>
      </div>
      <div class="bg-surface-card border border-border-dim rounded-xl p-[18px]">
        <div class="text-[26px] font-bold text-brand-cyan">{{ stats.users }}</div>
        <div class="text-xs text-text-dimmer mt-[3px]">用户总数</div>
      </div>
    </div>

    <!-- Info -->
    <div class="text-text-dimmer text-[13px] leading-loose">
      <p>欢迎使用长城AI互动短剧平台内容管理系统。</p>
      <p>左侧菜单可管理游戏、视频、场景和结局。</p>
      <p>游戏入口: <a href="/" target="_blank" class="text-brand-purple">/</a></p>
      <p class="mt-3 text-text-dimmest">
        <b>工作流程:</b><br />
        ① 创建游戏 → ② 上传视频 → ③ 创建场景(关联视频) → ④ 为场景添加选项 → ⑤ 设置结局
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'

const { get } = useApi()

const stats = ref({ games: 0, videos: 0, scenes: 0, users: 0 })

onMounted(async () => {
  try {
    const [gc, vc, sc, uc] = await Promise.all([
      get('/games'),
      get('/videos', { limit: 1 }),
      get('/scenes'),
      get('/users', { limit: 1 })
    ])
    stats.value.games = gc.games?.length || 0
    stats.value.videos = vc.pagination?.total || 0
    stats.value.scenes = sc.scenes?.length || 0
    stats.value.users = uc.pagination?.total || 0
  } catch (e) { /* ignore */ }
})
</script>
