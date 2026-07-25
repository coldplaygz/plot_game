<template>
  <div class="flex flex-col items-center h-screen w-screen fixed inset-0 bg-black/[0.92] overflow-y-auto py-10 px-5 z-[20]">
    <div class="fixed top-5 left-6 text-text-dim cursor-pointer text-[14px] z-[21]" @click="goLobby">← 返回大厅</div>
    <h2 class="mb-6 text-white text-[22px]">结局图鉴</h2>

    <div v-if="loading" class="text-text-dim p-10 text-center">加载中...</div>

    <div v-else-if="endings.length === 0" class="text-text-dimmer p-[60px] text-center">暂无结局数据，请等待管理员添加</div>

    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 max-w-[900px] w-full">
      <div
        v-for="e in endings"
        :key="e.id"
        class="bg-surface-login/80 border rounded-[14px] p-5 text-center transition-all duration-200"
        :class="unlockedIds.has(e.id) ? 'border-brand-purple' : 'border-border-dim opacity-30'"
      >
        <h4 class="text-[15px] mb-1 text-white">{{ unlockedIds.has(e.id) ? e.title : '???' }}</h4>
        <div class="text-[11px] text-text-dim">{{ e.character_name || '' }} · {{ e.type || '' }}</div>
        <div class="text-[11px] text-text-dim">{{ unlockedIds.has(e.id) ? (e.description || '') : '尚未解锁' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const game = useGameStore()

const endings = ref([])
const unlockedIds = ref(new Set())
const loading = ref(true)

onMounted(async () => {
  try {
    const [all, my] = await Promise.all([
      game.fetchEndings(),
      game.fetchMyEndings()
    ])
    endings.value = all
    unlockedIds.value = new Set(my.map(e => e.id))
  } catch (e) {
    // ignore
  } finally {
    loading.value = false
  }
})

function goLobby() {
  router.push('/')
}
</script>
