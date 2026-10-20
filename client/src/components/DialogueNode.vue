<template>
  <div class="dialogue-node">
    <div class="flex items-start gap-2 flex-wrap group/node">
      <!-- 折叠/展开 -->
      <button
        v-if="node.children.length"
        class="shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded border border-border-dim bg-surface-dark text-text-dim text-[10px] cursor-pointer hover:text-white hover:border-brand-purple transition-colors"
        :title="collapsed ? '展开' : '折叠'"
        @click="collapsed = !collapsed"
      >{{ collapsed ? '▸' : '▾' }}</button>
      <span v-else class="shrink-0 w-5 text-center text-xs mt-0.5 text-text-dimmest">{{ node.node_type === 'option' ? '❓' : '💬' }}</span>

      <div class="flex-1 min-w-[180px]">
        <div :class="textClass">
          <span v-if="node.node_type === 'option'" class="inline-flex items-center px-1.5 py-[1px] rounded text-[10px] mr-1 bg-amber-500/15 text-amber-400">❓ 提问</span>
          <span v-else-if="node._isChoiceItem" class="inline-flex items-center px-1.5 py-[1px] rounded text-[10px] mr-1 bg-cyan-500/15 text-cyan-400">🔘 选项</span>
          <span v-if="node.speaker" class="inline-flex items-center px-1.5 py-[1px] rounded text-[10px] mr-1 bg-brand-purple/15 text-brand-purple">{{ node.speaker }}</span>
          <span class="mr-1 text-text-dimmest text-[10px]">L{{ depth }}</span>{{ node.text }}
        </div>
        <div class="text-text-dimmest text-[10px] mt-0.5">
          <template v-if="depth === 0">视频第 {{ node.show_time }}s 触发 · </template>
          {{ node.children.length ? node.children.length + ' 个子节点' : '末节点' }}
        </div>
      </div>

      <div class="flex gap-1 shrink-0 flex-wrap">
        <button class="d-btn bg-[#2563eb] hover:bg-[#1d4ed8]" @click="$emit('edit', node.id)">编辑</button>
        <!-- 提问节点 → 加选项；普通对白 → 加后续对白 + 也可以加提问 -->
        <button v-if="node.node_type === 'option'"
          class="d-btn bg-cyan-600 hover:bg-cyan-700"
          @click="$emit('add', node.id, 'line')">+ 选项</button>
        <template v-else>
          <button class="d-btn bg-[#0891b2] hover:bg-[#0e7490]" @click="$emit('add', node.id, 'line')">+ 后续对白</button>
          <button class="d-btn bg-amber-600 hover:bg-amber-700" @click="$emit('add', node.id, 'option')">+ 提问</button>
        </template>
        <button class="d-btn bg-[#dc2626] hover:bg-[#b91c1c]" @click="$emit('del', node.id)">删除</button>
      </div>
    </div>

    <!-- 子节点：递归渲染，无限层级 -->
    <div v-if="node.children.length && !collapsed"
      class="mt-1.5 space-y-1.5"
      :class="node.node_type === 'option' ? 'ml-5 border-l-2 border-amber-500/30 pl-3' : 'ml-5 border-l-2 border-border-dim pl-3'">
      <DialogueNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @edit="$emit('edit', $event)"
        @add="(pid, t) => $emit('add', pid, t)"
        @del="$emit('del', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 }
})
defineEmits(['edit', 'add', 'del'])

const collapsed = ref(false)

// 文本层级样式：越深越淡
const textClass = {
  0: 'text-white text-[13px]',
  1: 'text-text-subtle text-[12px]',
  2: 'text-text-dim text-[12px]'
}
</script>

<style scoped>
@reference "../style.css";
.d-btn {
  @apply inline-flex items-center px-2 py-[3px] border-none rounded-md text-[11px] cursor-pointer text-white transition-all duration-200;
}
</style>
