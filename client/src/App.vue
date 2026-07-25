<template>
  <router-view />
  <AppToast />
  <AppConfirm />
</template>

<script setup>
import { onMounted } from 'vue'
import AppToast from './components/AppToast.vue'
import AppConfirm from './components/AppConfirm.vue'
import { useApi } from './composables/useApi'
import { useLangStore } from './stores/lang'

const { get } = useApi()
const langStore = useLangStore()

onMounted(async () => {
  try {
    const r = await get('/config')
    const cfg = r.config || {}
    // 系统默认语言
    if (cfg.default_lang) langStore.initFromSystem(cfg.default_lang)
    // 存入全局变量供页面使用
    window.__SYS_CONFIG__ = cfg
  } catch (e) { /* ignore */ }
})
</script>
