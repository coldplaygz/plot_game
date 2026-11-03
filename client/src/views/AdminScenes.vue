<template>
  <div>
    <h2 class="text-xl text-white mb-5">📝 场景编辑</h2>

    <!-- Filter + Toolbar -->
    <div class="flex gap-[10px] mb-4 flex-wrap items-center">
      <label class="text-xs text-text-dim">筛选游戏：</label>
      <select v-model="filterGameId" @change="loadScenes"
        class="px-3 py-2 bg-surface-darkest border border-border-dim rounded-lg text-white text-sm outline-none focus:border-brand-purple">
        <option :value="null">全部游戏</option>
        <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
      </select>
      <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark ml-3" @click="openSceneModal(0)">+ 创建场景</button>
      <span class="text-text-dimmer text-xs ml-3">⭐ = 起始场景 | 🏁 = 结局场景</span>
    </div>

    <!-- Table -->
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">标题</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">归属游戏</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">章节</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">视频</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">选项数</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">结局</th>
          <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!pageScenes.length">
          <td colspan="8" class="text-center py-[50px] px-5 text-text-dimmest text-sm">暂无场景</td>
        </tr>
        <tr v-for="s in pageScenes" :key="s.id" class="hover:bg-[#1a1a3e]">
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.id }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.is_start ? '⭐ ' : '' }}<span v-if="s.choice_count === 1 && s.auto_jump_count > 0" class="inline-flex items-center gap-[3px] px-2 py-[2px] rounded-[10px] text-[11px] mr-1 bg-amber-500/15 text-amber-400 align-middle">⚡直接</span>{{ s.title }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dim">{{ s.game_title || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.chapter || '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.video_title || '无视频' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.choice_count || 0 }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ s.is_ending ? '🏁 ' + (s.ending_title || '') : '-' }}</td>
          <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openSceneModal(s.id)">编辑</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#059669] text-white hover:bg-[#047857] ml-1" @click="openChoicesModal(s.id)">选项({{ s.choice_count || 0 }})</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#2563eb] text-white hover:bg-[#1d4ed8] ml-1" @click="openDialoguesModal(s.id)">💬 对白</button>
            <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteScene(s.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <AppPagination
      :page="page"
      :total="scenes.length"
      :pageSize="pageSize"
      @update="onPageChange"
    />

    <!-- Scene Edit Modal -->
    <AppModal
      :visible="sceneModalVisible"
      :title="editingSceneId > 0 ? '编辑场景' : '创建场景'"
      :wide="true"
      @close="sceneModalVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">场景标题 *</label>
        <input v-model="sceneForm.title" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言标题</label>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="sceneForm.title_en" placeholder="English" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="sceneForm.title_ja" placeholder="日本語" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="sceneForm.title_ko" placeholder="한국어" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">描述</label>
        <textarea v-model="sceneForm.description" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y min-h-[70px]"></textarea>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言描述</label>
        <div class="grid grid-cols-3 gap-2">
          <textarea v-model="sceneForm.desc_en" placeholder="English" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="sceneForm.desc_ja" placeholder="日本語" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="sceneForm.desc_ko" placeholder="한국어" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">归属游戏 * <span class="text-text-dimmer">(切换会重新过滤视频列表)</span></label>
        <select v-model="sceneForm.game_id" @change="onSceneGameIdChange" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">— 不归属游戏 —</option>
          <option v-for="g in games" :key="g.id" :value="g.id">{{ g.title }}</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">关联视频 * <span v-if="modalGameId" class="text-text-dimmer">(仅显示该场景所属游戏的视频)</span></label>
        <select v-model="sceneForm.video_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">--选择视频--</option>
          <option v-for="v in videoList" :key="v.id" :value="v.id">{{ v.title }} ({{ v.filename }})</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">章节</label>
        <input v-model="sceneForm.chapter" placeholder="如: 第一章" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px] flex items-center gap-2">
        <label class="text-xs text-text-dim">起始场景</label>
        <input v-model="sceneForm.is_start" type="checkbox" class="w-auto" />
        <span class="text-text-dim text-[11px]">(仅一个)</span>
      </div>
      <div class="mb-[14px] flex items-center gap-2">
        <label class="text-xs text-text-dim">结局场景</label>
        <input v-model="sceneForm.is_ending" type="checkbox" class="w-auto" />
        <select v-model="sceneForm.ending_id" class="flex-1 px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">--选择结局--</option>
          <option v-for="e in endingList" :key="e.id" :value="e.id">{{ e.title }} ({{ e.type }})</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">选择限时(秒)</label>
        <input v-model.number="sceneForm.choice_timer" type="number" min="0" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">选项弹出延迟(秒, 0=视频播完)</label>
        <input v-model.number="sceneForm.choice_delay" type="number" min="0" placeholder="0=自动取视频时长" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="sceneModalVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveScene">保存</button>
      </template>
    </AppModal>

    <!-- Choices Modal -->
    <AppModal
      :visible="choicesModalVisible"
      :title="'选项管理 - 场景#' + choicesSceneId"
      :wide="true"
      @close="choicesModalVisible = false"
    >
      <div class="mb-4 text-text-dim text-[13px]">场景: {{ choicesSceneTitle }}</div>
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">ID</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">选项文本</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">跳转场景</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">积分</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">主题</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">条件</th>
            <th class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a] text-text-dimmer font-medium bg-[#111122] sticky top-0">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!choices.length">
            <td colspan="7" class="text-text-dimmest px-[14px] py-[10px]">暂无选项</td>
          </tr>
          <tr v-for="c in choices" :key="c.id" class="hover:bg-[#1a1a3e]">
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.id }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
                <span v-if="c.is_auto_jump" class="inline-flex items-center gap-[3px] px-2 py-[2px] rounded-[10px] text-[11px] mr-1 bg-amber-500/15 text-amber-400">⚡直接</span>{{ c.text }}
              </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">{{ c.next_scene_title || '无' }}</td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <span :class="c.point_cost > 0 ? 'text-brand-purple' : 'text-text-dimmest'">{{ c.point_cost > 0 ? '💎'+c.point_cost : '-' }}</span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <span v-if="c.theme_name"
                class="inline-flex items-center gap-[3px] px-2 py-[2px] rounded-[10px] text-[11px] bg-brand-purple/15 text-brand-purple">🎨 {{ c.theme_name }}</span>
              <span v-else class="text-text-dimmest text-xs">跟随游戏</span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <span v-if="!c.conditions?.length">-</span>
              <span
                v-for="cd in c.conditions"
                :key="cd.id"
                class="inline-flex items-center gap-[3px] px-2 py-[2px] rounded-[10px] text-[11px] mx-0.5 bg-zinc-500/15 text-zinc-400"
              >{{ cd.character_name }}好感{{ cd.operator }}{{ cd.value }}</span>
            </td>
            <td class="px-[14px] py-[10px] text-left border-b border-[#1e1e3a]">
              <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openChoiceEditModal(c.id)">编辑</button>
              <button class="inline-flex items-center gap-[3px] px-3 py-[5px] border-none rounded-lg text-xs cursor-pointer transition-all duration-200 bg-[#dc2626] text-white hover:bg-[#b91c1c] ml-1" @click="deleteChoiceItem(c.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-4">
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openChoiceEditModal(0)">+ 添加选项</button>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="choicesModalVisible = false">关闭</button>
      </template>
    </AppModal>

    <!-- Choice Edit Modal -->
    <AppModal
      :visible="choiceEditVisible"
      :title="editingChoiceId > 0 ? '编辑选项' : '添加选项'"
      :wide="true"
      @close="choiceEditVisible = false"
    >
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">选项文本 *</label>
        <input v-model="choiceForm.text" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言选项文本</label>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="choiceForm.text_en" placeholder="English" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="choiceForm.text_ja" placeholder="日本語" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <input v-model="choiceForm.text_ko" placeholder="한국어" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">跳转场景 <span class="text-text-dimmer">(仅显示同游戏的场景)</span></label>
        <select v-model="choiceForm.next_scene_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">无(停留)</option>
          <option v-for="s in allScenes" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </div>
      <div class="mb-[14px]">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" v-model="choiceForm.is_auto_jump" class="w-4 h-4 accent-brand-purple cursor-pointer" />
          <span class="text-[13px] text-white">⚡ 直接跳转</span>
        </label>
        <p class="text-[11px] text-text-dimmer mt-1">仅当该场景只有这一个选项时生效：不弹选项卡，视频播完自动进入目标场景</p>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">排序</label>
        <input v-model.number="choiceForm.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">单独计时(秒,0=用场景默认)</label>
        <input v-model.number="choiceForm.timer_seconds" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🎨 选项主题 <span class="text-text-dimmer">(不设置则跟随游戏主题)</span></label>
        <select v-model="choiceForm.theme_id" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple">
          <option :value="null">跟随游戏主题</option>
          <option v-for="t in themes" :key="t.id" :value="t.id">{{ t.name }}{{ t.is_preset ? ' · 预设' : '' }}</option>
        </select>
        <!-- 实时预览 -->
        <div v-if="choiceForm.theme_id" class="mt-2 p-2.5 bg-surface-darkest border border-border-dim rounded-lg" :style="previewVars">
          <div class="choice-btn flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border">
            <span><span class="choice-number mr-1">1.</span>{{ choiceForm.text || '选项预览' }}</span>
            <span v-if="choiceForm.point_cost > 0" class="choice-cost inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]">💎 {{ choiceForm.point_cost }}</span>
          </div>
        </div>
      </div>

      <!-- Point Cost -->
      <div class="mt-5 pt-4 border-t border-border-dim">
        <h4 class="text-sm text-text-subtle mb-[10px]">💎 积分消耗</h4>
        <div class="flex items-center gap-2">
          <input v-model.number="choiceForm.point_cost" type="number" min="0" placeholder="消费积分" class="w-[120px] px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
          <span class="text-xs text-text-dim">积分/次 (0=免费)</span>
        </div>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="choiceEditVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveChoice">保存</button>
      </template>
    </AppModal>

    <!-- Dialogues Modal (树状) -->
    <AppModal
      :visible="dialoguesModalVisible"
      :title="'对白管理 - 场景#' + dialoguesSceneId"
      :wide="true"
      @close="dialoguesModalVisible = false"
    >
      <div class="mb-3 text-text-dim text-[13px]">
        场景: {{ dialoguesSceneTitle }}
        <span class="text-text-dimmer ml-2">💬 对白(点击逐条推进) · ❓ 提问(弹出选项1/选项2…，点选后走该选项下的后续对白，层级不限)</span>
      </div>
      <div v-if="!dialogueTree.length" class="text-center py-6 text-text-dimmest text-sm">暂无对白</div>
      <div v-else class="space-y-2 mb-4 max-h-[55vh] overflow-y-auto pr-1">
        <div v-for="node in dialogueTree" :key="node.id"
          class="border border-border-dim rounded-lg p-2.5 bg-surface-darkest">
          <DialogueNode :node="node" :depth="0"
            @edit="openDialogueEditModal"
            @add="(pid, type) => openDialogueEditModal(0, pid, type)"
            @del="deleteDialogueItem"
          />
        </div>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="openDialogueEditModal(0, null, 'line')">+ 添加对白</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-amber-600 text-white hover:bg-amber-700" @click="openDialogueEditModal(0, null, 'option')">+ 添加提问</button>
      </div>
    </AppModal>

    <!-- Dialogue Edit Modal -->
    <AppModal
      :visible="dialogueEditVisible"
      :title="editingDialogueId > 0 ? '编辑对白' : (dialogueForm.parent_id ? '添加子节点' : (dialogueForm.node_type === 'option' ? '添加提问' : '添加对白'))"
      :wide="true"
      @close="dialogueEditVisible = false"
    >
      <!-- 从对白库选取（仅新建时显示） -->
      <div v-if="editingDialogueId === 0 && libItems.length" class="mb-[14px] border border-border-dim rounded-lg p-3 bg-surface-darkest">
        <label class="block text-xs text-text-dim mb-1.5">📚 从对白库选取 <span class="text-text-dimmer">(点选自动填充下方表单)</span></label>
        <div class="flex flex-wrap gap-1.5 max-h-[130px] overflow-y-auto">
          <button v-for="lib in filteredLibItems" :key="lib.id"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer text-left border transition-all duration-200 max-w-full"
            :class="lib.node_type === 'option'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              : 'bg-brand-purple/10 border-brand-purple/30 text-white hover:bg-brand-purple/25'"
            @click="applyLibItem(lib)">
            <span class="shrink-0">{{ lib.node_type === 'option' ? '❓' : '💬' }}</span>
            <span class="truncate max-w-[280px]">{{ lib.speaker ? lib.speaker + '：' : '' }}{{ lib.text }}</span>
          </button>
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">节点类型</label>
        <div class="flex gap-4">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input v-model="dialogueForm.node_type" type="radio" value="line" class="w-auto accent-brand-purple" />
            <span class="text-[13px] text-white">💬 对白</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input v-model="dialogueForm.node_type" type="radio" value="option" class="w-auto accent-brand-purple" />
            <span class="text-[13px] text-white">❓ 提问（弹出子选项）</span>
          </label>
        </div>
        <p class="text-[11px] text-text-dimmer mt-1">提问：其子节点作为候选项按钮弹出，玩家点选后播放该选项下的后续对白；后续对白里可继续加对白或再嵌套提问，层级不限</p>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">角色 <span class="text-text-dimmer">(决定对白形象与名牌, 说话人自动带出)</span></label>
        <select v-model="dialogueForm.character_id" class="picker w-full" @change="onDialogueCharChange">
          <option :value="null">不关联角色</option>
          <option v-for="ch in sceneCharacters" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
        </select>
      </div>
      <div v-if="dialogueForm.character_id && dialogueExpressions.length" class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1.5">表情 <span class="text-text-dimmer">(对白显示该表情形象图, 点选; 再点一次取消=默认形象)</span></label>
        <div class="flex flex-wrap gap-2">
          <!-- 默认形象选项 -->
          <button type="button"
            class="flex flex-col items-center gap-1 w-16 cursor-pointer bg-transparent border-none p-0"
            :class="!dialogueForm.expression ? 'opacity-100' : 'opacity-40 hover:opacity-70'"
            @click="dialogueForm.expression = null">
            <div class="w-12 h-12 rounded-lg flex items-center justify-center text-white/60 text-[10px] border-2 bg-white/5"
              :class="!dialogueForm.expression ? 'border-brand-purple' : 'border-white/15'">默认</div>
            <span class="text-[10px]" :class="!dialogueForm.expression ? 'text-white' : 'text-text-dimmer'">默认</span>
          </button>
          <!-- 表情形象选项 -->
          <button type="button" v-for="e in dialogueExpressions" :key="e.key"
            class="flex flex-col items-center gap-1 w-16 cursor-pointer bg-transparent border-none p-0"
            :class="dialogueForm.expression === e.key ? 'opacity-100' : 'opacity-40 hover:opacity-70'"
            @click="dialogueForm.expression = dialogueForm.expression === e.key ? null : e.key">
            <img :src="'/' + e.avatar"
              class="w-12 h-12 rounded-lg object-contain bg-white/5 border-2"
              :class="dialogueForm.expression === e.key ? 'border-brand-purple' : 'border-transparent'"
              :style="dialogueForm.expression === e.key ? {} : { borderColor: (sceneCharacters.find(c => c.id === dialogueForm.character_id)?.color) || 'rgba(255,255,255,0.15)' }" />
            <span class="text-[10px]" :class="dialogueForm.expression === e.key ? 'text-white' : 'text-text-dimmer'">{{ e.label }}</span>
          </button>
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1.5">文字特效 <span class="text-text-dimmer">(对白文本的显示效果, 点选; 再点一次取消=普通)</span></label>
        <div class="flex flex-wrap gap-2">
          <button type="button" v-for="fx in textEffectOptions" :key="fx.value"
            class="px-3 py-1.5 rounded-full text-[12px] border cursor-pointer bg-transparent transition-opacity"
            :class="dialogueForm.text_effect === fx.value
              ? 'border-brand-purple opacity-100'
              : 'border-white/15 text-text-dim opacity-60 hover:opacity-90'"
            @click="dialogueForm.text_effect = dialogueForm.text_effect === fx.value ? null : fx.value">
            {{ fx.label }}
          </button>
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1.5">文字大小 <span class="text-text-dimmer">(默认跟随播放器字号, 可强制指定)</span></label>
        <div class="flex flex-wrap gap-2 items-center">
          <button type="button" v-for="sz in textSizeOptions" :key="sz.value"
            class="px-3 py-1.5 rounded-full text-[12px] border cursor-pointer bg-transparent transition-opacity"
            :class="dialogueForm.text_size === sz.value
              ? 'border-brand-purple opacity-100'
              : 'border-white/15 text-text-dim opacity-60 hover:opacity-90'"
            @click="dialogueForm.text_size = dialogueForm.text_size === sz.value ? null : sz.value">
            <span :class="sz.cls">{{ sz.label }}</span>
          </button>
        </div>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">说话人 <span class="text-text-dimmer">(选角色自动填充, 可手写改)</span></label>
        <input v-model="dialogueForm.speaker" placeholder="如: 林小雨" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">{{ dialogueForm.node_type === 'option' ? '提问文本 *（玩家看到的问句）' : '对白文本 *' }}</label>
        <textarea v-model="dialogueForm.text" rows="2" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
      </div>
      <div class="mb-[14px]">
        <label class="block text-xs text-text-dim mb-1">🌐 多语言文本</label>
        <div class="grid grid-cols-3 gap-2">
          <textarea v-model="dialogueForm.text_en" placeholder="English" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="dialogueForm.text_ja" placeholder="日本語" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
          <textarea v-model="dialogueForm.text_ko" placeholder="한국어" rows="2" class="px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple resize-y"></textarea>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-[14px]">
        <div>
          <label class="block text-xs text-text-dim mb-1">触发时间(秒) <span class="text-text-dimmer">(仅根节点有效)</span></label>
          <input v-model.number="dialogueForm.show_time" type="number" min="0" placeholder="视频第几秒出现" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label class="block text-xs text-text-dim mb-1">排序 <span class="text-text-dimmer">(同组内显示顺序)</span></label>
          <input v-model.number="dialogueForm.sort_order" type="number" class="w-full px-3 py-[9px] bg-surface-darkest border border-border-dim rounded-lg text-white text-[13px] outline-none focus:border-brand-purple" />
        </div>
      </div>

      <!-- 属性影响（仅选项节点：已保存的选项行内联编辑, 新建选项保存后再配） -->
      <div v-if="isChoiceNode" class="mb-[14px] border border-fuchsia-500/25 bg-fuchsia-500/5 rounded-lg p-3">
        <label class="block text-xs text-text-dim mb-1.5">📈 属性影响 <span class="text-text-dimmer">(玩家选中该选项时增减, 属性在 游戏属性 菜单定义)</span></label>
        <div v-if="!sceneAttributes.length" class="text-[11px] text-text-dimmest">
          该游戏还没有定义属性，请先到 后台 → 游戏属性 添加
        </div>
        <template v-else>
          <div class="space-y-2 mb-2">
            <div v-for="(row, i) in effectRows" :key="i" class="flex items-center gap-2">
              <select v-model="row.attr_id" class="picker flex-1">
                <option :value="null">— 选择属性 —</option>
                <option v-for="a in sceneAttributes" :key="a.id" :value="a.id">{{ a.name }} ({{ a.attr_key }})</option>
              </select>
              <input v-model.number="row.delta" type="number" placeholder="±N" class="picker w-24 text-center" />
              <span class="text-text-dimmer text-[11px] w-14 text-center">初始+{{ row.delta || 0 }}</span>
              <button class="d-btn-x" @click="effectRows.splice(i, 1)">✕</button>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button class="btn-sm-cyan" @click="effectRows.push({ attr_id: null, delta: 1 })">+ 添加影响</button>
            <span v-if="editingDialogueId === 0" class="text-[10px] text-text-dimmer">新建选项先保存, 再重新打开配置影响</span>
          </div>
        </template>
      </div>

      <!-- 属性门槛（仅选项节点): 玩家属性达到设定值才能选此项 -->
      <div v-if="isChoiceNode" class="mb-[14px] border border-amber-500/25 bg-amber-500/5 rounded-lg p-3">
        <label class="block text-xs text-text-dim mb-1.5">🔒 属性门槛 <span class="text-text-dimmer">(玩家属性达到设定值才能选此项, 不设置=无限制)</span></label>
        <div v-if="!sceneAttributes.length" class="text-[11px] text-text-dimmest">
          该游戏还没有定义属性
        </div>
        <div v-else class="flex items-center gap-2">
          <select v-model="dialogueForm.min_attr_id" class="picker flex-1">
            <option :value="null">无门槛</option>
            <option v-for="a in sceneAttributes" :key="a.id" :value="a.id">需 {{ a.name }} 达到…</option>
          </select>
          <input v-if="dialogueForm.min_attr_id" v-model.number="dialogueForm.min_value" type="number" min="0"
            placeholder="≥N" class="picker w-24 text-center" />
          <span v-if="dialogueForm.min_attr_id" class="text-text-dimmer text-[11px]">及以上可选</span>
        </div>
      </div>

      <template #actions>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-transparent border border-border-dim text-text-muted hover:text-white hover:border-brand-purple" @click="dialogueEditVisible = false">取消</button>
        <button class="inline-flex items-center gap-[5px] px-[18px] py-[9px] border-none rounded-lg text-[13px] cursor-pointer transition-all duration-200 bg-brand-purple text-white hover:bg-brand-purple-dark" @click="saveDialogue">保存</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import AppPagination from '../components/AppPagination.vue'
import AppModal from '../components/AppModal.vue'
import DialogueNode from '../components/DialogueNode.vue'

const { get, post, put, del } = useApi()
const { show } = useToast()

// Scene list
const scenes = ref([])
const page = ref(1)
const pageSize = ref(10)
const filterGameId = ref(null)
// 当前打开的场景弹窗所用的 game_id（编辑时取场景自身，新建时取 filterGameId）
const modalGameId = ref(null)
const games = ref([])

const pageScenes = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return scenes.value.slice(start, start + pageSize.value)
})

function onPageChange(p, ps) {
  page.value = p
  pageSize.value = ps
}

// Scene Edit Modal
const sceneModalVisible = ref(false)
const editingSceneId = ref(0)
const sceneForm = ref(getEmptySceneForm())
const videoList = ref([])
const endingList = ref([])

function getEmptySceneForm() {
  return {
    title: '', description: '', video_id: null, chapter: '',
    game_id: null,
    is_start: false, is_ending: false, ending_id: null,
    choice_timer: 10, choice_delay: 0,
    title_en: '', title_ja: '', title_ko: '',
    desc_en: '', desc_ja: '', desc_ko: ''
  }
}

// 按指定 game_id 加载视频列表（game_id 改变时调用）
async function loadVideosByGame(gameId) {
  try {
    const params = { limit: 200 }
    if (gameId) params.game_id = gameId
    const r = await get('/videos', params)
    videoList.value = r.videos || []
    if (!gameId) {
      show('提示：未归属游戏，视频列表包含全部视频，请确认引用正确')
    }
  } catch (e) {}
}

// 记录当前生效的 game_id（用于 @change 确认/取消时恢复）
let lastSceneGameId = null

// 场景表单 game_id 改变时：若已有视频关联，弹确认框，确认后清空 video_id 并重新加载视频列表
async function onSceneGameIdChange() {
  const newGameId = sceneForm.value.game_id || null

  // game_id 没变化，直接返回
  if (newGameId === lastSceneGameId) return

  // 若已关联视频，切换游戏会导致原视频被清除，需用户确认
  if (sceneForm.value.video_id) {
    const ok = confirm('修改归属游戏将清除当前关联的视频，确定要切换吗？')
    if (!ok) {
      // 取消：恢复 game_id 为原值
      sceneForm.value.game_id = lastSceneGameId
      return
    }
    // 确认：清除 video_id
    sceneForm.value.video_id = null
    show('已清除原关联视频，请重新选择')
  }

  lastSceneGameId = newGameId
  modalGameId.value = newGameId
  await loadVideosByGame(newGameId)
}

async function openSceneModal(id) {
  editingSceneId.value = id
  let sceneGameId = null
  if (id > 0) {
    try {
      const r = await get('/scenes/' + id)
      const s = r.scene || {}
      sceneGameId = s.game_id || null
      let i18n = {}, descI18n = {}
      try { i18n = JSON.parse(s.title_i18n || '{}') } catch {}
      try { descI18n = JSON.parse(s.description_i18n || '{}') } catch {}
      sceneForm.value = {
        title: s.title || '',
        description: s.description || '',
        video_id: s.video_id || null,
        chapter: s.chapter || '',
        game_id: s.game_id || null,
        is_start: !!s.is_start,
        is_ending: !!s.is_ending,
        ending_id: s.ending_id || null,
        choice_timer: s.choice_timer ?? 10,
        choice_delay: s.choice_delay ?? 0,
        title_en: i18n.en || '',
        title_ja: i18n.ja || '',
        title_ko: i18n.ko || '',
        desc_en: descI18n.en || '',
        desc_ja: descI18n.ja || '',
        desc_ko: descI18n.ko || ''
      }
    } catch (e) {
      show('加载场景失败')
      return
    }
  } else {
    sceneForm.value = getEmptySceneForm()
    sceneGameId = filterGameId.value || null
    sceneForm.value.game_id = sceneGameId
  }
  modalGameId.value = sceneGameId
  // 记录初始 game_id，供 onSceneGameIdChange 确认/取消时比对恢复
  lastSceneGameId = sceneGameId

  // 加载视频列表 + 结局列表
  await loadVideosByGame(sceneGameId)
  try { const r = await get('/endings'); endingList.value = r.endings || [] } catch (e) {}

  sceneModalVisible.value = true
}

async function saveScene() {
  const data = {
    title: sceneForm.value.title,
    description: sceneForm.value.description,
    video_id: sceneForm.value.video_id ? parseInt(sceneForm.value.video_id) : null,
    chapter: sceneForm.value.chapter,
    game_id: sceneForm.value.game_id || null,
    is_start: sceneForm.value.is_start,
    is_ending: sceneForm.value.is_ending,
    ending_id: sceneForm.value.ending_id ? parseInt(sceneForm.value.ending_id) : null,
    choice_timer: parseInt(sceneForm.value.choice_timer) || 10,
    choice_delay: parseInt(sceneForm.value.choice_delay) || 0
  }

  // 构建多语言 JSON
  const i18n = {}
  if (sceneForm.value.title_en) i18n.en = sceneForm.value.title_en
  if (sceneForm.value.title_ja) i18n.ja = sceneForm.value.title_ja
  if (sceneForm.value.title_ko) i18n.ko = sceneForm.value.title_ko
  if (Object.keys(i18n).length > 0) data.title_i18n = JSON.stringify(i18n)
  else data.title_i18n = null

  const descI18n = {}
  if (sceneForm.value.desc_en) descI18n.en = sceneForm.value.desc_en
  if (sceneForm.value.desc_ja) descI18n.ja = sceneForm.value.desc_ja
  if (sceneForm.value.desc_ko) descI18n.ko = sceneForm.value.desc_ko
  if (Object.keys(descI18n).length > 0) data.description_i18n = JSON.stringify(descI18n)
  else data.description_i18n = null

  if (!data.title || !data.video_id) return show('请填写标题和选择视频')

  try {
    if (editingSceneId.value > 0) {
      await put('/scenes/' + editingSceneId.value, data)
    } else {
      await post('/scenes', data)
    }
    show(editingSceneId.value > 0 ? '更新成功' : '创建成功')
    sceneModalVisible.value = false
    loadScenes()
  } catch (e) {
    show(e.message)
  }
}

async function deleteScene(id) {
  if (!confirm('确定删除此场景及所有选项?')) return
  try {
    await del('/scenes/' + id)
    show('已删除')
    loadScenes()
  } catch (e) {
    show('删除失败: ' + e.message)
  }
}

// Choices Modal
const choicesModalVisible = ref(false)
const choicesSceneId = ref(0)
const choicesSceneTitle = ref('')
const choices = ref([])
const allScenes = ref([])
const themes = ref([])  // 选项主题列表

async function loadThemes() {
  try { const r = await get('/themes'); themes.value = r.themes || [] } catch (e) {}
}

// 选中主题的 style_config（选项编辑弹窗预览用）
const selectedThemeCfg = computed(() => {
  const t = themes.value.find(t => t.id === choiceForm.value.theme_id)
  return t?.style_config || null
})

// 主题样式 → CSS 变量（与 GamePlayer.vue themeVars 同步）
const previewVars = computed(() => {
  const cfg = selectedThemeCfg.value
  if (!cfg) return {}
  const v = {}
  if (cfg.button_bg) v['--choice-bg'] = cfg.button_bg
  if (cfg.button_border) v['--choice-border'] = cfg.button_border
  if (cfg.button_text) v['--choice-text'] = cfg.button_text
  if (cfg.hover_bg) v['--choice-hover-bg'] = cfg.hover_bg
  if (cfg.hover_border) v['--choice-hover-border'] = cfg.hover_border
  if (cfg.number_color) v['--choice-number'] = cfg.number_color
  if (cfg.cost_bg) v['--choice-cost-bg'] = cfg.cost_bg
  if (cfg.cost_text) v['--choice-cost-text'] = cfg.cost_text
  if (cfg.cost_border) v['--choice-cost-border'] = cfg.cost_border
  if (cfg.radius) v['--choice-radius'] = cfg.radius
  return v
})

async function openChoicesModal(sceneId) {
  choicesSceneId.value = sceneId
  try {
    const [sr, cr] = await Promise.all([
      get('/scenes/' + sceneId),
      get('/choices/scene/' + sceneId)
    ])
    choicesSceneTitle.value = sr.scene?.title || ''
    choices.value = cr.choices || []
    // 同步场景列表中的选项计数与直接跳转标记（新增/删除/编辑选项后无需刷新整页）
    const sceneRow = scenes.value.find(s => s.id === sceneId)
    if (sceneRow) {
      sceneRow.choice_count = choices.value.length
      sceneRow.auto_jump_count = choices.value.filter(c => c.is_auto_jump).length
    }
    // 按当前场景的 game_id 过滤跳转场景列表，避免跨游戏引用
    const sceneGameId = sr.scene?.game_id || null
    const params = {}
    if (sceneGameId) params.game_id = sceneGameId
    allScenes.value = await get('/scenes', params).then(r => r.scenes || []).catch(() => [])
    if (!sceneGameId) {
      show('提示：该场景未归属游戏，跳转场景列表包含全部场景，请确认引用正确')
    }
    // 主题列表（选项级主题选择）
    if (!themes.value.length) loadThemes()
  } catch (e) {
    show('加载选项失败')
    return
  }
  choicesModalVisible.value = true
}

// Choice Edit Modal
const choiceEditVisible = ref(false)
const editingChoiceId = ref(0)
const choiceForm = ref(getEmptyChoiceForm())

function getEmptyChoiceForm() {
  return {
    text: '', next_scene_id: null, sort_order: 0, timer_seconds: 0,
    point_cost: 0, theme_id: null, is_auto_jump: false,
    text_en: '', text_ja: '', text_ko: '',
    conditions: []
  }
}

function openChoiceEditModal(id) {
  editingChoiceId.value = id
  if (id > 0) {
    const found = choices.value.find(c => c.id === id)
    if (found) {
      let tI18n = {}
      try { tI18n = JSON.parse(found.text_i18n || '{}') } catch {}
      choiceForm.value = {
        text: found.text || '',
        next_scene_id: found.next_scene_id || null,
        sort_order: found.sort_order || 0,
        timer_seconds: found.timer_seconds || 0,
        point_cost: found.point_cost || 0,
        theme_id: found.theme_id || null,
        is_auto_jump: !!found.is_auto_jump,
        text_en: tI18n.en || '',
        text_ja: tI18n.ja || '',
        text_ko: tI18n.ko || '',
        conditions: found.conditions || []
      }
    } else {
      choiceForm.value = getEmptyChoiceForm()
    }
  } else {
    choiceForm.value = getEmptyChoiceForm()
  }
  choiceEditVisible.value = true
}

function addCondition() {
  choiceForm.value.conditions.push({
    character_id: null,
    operator: '>=',
    value: 0
  })
}

async function saveChoice() {
  const text = choiceForm.value.text
  if (!text) return show('请输入选项文本')

  const data = {
    scene_id: choicesSceneId.value,
    text,
    next_scene_id: choiceForm.value.next_scene_id ? parseInt(choiceForm.value.next_scene_id) : null,
    sort_order: parseInt(choiceForm.value.sort_order) || 0,
    timer_seconds: parseInt(choiceForm.value.timer_seconds) || 0,
    point_cost: parseInt(choiceForm.value.point_cost) || 0,
    theme_id: choiceForm.value.theme_id ? parseInt(choiceForm.value.theme_id) : null,
    is_auto_jump: choiceForm.value.is_auto_jump ? 1 : 0
  }

  const tI18n = {}
  if (choiceForm.value.text_en) tI18n.en = choiceForm.value.text_en
  if (choiceForm.value.text_ja) tI18n.ja = choiceForm.value.text_ja
  if (choiceForm.value.text_ko) tI18n.ko = choiceForm.value.text_ko
  if (Object.keys(tI18n).length > 0) data.text_i18n = JSON.stringify(tI18n)
  else data.text_i18n = null

  let choiceId = editingChoiceId.value
  try {
    if (choiceId > 0) {
      await put('/choices/' + choiceId, data)
    } else {
      const r = await post('/choices', data)
      if (r.error) return show(r.error)
      choiceId = r.choice.id
    }

    // Delete existing conditions, then re-create
    const existing = choices.value.find(c => c.id === choiceId)
    if (existing?.conditions) {
      for (let cd of existing.conditions) {
        try { await del('/choices/conditions/' + cd.id) } catch (e) { /* ignore */ }
      }
    }
    for (let cond of choiceForm.value.conditions) {
      if (cond.character_id) {
        await post('/choices/conditions', {
          target_type: 'choice',
          target_id: choiceId,
          character_id: parseInt(cond.character_id),
          operator: cond.operator,
          value: parseInt(cond.value) || 0
        })
      }
    }

    show('保存成功')
    choiceEditVisible.value = false
    openChoicesModal(choicesSceneId.value)
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteChoiceItem(id) {
  if (!confirm('确定删除?')) return
  try {
    await del('/choices/' + id)
    show('已删除')
    openChoicesModal(choicesSceneId.value)
  } catch (e) {
    show('删除失败')
  }
}

async function loadScenes() {
  try {
    const params = { limit: 500 }
    if (filterGameId.value) params.game_id = filterGameId.value
    const r = await get('/scenes', params)
    scenes.value = r.scenes || []
  } catch (e) {
    show('加载场景失败: ' + e.message)
  }
}

// ========= Dialogues Modal (树状对白) =========
const dialoguesModalVisible = ref(false)
const dialoguesSceneId = ref(0)
const dialoguesSceneTitle = ref('')
const dialogues = ref([])  // 平铺原始数据

// 树状视图：真正的任意深度递归树（children 嵌套 children，由 DialogueNode 递归渲染）
const dialogueTree = computed(() => {
  const childrenOf = new Map()
  for (const d of dialogues.value) {
    const key = d.parent_id || 0
    if (!childrenOf.has(key)) childrenOf.set(key, [])
    childrenOf.get(key).push(d)
  }
  const build = (parentId, depth) =>
    (childrenOf.get(parentId) || []).map(d => ({
      ...d,
      depth,
      _isChoiceItem: depth > 0 && isChildOfOption(parentId),
      _parentIsOption: isChildOfOption(parentId),
      attr_effect_count: effectCounts.value[d.id] || 0,
      children: build(d.id, depth + 1)
    }))
  return build(0, 0)
})

// 选项节点的属性影响数（dialogue_id → count）
const effectCounts = ref({})

async function loadEffectCounts() {
  effectCounts.value = {}
  if (!dialoguesSceneId.value) return
  try {
    const r = await get('/game-attributes/scene-effects-count/' + dialoguesSceneId.value)
    if (r && r.counts) effectCounts.value = r.counts
  } catch (e) {}
}

// 判断父节点是否为 option 类型（子节点显示为"选项"样式）
function isChildOfOption(parentId) {
  const p = dialogues.value.find(d => d.id === parentId)
  return p ? p.node_type === 'option' : false
}

// ========= 属性影响（合并进对白编辑弹窗: 选项节点编辑时内联配置） =========
const sceneAttributes = ref([])         // 该游戏的属性定义
const effectRows = ref([])              // 当前编辑选项的影响 [{attr_id, delta}]

// 当前编辑的节点是不是"选项"（挂在提问下的 line 节点）——只有选项能配属性影响
const isChoiceNode = computed(() =>
  dialogueForm.value.node_type === 'line' && !!dialogueForm.value.parent_id
)

function attrPreviewValue(row) {
  const a = sceneAttributes.value.find(x => x.id === row.attr_id)
  return a ? (a.default_value + (parseInt(row.delta) || 0)) : '-'
}

async function loadSceneAttributes() {
  sceneAttributes.value = []
  if (!sceneGameIdCache) return
  try {
    const r = await get('/game-attributes/game/' + sceneGameIdCache)
    sceneAttributes.value = r.attributes || []
  } catch (e) {}
}

// 打开编辑弹窗时（已有节点）拉取已有影响
async function loadEffectRows(dialogueId) {
  effectRows.value = []
  if (!dialogueId) return
  try {
    const r = await get('/game-attributes/effects/' + dialogueId)
    effectRows.value = (r.effects || []).map(e => ({ attr_id: e.attr_id, delta: e.delta }))
  } catch (e) {}
}

async function saveEffects() {
  const effects = effectRows.value
    .filter(r => r.attr_id)
    .map(r => ({ attr_id: r.attr_id, delta: parseInt(r.delta) || 0 }))
  const ids = effects.map(e => e.attr_id)
  if (new Set(ids).size !== ids.length) { show('同一属性只能有一条影响'); return false }
  try {
    await put('/game-attributes/effects/' + editingDialogueId.value, { effects })
    return true
  } catch (e) {
    show('属性影响保存失败: ' + e.message)
    return false
  }
}

async function openDialoguesModal(sceneId) {
  dialoguesSceneId.value = sceneId
  try {
    const [sr, dr] = await Promise.all([
      get('/scenes/' + sceneId),
      get('/dialogues/scene/' + sceneId)
    ])
    dialoguesSceneTitle.value = sr.scene?.title || ''
    dialogues.value = dr.dialogues || []
    sceneGameIdCache = sr.scene?.game_id || null   // 对白库快选用
  } catch (e) {
    show('加载对白失败')
    return
  }
  dialoguesModalVisible.value = true
  preloadLibrary()
  loadEffectCounts()
  loadSceneAttributes()
}

const dialogueEditVisible = ref(false)
const editingDialogueId = ref(0)
const dialogueForm = ref(getEmptyDialogueForm())

function getEmptyDialogueForm() {
  return {
    parent_id: null, node_type: 'line', character_id: null, expression: null, text_effect: null, text_size: null, speaker: '', text: '',
    text_en: '', text_ja: '', text_ko: '',
    show_time: 0, duration: 0, sort_order: 0,
    min_attr_id: null, min_value: 0
  }
}

// 文字特效选项（与后端 routes/dialogues.js 白名单保持一致）
const textEffectOptions = [
  { value: 'angry', label: '😠 愤怒' },
  { value: 'shock', label: '⚡ 震惊' },
  { value: 'sad', label: '💧 悲伤' },
  { value: 'happy', label: '✨ 开心' },
  { value: 'whisper', label: '🤫 低语' },
]

// 文字大小选项（与后端白名单一致; cls=按钮预览字号 Tailwind 类）
const textSizeOptions = [
  { value: 'small', label: '小', cls: 'text-[11px]' },
  { value: 'medium', label: '中', cls: 'text-[14px]' },
  { value: 'large', label: '大', cls: 'text-[18px]' },
  { value: 'xlarge', label: '特大', cls: 'text-[24px]' },
]

// 当前编辑角色可用的表情列表（决定表情下拉是否显示与选项）
const dialogueExpressions = computed(() => {
  const ch = sceneCharacters.value.find(c => c.id === dialogueForm.value.character_id)
  return ch?.expressions || []
})

function openDialogueEditModal(id, parentId = null, nodeType = 'line') {
  editingDialogueId.value = id
  effectRows.value = []
  if (id > 0) {
    const found = dialogues.value.find(d => d.id === id)
    if (found) {
      let tI18n = {}
      try { tI18n = JSON.parse(found.text_i18n || '{}') } catch {}
      dialogueForm.value = {
        parent_id: found.parent_id || null,
        node_type: found.node_type || 'line',
        character_id: found.character_id || null,
        expression: found.expression || null,
        text_effect: found.text_effect || null,
        text_size: found.text_size || null,
        speaker: found.speaker || '',
        text: found.text || '',
        text_en: tI18n.en || '', text_ja: tI18n.ja || '', text_ko: tI18n.ko || '',
        show_time: found.show_time ?? 0,
        duration: found.duration || 0,
        sort_order: found.sort_order || 0,
        min_attr_id: found.min_attr_id || null,
        min_value: found.min_value || 0
      }
      // 选项节点 → 顺带拉取已有属性影响（内联展示在编辑弹窗里）
      if (isChoiceNode.value) loadEffectRows(id)
    }
  } else {
    dialogueForm.value = getEmptyDialogueForm()
    dialogueForm.value.parent_id = parentId
    dialogueForm.value.node_type = nodeType
  }
  dialogueEditVisible.value = true
}

async function saveDialogue() {
  if (!dialogueForm.value.text) return show('请输入文本')
  const data = {
    scene_id: dialoguesSceneId.value,
    parent_id: dialogueForm.value.parent_id || null,
    node_type: dialogueForm.value.node_type,
    character_id: dialogueForm.value.character_id || null,
    expression: dialogueForm.value.character_id ? (dialogueForm.value.expression || null) : null,
    text_effect: dialogueForm.value.text_effect || null,
    text_size: dialogueForm.value.text_size || null,
    speaker: dialogueForm.value.speaker || null,
    text: dialogueForm.value.text,
    show_time: parseInt(dialogueForm.value.show_time) || 0,
    sort_order: parseInt(dialogueForm.value.sort_order) || 0,
    min_attr_id: dialogueForm.value.min_attr_id || null,
    min_value: dialogueForm.value.min_attr_id ? (parseInt(dialogueForm.value.min_value) || 0) : 0
  }
  const tI18n = {}
  if (dialogueForm.value.text_en) tI18n.en = dialogueForm.value.text_en
  if (dialogueForm.value.text_ja) tI18n.ja = dialogueForm.value.text_ja
  if (dialogueForm.value.text_ko) tI18n.ko = dialogueForm.value.text_ko
  if (Object.keys(tI18n).length > 0) data.text_i18n = JSON.stringify(tI18n)
  else data.text_i18n = null

  try {
    let savedId = editingDialogueId.value
    if (savedId > 0) {
      await put('/dialogues/' + savedId, data)
    } else {
      const r = await post('/dialogues', data)
      // 新建节点：后端返回 dialogue.id，后续就能直接保存属性影响
      savedId = r?.dialogue?.id || 0
      if (savedId) editingDialogueId.value = savedId
    }
    // 选项节点：对白保存成功后一并保存属性影响
    // （新建场景：POST /dialogues 已返回新 id，可直接挂影响；仅当无 id 时才需重开）
    if (isChoiceNode.value && savedId > 0 && sceneAttributes.value.length && effectRows.value.some(r => r.attr_id)) {
      const ok = await saveEffects()
      if (!ok) show('对白已保存，但属性影响未保存——请重新打开该选项检查')
    }
    show('保存成功')
    dialogueEditVisible.value = false
    openDialoguesModal(dialoguesSceneId.value)
  } catch (e) {
    show('保存失败: ' + e.message)
  }
}

async function deleteDialogueItem(id) {
  if (!confirm('删除该对白及其所有子对白?')) return
  try {
    await del('/dialogues/' + id)
    show('已删除')
    openDialoguesModal(dialoguesSceneId.value)
  } catch (e) {
    show('删除失败')
  }
}

// ========= 对白库快选（平铺素材池） =========
const libItems = ref([])          // 场景所属游戏的库条目
let sceneGameIdCache = null       // 打开对白弹窗时缓存场景的 game_id
const sceneCharacters = ref([])   // 场景所属游戏的角色列表（编辑弹窗下拉用）

// 库快选条目：按当前表单节点类型过滤（对白↔提问 对应），按类型匹配后始终都提供参考
const filteredLibItems = computed(() => {
  const wantType = dialogueForm.value.node_type === 'option' ? 'option' : 'line'
  const matched = libItems.value.filter(d => d.node_type === wantType)
  // 类型匹配的排前面，其他类型放后面灰显参考（仍可点，会切换类型）
  const others = libItems.value.filter(d => d.node_type !== wantType)
  return [...matched, ...others]
})

// 弹窗打开时按场景 game_id 预载库 + 角色（失败静默，不影响手工填写）
async function preloadLibrary() {
  libItems.value = []
  sceneCharacters.value = []
  try {
    if (!sceneGameIdCache) return
    const [lr, cr] = await Promise.all([
      get('/dialogue-library/game/' + sceneGameIdCache),
      get('/characters/game/' + sceneGameIdCache)
    ])
    libItems.value = lr.dialogues || []
    sceneCharacters.value = cr.characters || []
  } catch (e) {}
}

// 对白编辑表单：选角色 → 说话人自动填角色名 + 重置表情（表情列表随角色变化）
function onDialogueCharChange() {
  dialogueForm.value.expression = null
  if (dialogueForm.value.character_id) {
    const ch = sceneCharacters.value.find(c => c.id === dialogueForm.value.character_id)
    if (ch) dialogueForm.value.speaker = ch.name
  }
}

// 点选库素材 → 填充表单（含多语言/说话人；根节点带建议触发时间）
function applyLibItem(lib) {
  if (editingDialogueId.value > 0) return
  let tI18n = {}
  try { tI18n = JSON.parse(lib.text_i18n || '{}') } catch {}
  dialogueForm.value.node_type = lib.node_type
  dialogueForm.value.character_id = lib.character_id || null
  dialogueForm.value.speaker = lib.speaker || ''
  dialogueForm.value.text = lib.text
  dialogueForm.value.text_en = tI18n.en || ''
  dialogueForm.value.text_ja = tI18n.ja || ''
  dialogueForm.value.text_ko = tI18n.ko || ''
  // 仅根节点用建议触发时间
  if (!dialogueForm.value.parent_id && lib.show_time) {
    dialogueForm.value.show_time = lib.show_time
  }
}

async function loadGames() {
  try { const r = await get('/games'); games.value = r.games || []; } catch {}
}

onMounted(() => { loadScenes(); loadGames(); })
</script>

<style scoped>
@reference "../style.css";
/* 选项主题预览（与 GamePlayer.vue 的选项框主题样式保持一致，CSS 变量驱动） */
.choice-btn {
  background: var(--choice-bg, rgba(0, 0, 0, 0.55));
  border-color: var(--choice-border, rgba(255, 255, 255, 0.15));
  color: var(--choice-text, #ffffff);
  border-radius: var(--choice-radius, 8px);
  border-style: solid;
  border-width: 1px;
}
.choice-btn:hover {
  background: var(--choice-hover-bg, rgba(139, 92, 246, 0.4));
  border-color: var(--choice-hover-border, #8b5cf6);
}
.choice-number {
  color: var(--choice-number, #9ca3af);
}
.choice-cost {
  background: var(--choice-cost-bg, rgba(251, 191, 36, 0.15));
  color: var(--choice-cost-text, #fbbf24);
  border-color: var(--choice-cost-border, rgba(251, 191, 36, 0.3));
  border-style: solid;
  border-width: 1px;
}
.d-btn-x {
  @apply inline-flex items-center justify-center w-7 h-7 border-none rounded-md text-[12px] cursor-pointer bg-white/5 text-text-dim hover:bg-red-600 hover:text-white transition-all duration-200;
}
.btn-sm-cyan {
  @apply inline-flex items-center gap-[4px] px-3 py-1.5 border-none rounded-md text-[12px] cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700 transition-all duration-200;
}
</style>
