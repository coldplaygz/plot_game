<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Left Sidebar -->
    <div class="w-[200px] bg-[#111122] border-r border-border-dim py-5 px-0 shrink-0 sticky top-0 h-screen flex flex-col">
      <div class="px-5 pb-5 text-base font-bold text-white border-b border-border-dim mb-3">
        长城AI互动短剧平台<span class="text-brand-purple text-[11px] block font-normal">管理后台</span>
      </div>
      <nav class="flex-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-2 px-5 py-[10px] text-text-dim no-underline text-[13px] cursor-pointer transition-all duration-200"
          active-class="!text-white !bg-[#1a1a3e]"
        >{{ item.icon }} {{ item.label }}</router-link>
      </nav>
      <div class="px-5 py-[14px] border-t border-border-dim text-xs text-text-dim">
        <span>{{ auth.user?.nickname || auth.user?.username || '' }}</span><br />
        <a class="text-red-500 cursor-pointer text-[11px]" @click="handleLogout">退出登录</a>
      </div>
    </div>

    <!-- Right Content -->
    <div class="flex-1 p-7 overflow-y-auto bg-surface-dark">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const navItems = [
  { path: '/admin', icon: '📊', label: '仪表盘' },
  { path: '/admin/games', icon: '🎮', label: '游戏管理' },
  { path: '/admin/themes', icon: '🎨', label: '选项主题' },
  { path: '/admin/videos', icon: '🎬', label: '视频管理' },
  { path: '/admin/scenes', icon: '📝', label: '场景编辑' },
  { path: '/admin/props', icon: '🎁', label: '道具管理' },
  { path: '/admin/users', icon: '👥', label: '用户管理' },
  { path: '/admin/recharge', icon: '💰', label: '充值管理' },
  { path: '/admin/points-log', icon: '📋', label: '积分记录' },
  { path: '/admin/settings', icon: '⚙️', label: '系统设置' }
]

function handleLogout() {
  auth.logout()
  router.push('/admin/login')
}
</script>
