<template>
  <div class="min-h-screen bg-surface-darkest text-white pb-10">
    <!-- 顶栏 -->
    <div class="sticky top-0 z-30 bg-surface-darkest/95 backdrop-blur border-b border-border-dim">
      <div class="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <button @click="router.back()"
          class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white shrink-0">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <h1 class="text-lg font-bold flex-1 truncate">🏆 道具排行榜</h1>
        <span class="text-xs text-text-dim">{{ auth.user?.nickname || auth.user?.username }}</span>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-4">
      <!-- 时间切换 -->
      <div class="flex gap-2 my-5">
        <button v-for="p in periods" :key="p.key" @click="switchPeriod(p.key)"
          class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          :class="period === p.key
            ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/30'
            : 'bg-white/5 text-text-dim hover:bg-white/10 hover:text-white'">
          {{ p.label }}
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="py-20 flex justify-center">
        <div class="w-10 h-10 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!list.length" class="py-20 text-center">
        <div class="text-5xl mb-3">📭</div>
        <div class="text-text-dim text-sm">本周期还没有人使用道具，快来抢占第一！</div>
      </div>

      <!-- 榜单 -->
      <div v-else class="space-y-2">
        <!-- 前三名特殊卡片 -->
        <div v-for="(item, idx) in top3" :key="item.id"
          class="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all"
          :class="[
            idx === 0 ? 'bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border-amber-400/40' :
            idx === 1 ? 'bg-gradient-to-r from-slate-300/10 to-slate-400/5 border-slate-300/30' :
            'bg-gradient-to-r from-orange-700/15 to-orange-600/5 border-orange-600/30',
            item.id === auth.user?.id ? 'ring-2 ring-brand-purple' : ''
          ]">
          <div class="w-10 text-center shrink-0">
            <span v-if="idx === 0" class="text-3xl">🥇</span>
            <span v-else-if="idx === 1" class="text-3xl">🥈</span>
            <span v-else class="text-3xl">🥉</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">{{ item.nickname || item.username }}
              <span v-if="item.id === auth.user?.id" class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-purple/30 text-brand-purple">我</span>
            </div>
            <div class="text-[11px] text-text-dim mt-0.5">💎 消耗 {{ item.points_spent }} 积分</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-lg font-bold text-amber-400">{{ item.use_count }}</div>
            <div class="text-[10px] text-text-dimmer">次使用</div>
          </div>
        </div>

        <!-- 4名及以后 -->
        <div v-for="(item, idx) in rest" :key="item.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-border-dim transition-all"
          :class="item.id === auth.user?.id ? 'ring-2 ring-brand-purple' : ''">
          <div class="w-8 text-center text-sm font-bold text-text-dim shrink-0">{{ idx + 4 }}</div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ item.nickname || item.username }}
              <span v-if="item.id === auth.user?.id" class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-purple/30 text-brand-purple">我</span>
            </div>
            <div class="text-[11px] text-text-dim mt-0.5">💎 消耗 {{ item.points_spent }} 积分</div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-semibold text-brand-purple">{{ item.use_count }}</div>
            <div class="text-[10px] text-text-dimmer">次使用</div>
          </div>
        </div>
      </div>

      <!-- 我的排名 -->
      <div v-if="myRank" class="mt-6 px-4 py-3 rounded-xl bg-brand-purple/10 border border-brand-purple/30 flex items-center justify-between">
        <span class="text-sm text-text-subtle">我的排名</span>
        <span class="text-sm font-bold text-brand-purple">#{{ myRank.rank }} · 使用 {{ myRank.use_count }} 次 · 💎{{ myRank.points_spent }}</span>
      </div>
      <div v-else-if="!loading && list.length" class="mt-6 px-4 py-3 rounded-xl bg-white/5 border border-border-dim text-center text-sm text-text-dim">
        本周期你还没使用道具，快去玩一把！
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useApi } from '../composables/useApi'

const router = useRouter()
const auth = useAuthStore()
const { get } = useApi()

const periods = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '全年' }
]
const period = ref('week')
const list = ref([])
const myRank = ref(null)
const loading = ref(false)

const top3 = computed(() => list.value.slice(0, 3))
const rest = computed(() => list.value.slice(3))

async function load() {
  loading.value = true
  try {
    const r = await get('/props/leaderboard', { period: period.value })
    list.value = r.leaderboard || []
    myRank.value = r.myRank || null
  } catch (e) {
    list.value = []
    myRank.value = null
  } finally {
    loading.value = false
  }
}

function switchPeriod(key) {
  if (period.value === key) return
  period.value = key
  load()
}

onMounted(load)
</script>
