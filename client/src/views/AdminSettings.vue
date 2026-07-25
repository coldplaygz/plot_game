<template>
  <div>
    <h2 class="text-xl text-white mb-5">⚙️ 系统设置</h2>

    <div class="space-y-4 max-w-2xl">
      <!-- 基本信息 -->
      <div class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h3 class="text-sm font-bold text-text-subtle mb-4">📋 基本信息</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-text-dim">系统名称</label>
            <input v-model="form.site_name" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div>
            <label class="text-xs text-text-dim">页脚文本</label>
            <input v-model="form.footer_text" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
        </div>
      </div>

      <!-- 默认语言 -->
      <div class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h3 class="text-sm font-bold text-text-subtle mb-4">🌐 默认语言</h3>
        <select v-model="form.default_lang" class="px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
          <option value="zh">🇨🇳 中文</option>
          <option value="en">🇺🇸 English</option>
          <option value="ja">🇯🇵 日本語</option>
          <option value="ko">🇰🇷 한국어</option>
        </select>
        <p class="text-[11px] text-text-dimmest mt-1">新用户首次访问时使用的语言</p>
      </div>

      <!-- 积分设置 -->
      <div class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h3 class="text-sm font-bold text-text-subtle mb-4">💎 积分设置</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-text-dim">充值汇率（¥1 = ? 积分）</label>
            <input v-model.number="form.points_rate" type="number" min="1" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div>
            <label class="text-xs text-text-dim">新选项默认积分消耗</label>
            <input v-model.number="form.default_point_cost" type="number" min="0" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
        </div>
      </div>

      <!-- 支付接口 -->
      <div class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h3 class="text-sm font-bold text-text-subtle mb-4">💳 支付接口</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-text-dim">是否启用</label>
            <label class="flex items-center gap-2 mt-1 text-sm text-text-subtle cursor-pointer">
              <input v-model="form.payment_enabled" type="checkbox" class="accent-brand-purple" :true-value="'1'" :false-value="'0'" /> 启用在线支付
            </label>
          </div>
          <div>
            <label class="text-xs text-text-dim">支付方式</label>
            <select v-model="form.payment_provider" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
              <option value="">不启用</option>
              <option value="wechat">微信支付</option>
              <option value="alipay">支付宝</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-text-dim">AppID</label>
            <input v-model="form.payment_appid" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
          <div>
            <label class="text-xs text-text-dim">密钥</label>
            <input v-model="form.payment_secret" type="password" class="w-full mt-1 px-3 py-2.5 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple" />
          </div>
        </div>
      </div>

      <!-- 其他 -->
      <div class="bg-surface-card border border-border-dim rounded-2xl p-5">
        <h3 class="text-sm font-bold text-text-subtle mb-4">🔧 其他设置</h3>
        <div class="space-y-3">
          <label class="flex items-center gap-2 text-sm text-text-subtle cursor-pointer">
            <input v-model="form.reg_enabled" type="checkbox" class="accent-brand-purple" :true-value="'1'" :false-value="'0'" /> 开放注册
          </label>
          <label class="flex items-center gap-2 text-sm text-text-subtle cursor-pointer">
            <input v-model="form.maintenance_mode" type="checkbox" class="accent-brand-purple" :true-value="'1'" :false-value="'0'" /> 维护模式（暂停服务）
          </label>
        </div>
      </div>

      <!-- Save -->
      <div class="flex gap-3 pt-2">
        <button @click="saveConfig" :disabled="saving" class="px-6 py-2.5 bg-brand-purple text-white rounded-lg text-sm hover:bg-brand-purple-dark transition-colors disabled:opacity-50">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
        <span v-if="saved" class="text-green-400 text-sm py-2.5">✅ 已保存</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'

const { get, put } = useApi()
const { show } = useToast()

const saving = ref(false)
const saved = ref(false)

const form = ref({
  site_name: '', footer_text: '', default_lang: 'zh',
  points_rate: 10, default_point_cost: 1,
  payment_provider: '', payment_appid: '', payment_secret: '', payment_enabled: '0',
  reg_enabled: '1', maintenance_mode: '0'
})

onMounted(async () => {
  try {
    const r = await get('/config/all')
    const map = {}
    r.configs.forEach(c => { map[c.config_key] = c.config_value })
    form.value = { ...form.value, ...map }
  } catch (e) { show('加载失败') }
})

async function saveConfig() {
  saving.value = true; saved.value = false
  try {
    const configs = Object.entries(form.value).map(([k, v]) => ({ config_key: k, config_value: String(v) }))
    await put('/config', { configs })
    saved.value = true
    show('设置已保存')
  } catch (e) { show('保存失败: ' + e.message) }
  finally { saving.value = false }
}
</script>
