<template>
  <div
    ref="rootEl"
    class="h-player fixed inset-0 flex flex-col bg-black select-none overflow-hidden overscroll-none"
    :class="controlsVisible ? '' : 'cursor-none'"
    @mousemove="revealControls"
    @touchstart.passive="revealControls"
    @click="revealControls"
  >
    <video
      ref="videoEl"
      class="absolute inset-0 z-0 h-full w-full object-contain bg-black"
      playsinline
      preload="auto"
      :loop="isLooping"
      @click="togglePlay"
    ></video>

    <!-- ═══ 顶栏：返回 + 场景标题 + 菜单 ═══ -->
    <div class="relative z-20 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 pt-[env(safe-area-inset-top)] pb-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'">
      <div class="relative shrink-0">
        <button @click="showBackMenu = !showBackMenu"
          class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-colors text-white"
          title="返回">
          <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div v-if="showBackMenu" class="fixed inset-0 z-40" @click="showBackMenu = false"></div>
        <div v-if="showBackMenu" class="absolute top-full left-0 mt-2 w-52 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl">
          <button @click="onBacktrack"
            class="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-subtle hover:bg-brand-purple/20 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
            :disabled="!game.sceneHistory.length || backtracking">
            <span>↩ 返回上一场景</span>
            <span class="ml-auto text-xs shrink-0" :class="backtrackCost > 0 ? 'text-amber-400' : 'text-green-400'">
              {{ backtracking ? '处理中...' : (backtrackCost > 0 ? '💎' + backtrackCost : '免费') }}
            </span>
          </button>
          <button @click="onReturnToLobby()"
            class="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-subtle hover:bg-brand-purple/20 hover:text-white transition-colors border-t border-border-dim">
            🏠 返回大厅
          </button>
        </div>
      </div>
      <span v-if="game.currentScene" class="flex-1 min-w-0 truncate text-sm text-white/70">{{ game.currentScene.title }}</span>
    </div>

    <!-- ═══ 中间区：缓冲 + 大播放按钮 ═══ -->
    <div class="relative z-10 flex-1 min-h-0 flex items-center justify-center pointer-events-none">
      <div v-if="isBuffering" class="w-12 h-12 border-4 border-white/20 border-t-brand-purple rounded-full animate-spin"></div>
      <div v-else-if="!isPlaying && !choicesActive"
        class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full bg-black/50 border border-white/25 text-white">
        <svg viewBox="0 0 24 24" class="w-8 h-8 sm:w-10 sm:h-10 ml-1" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>

    <!-- ═══ 选项弹窗（无遮罩无模糊，选项直接悬浮，主题样式驱动） ═══ -->
    <div v-if="choicesActive" class="absolute inset-0 z-30 flex items-center justify-center">
      <!-- 容器注入游戏级主题变量；单个选项有独立主题时在按钮上覆盖 -->
      <div class="w-[90%] max-w-md flex flex-col gap-2" :style="themeVars">
        <button v-for="(c, i) in currentChoices" :key="c.id"
          @click="onChoose(c.id)"
          :style="choiceVars(c)"
          class="choice-btn flex items-center justify-between gap-3 px-4 py-3 text-left text-sm border transition-colors">
          <span class="min-w-0"><span class="choice-number mr-2">{{ i + 1 }}.</span>{{ c.text }}</span>
          <span v-if="c.paid"
            class="choice-badge choice-paid shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs">✓ 已购买</span>
          <span v-else-if="c.point_cost > 0"
            class="choice-badge choice-cost shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs">💎 {{ c.point_cost }}</span>
        </button>
      </div>
    </div>

    <!-- ═══ 对白层（立绘+名牌对话框；line=点击逐条推进；option=弹出候选项点选；显示期间暂停视频） ═══ -->
    <div v-if="activeDialogueNode" class="absolute inset-0 z-30" @click.stop="advanceDialogue">
      <!-- 对白面板：人物立绘从对话框左后方升起, 底边与框底齐平, 与框体连成一体(无分隔) -->
      <div class="dlg-panel">
        <div class="relative w-full max-w-2xl">
          <img v-if="activeCharAvatar" :key="'dlgfig-' + (activeDialogueNode.character_id || 0)"
            :src="activeCharAvatar"
            class="dlg-figure" />
          <!-- 说话人名牌（框左上角, 角色主题色渐变, 无主题色时金色兜底） -->
          <div v-if="activeDialogueNode.speaker" class="dlg-nameplate" :style="nameplateVars">{{ activeDialogueNode.speaker }}</div>
          <!-- 普通对白（有名牌时正文让出顶部空间） -->
          <div v-if="activeDialogueNode.node_type !== 'option'"
            class="dlg-box bg-black/75 border border-white/15 px-4 py-3 backdrop-blur-sm shadow-xl"
            :class="activeDialogueNode.speaker ? 'rounded-xl pt-[2.9rem]' : 'rounded-xl'">
            <span class="block leading-relaxed whitespace-pre-wrap"
              :class="[textEffectClass, textSizeClass]">{{ activeDialogueNode?.text }}</span>
            <svg viewBox="0 0 24 24" class="dlg-next-arrow absolute right-2.5 bottom-1.5 w-5 h-5 text-amber-400" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <!-- 对白选项（提问）：子节点作为候选项按钮 -->
          <div v-else
            class="dlg-box bg-black/75 border border-white/15 px-4 py-3 backdrop-blur-sm shadow-xl"
            :class="activeDialogueNode.speaker ? 'rounded-xl pt-[2.9rem]' : 'rounded-xl'">
            <span class="block text-sm sm:text-base text-white leading-relaxed whitespace-pre-wrap mb-2">{{ activeDialogueNode.text }}</span>
            <div class="flex flex-col gap-1.5">
              <button v-for="opt in activeDialogueOptions" :key="opt.id"
                class="text-left px-3 py-2 rounded-lg border transition-colors text-sm"
                :class="optionGated(opt)
                  ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                  : optionLocked(opt)
                    ? 'bg-white/5 border-white/10 text-white/35 cursor-not-allowed'
                    : opt.id === recordedChoiceId
                      ? 'bg-brand-purple/25 border-brand-purple/50 text-white'
                      : 'bg-white/10 border-white/15 hover:bg-brand-purple/30 hover:border-brand-purple text-white'"
                :disabled="optionGated(opt) || optionLocked(opt)"
                @click.stop="optionGated(opt) || optionLocked(opt) ? null : pickDialogueOption(opt.id)">
                <div class="flex items-center gap-2">
                  <span class="min-w-0 flex-1">{{ opt.text }}</span>
                  <!-- 上次已选标记（场景对白选项记忆） -->
                  <span v-if="opt.id === recordedChoiceId"
                    class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border bg-brand-purple/20 border-brand-purple/40 text-purple-200">✓ 已选</span>
                  <!-- 属性门槛标记：未达标显示锁 -->
                  <span v-if="optionGated(opt)"
                    class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border bg-amber-500/10 border-amber-400/30 text-amber-300">
                    🔒 {{ gateAttrName(opt.min_attr_id) }} 需 {{ opt.min_value }}（当前 {{ gateAttrValue(opt.min_attr_id) }}）
                  </span>
                  <!-- 属性影响标记 +N / -N -->
                  <span v-for="eff in dialogueOptionEffects(opt.id)" :key="eff.attr_id"
                    class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border"
                    :class="eff.delta >= 0
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : 'bg-red-500/15 border-red-400/30 text-red-300'">
                    {{ eff.attr_name }} {{ eff.delta >= 0 ? '+' : '' }}{{ eff.delta }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 属性面板（左上角横向并排, 紧凑单行, 有自定义属性时显示） ═══ -->
    <div v-if="game.gameAttributes.length"
      class="absolute top-16 left-3 z-20 flex flex-row flex-wrap items-center gap-1 max-w-[60vw] pointer-events-none">
      <div v-for="attr in game.gameAttributes" :key="attr.id"
        class="flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-white/10 rounded px-1.5 py-0.5">
        <span class="text-[10px] leading-none text-white/60">{{ attr.name }}</span>
        <span class="text-[11px] leading-none font-bold text-white tabular-nums">{{ attr.value }}</span>
      </div>
    </div>

    <!-- ═══ 属性变化飘字（选项结算反馈, 在属性行下方避免遮挡） ═══ -->
    <div class="absolute z-30 pointer-events-none"
      :style="{ top: attrFloatTop, left: '0.75rem' }">
      <div v-for="a in game.attrChangeAnims" :key="a.id"
        class="attr-float flex items-center gap-1.5 bg-black/70 border border-white/20 rounded-full px-2 py-0.5 mb-1"
        :class="a.delta >= 0 ? 'border-emerald-400/40' : 'border-red-400/40'">
        <span class="text-[10px] text-white/80">{{ a.name }}</span>
        <span class="text-[12px] font-bold tabular-nums"
          :class="a.delta >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ a.delta >= 0 ? '+' : '' }}{{ a.delta }}</span>
      </div>
    </div>

    <!-- ═══ 底部容器 ═══ -->
    <div v-show="!choicesActive" class="relative z-20 shrink-0">
      <!-- 字幕显示区（在进度条上方） -->
      <div class="px-4 pb-2 min-h-[2rem] flex justify-center items-end">
        <div v-if="subtitleText"
             class="hl-subtitle pointer-events-none max-w-[90%] text-center whitespace-pre-wrap bg-black/75 text-white px-3 py-1 rounded-md leading-relaxed text-sm sm:text-base [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{{ subtitleText }}</div>
      </div>

      <!-- 控制栏 -->
      <div class="px-3 sm:px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-gradient-to-t from-black/85 via-black/60 to-transparent transition-opacity duration-300"
        :class="controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'">
        <!-- 进度条：鼠标/手指移到附近才浮现（桌面 hover 触发 + 移动端控制栏出现即显示） -->
        <div
          class="group/bar relative h-6 flex items-center cursor-pointer select-none mb-0.5 transition-opacity duration-200"
          :class="progressBarVisible ? 'opacity-100' : 'opacity-0'"
          @mouseenter="progressHover = true"
          @mouseleave="progressHover = false"
          @touchstart.passive="progressHover = true"
          @touchend.passive="touchLeaveProgress"
          @click.stop
        >
          <!-- 轨道 -->
          <div class="relative w-full h-[4px] group-hover/bar:h-[6px] transition-all duration-150 rounded-full bg-white/20 overflow-hidden"
            @click.stop="onProgressClick">
            <!-- 已播放 -->
            <div class="absolute inset-y-0 left-0 bg-brand-purple rounded-full"
              :style="{ width: progressPercent + '%' }"></div>
            <!-- 缓冲 -->
            <div v-if="bufferedPercent > progressPercent" class="absolute inset-y-0 left-0 bg-white/25 rounded-full"
              :style="{ width: bufferedPercent + '%' }"></div>
          </div>
          <!-- 拖拽手柄（hover 加大） -->
          <div class="absolute w-3.5 h-3.5 rounded-full bg-brand-purple shadow-lg pointer-events-none transition-transform duration-150"
            :class="progressHover ? 'scale-125' : 'scale-100'"
            :style="{ left: 'calc(' + progressPercent + '% - 7px)' }"></div>
          <!-- 时间提示（拖拽/hover 时显示） -->
          <div v-if="progressHover && videoDuration"
            class="absolute -top-6 px-1.5 py-0.5 rounded bg-black/85 text-white text-[10px] tabular-nums pointer-events-none whitespace-nowrap"
            :style="{ left: 'calc(' + progressPercent + '% - 24px)' }">
            {{ formatTime(videoCurrentTime) }} / {{ formatTime(videoDuration) }}
          </div>
        </div>

        <!-- 按钮行 -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- 播放/暂停 -->
          <button @click="togglePlay"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0">
            <svg v-if="isPlaying" viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4 ml-0.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>

          <!-- 重播（重新开始当前场景） -->
          <button @click="replayScene"
            class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0"
            title="重播">
            <svg viewBox="0 0 24 24" class="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>

          <!-- 循环（仅桌面端直接显示，移动端收纳到更多） -->
          <button v-if="!isMobile" @click="toggleLoop"
            class="w-9 h-9 flex items-center justify-center rounded-full transition-colors text-white shrink-0"
            :class="isLooping ? 'bg-brand-purple/30 text-brand-purple' : 'bg-white/15 hover:bg-white/30'"
            title="循环播放">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
          </button>

          <!-- 倍速（仅桌面端直接显示） -->
          <div v-if="!isMobile" class="relative shrink-0">
            <button @click="showSpeedMenu = !showSpeedMenu"
              class="h-9 px-3 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors text-white text-xs">
              {{ playbackRate }}x
            </button>
            <div v-if="showSpeedMenu" class="fixed inset-0 z-40" @click="showSpeedMenu = false"></div>
            <div v-if="showSpeedMenu" class="absolute bottom-full left-0 mb-2 w-24 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl max-h-[70vh] overflow-y-auto">
              <button v-for="r in [0.5, 0.75, 1, 1.5, 2]" :key="r" @click="setSpeed(r)"
                class="flex w-full items-center justify-center py-2 text-sm transition-colors"
                :class="playbackRate === r ? 'bg-brand-purple/25 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">{{ r }}x</button>
            </div>
          </div>

          <!-- 音轨（仅桌面端直接显示） -->
          <div v-if="!isMobile" class="flex items-center gap-1.5 shrink-0 ml-1">
            <label class="text-xs text-text-dim">音轨</label>
            <select v-model="audioTrackId" @change="onAudioTrackChange"
              class="bg-surface-darkest border border-border-dim rounded-lg text-white text-xs px-2 py-1.5 outline-none focus:border-brand-purple">
              <option v-for="t in audioTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
            </select>
          </div>

          <!-- 字幕（仅桌面端直接显示） -->
          <div v-if="!isMobile" class="flex items-center gap-1.5 shrink-0">
            <label class="text-xs text-text-dim">字幕</label>
            <select v-model="subtitleId" @change="onSubtitleChange"
              class="bg-surface-darkest border border-border-dim rounded-lg text-white text-xs px-2 py-1.5 outline-none focus:border-brand-purple">
              <option :value="-1">关闭</option>
              <option v-for="t in subtitleTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
            </select>
          </div>

          <!-- 更多（移动端：收纳循环/倍速/音轨/字幕） -->
          <div v-if="isMobile" class="relative shrink-0">
            <button @click="showMoreMenu = !showMoreMenu"
              class="w-11 h-11 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white">
              <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div v-if="showMoreMenu" class="fixed inset-0 z-40" @click="showMoreMenu = false"></div>
            <div v-if="showMoreMenu" class="absolute bottom-full left-0 mb-2 w-52 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              <!-- 循环 -->
              <button @click="toggleLoop"
                class="flex w-full items-center justify-between px-2 py-2 text-sm rounded-lg transition-colors"
                :class="isLooping ? 'bg-brand-purple/25 text-white' : 'text-text-dim hover:bg-white/10 hover:text-white'">
                <span>循环播放</span>
                <span class="text-xs">{{ isLooping ? '开' : '关' }}</span>
              </button>
              <!-- 倍速 -->
              <div>
                <div class="px-2 pb-1 text-xs text-text-dimmer">倍速</div>
                <div class="flex gap-1">
                  <button v-for="r in [0.5, 0.75, 1, 1.5, 2]" :key="r" @click="setSpeed(r)"
                    class="flex-1 py-2 px-0.5 rounded-lg text-xs transition-colors"
                    :class="playbackRate === r ? 'bg-brand-purple/25 text-white' : 'bg-white/10 text-text-dim hover:bg-white/20 hover:text-white'">{{ r }}x</button>
                </div>
              </div>
              <!-- 音轨 -->
              <div>
                <div class="px-2 pb-1 text-xs text-text-dimmer">音轨</div>
                <select v-model="audioTrackId" @change="onAudioTrackChange"
                  class="w-full bg-surface-darkest border border-border-dim rounded-lg text-white text-sm px-2 py-2 outline-none focus:border-brand-purple">
                  <option v-for="t in audioTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
                </select>
              </div>
              <!-- 字幕 -->
              <div>
                <div class="px-2 pb-1 text-xs text-text-dimmer">字幕</div>
                <select v-model="subtitleId" @change="onSubtitleChange"
                  class="w-full bg-surface-darkest border border-border-dim rounded-lg text-white text-sm px-2 py-2 outline-none focus:border-brand-purple">
                  <option :value="-1">关闭</option>
                  <option v-for="t in subtitleTracks" :key="t.id" :value="t.id">{{ t.name || t.lang || ('#' + t.id) }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 道具（所有设备显示，面板向上弹出） -->
          <div class="relative shrink-0">
            <button @click="showPropPanel = !showPropPanel"
              class="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white"
              title="道具">
              🎁
            </button>
            <div v-if="showPropPanel" class="fixed inset-0 z-40" @click="showPropPanel = false"></div>
            <div v-if="showPropPanel" class="absolute bottom-full right-0 mb-2 bg-surface-card border border-border-dim rounded-xl overflow-hidden z-50 shadow-xl p-2 w-56 max-h-[70vh] overflow-y-auto">
              <div class="text-[11px] text-text-dimmer px-2 py-1">🎁 道具（使用扣除积分）</div>
              <!-- 效果道具组 -->
              <div v-if="effectProps.length">
                <div class="text-[10px] text-text-dimmest px-1 pt-1 pb-0.5 flex items-center gap-1">
                  <span>✨</span><span>效果</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5">
                  <button v-for="p in effectProps" :key="p.id" @click="useProp(p)"
                    class="flex flex-col items-center justify-center py-2 rounded-lg hover:bg-brand-purple/20 transition-colors border border-transparent hover:border-brand-purple/40"
                    :title="p.name">
                    <span class="text-xl leading-none">{{ p.icon }}</span>
                    <span class="text-[9px] text-text-dim mt-0.5">{{ p.point_cost > 0 ? '💎' + p.point_cost : '免费' }}</span>
                  </button>
                </div>
              </div>
              <!-- 幻想场景道具组 -->
              <div v-if="fantasyProps.length">
                <div class="text-[10px] text-brand-purple/80 px-1 pt-2 pb-0.5 flex items-center gap-1 border-t border-border-dim mt-1">
                  <span>🎬</span><span>幻想场景</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5">
                  <button v-for="p in fantasyProps" :key="p.id" @click="useProp(p)"
                    class="flex flex-col items-center justify-center py-2 rounded-lg hover:bg-brand-purple/20 transition-colors border border-brand-purple/30 bg-brand-purple/5"
                    :title="p.name + '（幻想场景）'">
                    <span class="text-xl leading-none">{{ p.icon }}</span>
                    <span class="text-[9px] text-brand-purple mt-0.5">{{ p.point_cost > 0 ? '💎' + p.point_cost : '免费' }}</span>
                  </button>
                </div>
              </div>
              <!-- 空状态 -->
              <div v-if="!effectProps.length && !fantasyProps.length" class="text-center py-6 text-[11px] text-text-dimmest">
                当前场景无可用道具
              </div>
            </div>
          </div>

          <!-- 跳过 + 全屏按钮（始终显示，靠右） -->
          <button @click="skipScene"
            class="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0 ml-auto"
            title="跳过">
            <svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-4 sm:h-4" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button @click="toggleFullscreen"
            class="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 transition-colors text-white shrink-0"
            title="全屏">
            <svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-4 sm:h-4" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ 效果动画层 ═══ -->
    <div class="absolute inset-0 z-40 pointer-events-none overflow-hidden" :class="{ 'effect-shake': effectShake }">
      <div v-for="a in effectAnims" :key="a.id" class="prop-particle"
        :class="{
          'prop-confetti': a.shape === 'confetti',
          'prop-shell': a.shape === 'shell',
          'prop-yolk': a.shape === 'yolk',
          'prop-flesh': a.shape === 'flesh'
        }"
        :style="{
          '--x': a.x + 'px', '--y': a.y + 'px',
          '--tx': a.tx + 'px', '--ty': a.ty + 'px',
          '--tx2': a.tx2 + 'px', '--ty2': a.ty2 + 'px',
          '--arc-tx': a.arcTx + 'px', '--arc-ty': a.arcTy + 'px',
          '--rot': a.rot + 'deg', '--rot2': a.rot2 + 'deg',
          '--arc-rot': a.arcRot + 'deg',
          '--scale': a.scale, '--scale2': a.scale2,
          '--dur': a.dur + 's', '--delay': a.delay + 's',
          '--end-op': a.endOp, '--anim': 'pp-' + a.anim,
          '--size': a.size + 'px',
          left: a.x + 'px', top: a.y + 'px',
          fontSize: a.size + 'px',
          color: a.color
        }">
        <span v-if="a.shape === 'emoji'" class="prop-icon">{{ a.icon }}</span>
      </div>
    </div>

    <!-- ═══ 幻想场景播放器 ═══ -->
    <div v-if="fantasyPlaying" class="absolute inset-0 z-50 bg-black flex items-center justify-center">
      <video ref="fantasyVideoEl" class="w-full h-full object-contain" autoplay playsinline @ended="onFantasyEnded"></video>
      <div class="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 rounded-full text-xs text-white/80 whitespace-nowrap">
        🎬 幻想场景 · 播放结束后自动返回
      </div>
    </div>

    <!-- ═══ 过场动画层（无选项场景播完/跳过后自动流转到下一场景） ═══ -->
    <Transition name="trans">
      <div v-if="transitionActive"
        class="absolute inset-0 z-[60] bg-black flex flex-col items-center justify-center gap-3 px-8 text-center">
        <div v-if="transitionChapter" class="trans-chapter text-xs text-white/40 tracking-[0.4em]">{{ transitionChapter }}</div>
        <div class="trans-title text-lg sm:text-xl text-white/90 font-medium max-w-md">{{ transitionTitle || '…' }}</div>
        <div class="trans-line w-28 h-px bg-white/30"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Hls from 'hls.js'
import { useGameStore } from '../stores/game'
import { useLangStore } from '../stores/lang'
import { useAuthStore } from '../stores/auth'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { useParticleSystem } from '../composables/game/useParticleSystem'
import { useFantasyPlayer } from '../composables/game/useFantasyPlayer'
import { useMobileDetection } from '../composables/game/useMobileDetection'

const route = useRoute()
const router = useRouter()
const game = useGameStore()
const { confirm } = useConfirm()
const langStore = useLangStore()
const { get, post } = useApi()
const toast = useToast()

const rootEl = ref(null)
const videoEl = ref(null)

// ═══ Composable: 粒子动画 ═══
const { effectAnims, effectShake, triggerShake, spawnEffect, cleanup: cleanupParticles } = useParticleSystem(rootEl)

// ═══ Composable: 幻想场景 ═══
const { fantasyPlaying, fantasyVideoEl, playFantasy, onFantasyEnded, cleanup: cleanupFantasy } = useFantasyPlayer(videoEl, toast)

// ═══ Composable: 移动端检测 ═══
const { isMobile, updateMobileDetection } = useMobileDetection()

// 播放状态
const isPlaying = ref(false)
const isBuffering = ref(false)
const videoCurrentTime = ref(0)  // 供 choice_delay 弹出检测 + 进度条
const videoDuration = ref(0)     // 供 skipScene 用 + 进度条
const playbackRate = ref(1)
const isLooping = ref(false)
const subtitleText = ref('')

// ═══ 进度条（鼠标移到附近才显示; 移动端控制栏出现即显示） ═══
const progressHover = ref(false)
// 桌面: 控制栏可见 && 悬停; 移动端: 控制栏可见即显示（触屏无 hover 概念）
const progressBarVisible = computed(() => {
  if (isMobile.value) return controlsVisible.value
  return controlsVisible.value && progressHover.value
})
const progressPercent = computed(() => {
  if (!videoDuration.value) return 0
  return Math.min(100, Math.max(0, (videoCurrentTime.value / videoDuration.value) * 100))
})
const bufferedPercent = computed(() => {
  const v = videoEl.value
  if (!v || !v.buffered.length || !videoDuration.value) return 0
  return Math.min(100, (v.buffered.end(v.buffered.length - 1) / videoDuration.value) * 100)
})
function touchLeaveProgress() {
  setTimeout(() => { progressHover.value = false }, 1500)
}
function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60), ss = s % 60
  return m + ':' + String(ss).padStart(2, '0')
}
// 点击轨道 seek（对白/选项期间禁止拖动——对白跟随视频时间轴触发，乱跳会错乱触发状态）
function onProgressClick(e) {
  if (dialogueActiveId.value || choicesActive.value) return
  const v = videoEl.value
  if (!v || !v.duration || !Number.isFinite(v.duration)) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  v.currentTime = ratio * v.duration
  videoCurrentTime.value = v.currentTime
  // seek 后若处于暂停状态保持暂停；播放中则继续
  revealControls()
}

// UI 菜单状态（存档/读档入口已移除：过场景自动保存 + 开场页继续游戏）
const showMoreMenu = ref(false)
const showSpeedMenu = ref(false)
const showBackMenu = ref(false)

// 返回上一场景（扣积分，数额后台 backtrack_cost 配置）
const backtracking = ref(false)
const backtrackCost = ref(10)

// ═══ 道具系统 ═══
const propList = ref([])
const showPropPanel = ref(false)
// 按类型分组：效果道具(通用)、幻想场景道具(绑定到当前场景)
const effectProps = computed(() => propList.value.filter(p => p.type !== 'fantasy'))
const fantasyProps = computed(() => propList.value.filter(p => p.type === 'fantasy'))

async function loadProps(sceneId) {
  try {
    const params = sceneId ? { scene_id: sceneId } : {}
    const r = await get('/props/available', params)
    propList.value = r.props || []
  } catch (e) {}
}

// 使用道具（不弹扣费确认，可连续点击；仅积分不足时提示）
// 300ms 节流：防意外双击多扣一次积分，不阻止刻意连点
let lastPropUseAt = 0
async function useProp(p) {
  if (!p) return
  const now = Date.now()
  if (now - lastPropUseAt < 300) return
  lastPropUseAt = now
  let res
  try {
    res = await post('/props/' + p.id + '/use', {
      scene_id: game.currentScene?.id || null
    })
  } catch (e) {
    if (e.status === 402) {
      const go = await confirm({
        title: '积分不足',
        message: e.message || '积分不足',
        icon: '💎',
        confirmText: '去充值',
        cancelText: '取消'
      })
      if (go) router.push('/profile')
    } else {
      toast.show(e.message)
    }
    return
  }
  if (res.error) { toast.show(res.error); return }
  if (res.points_balance !== undefined) {
    const auth = useAuthStore()
    if (auth.user) auth.user.points = res.points_balance
  }
  if (res.points_consumed) {
    toast.show(`-${p.point_cost} 💎 剩余 ${res.points_balance}`)
  }
  if (p.type === 'fantasy') {
    showPropPanel.value = false
    playFantasy(res.video)
  } else {
    spawnEffect(p)
  }
}

// spawnEffect 已移至 composables/game/useParticleSystem.js
// playFantasy / onFantasyEnded 已移至 composables/game/useFantasyPlayer.js

// HLS 实例
let hls = null
const audioTracks = ref([])
const subtitleTracks = ref([])
const audioTrackId = ref(-1)
const subtitleId = ref(-1)
// 跨场景记住用户音轨/字幕语言选择
let savedAudioLang = null
let savedSubLang = null
let subInitialized = false  // 首次自动选，之后跟用户选择
let subExplicitlyOff = false  // 用户主动关闭字幕，跨场景不重新开启

// 选项
const currentChoices = ref([])
const choicesActive = ref(false)

// ═══ 场景对白（树游走状态机：line=点击显示下一节点，option=弹出子项供玩家点选，显示期间暂停视频） ═══
// 当前显示中的节点 id（null=无对白显示；可以是树上任意节点，不限于根）
const dialogueActiveId = ref(null)
// option 节点被玩家选中的子节点 id（决定后续分支）
const dialogueChosenId = ref(null)
// 本场景已显示过的节点 id（防重复触发/重复显示）
const shownDialogueIds = new Set()

const sceneDialogues = computed(() => game.currentScene?.dialogues || [])

// 当前显示的对白节点（树上任意位置）
const activeDialogueNode = computed(() =>
  dialogueActiveId.value ? sceneDialogues.value.find(d => d.id === dialogueActiveId.value) || null : null
)

// 当前对白的角色形象图/主题色（关联角色时显示立绘, 说话人名牌取角色色）
// avatar 存的是 'uploads/avatars/x.png'（无斜杠）→ 必须转成 '/uploads/...' 绝对路径,
// 否则浏览器把相对 src 按当前路由解析: /play/3 页面会拼成 /play/uploads/... 404
const activeCharAvatar = computed(() => {
  const a = activeDialogueNode.value?.character_avatar
  return a ? '/' + String(a).replace(/^\//, '') : null
})
const activeCharColor = computed(() => activeDialogueNode.value?.character_color || null)

// 名牌底色变量：角色主题色渐变（dlg-nameplate 内 color-mix 消费; 未设色时走 CSS 金色兜底）
const nameplateVars = computed(() => {
  const c = activeCharColor.value
  return c ? { '--np-color': c } : {}
})

// 某节点的直接子节点（按 sort_order, id 排序，与后端返回顺序一致）
function nodeChildren(id) {
  return sceneDialogues.value.filter(d => d.parent_id === id)
}

// 当前 option 节点的候选项 = 其全部子节点
const activeDialogueOptions = computed(() => {
  const node = activeDialogueNode.value
  if (!node || node.node_type !== 'option') return []
  return nodeChildren(node.id)
})

// 选项按钮上的属性影响标记 [{attr_id, attr_name, delta}]
function dialogueOptionEffects(optionId) {
  const effects = game.dialogueEffectMap[optionId] || []
  return effects.map(e => {
    const attr = game.gameAttributes.find(a => a.id === e.attr_id)
    return { attr_id: e.attr_id, attr_name: attr?.name || '?', delta: e.delta }
  })
}

// ═══ 场景对白选项记忆：本提问节点是否有历史选择（未过场景重进保留, 其他选项锁定不可改选） ═══
const recordedChoiceId = computed(() => {
  const node = activeDialogueNode.value
  if (!node || node.node_type !== 'option') return null
  const sid = game.currentScene?.id
  if (sid == null) return null
  const rec = game.getRecordedChoice(sid, node.id)
  // 记录的选项已不在当前候选中（内容被编辑过）→ 视为无记录
  return rec && nodeChildren(node.id).some(c => c.id === rec) ? rec : null
})
function optionLocked(opt) {
  return recordedChoiceId.value !== null && opt.id !== recordedChoiceId.value
}

// ═══ 选项属性门槛：玩家属性达到 min_value 才可选 ═══
function optionGated(opt) {
  if (!opt.min_attr_id || !(opt.min_value > 0)) return false
  const attr = game.gameAttributes.find(a => a.id === opt.min_attr_id)
  if (!attr) return false
  return attr.value < opt.min_value
}
function gateAttrName(attrId) {
  return game.gameAttributes.find(a => a.id === attrId)?.name || '?'
}
function gateAttrValue(attrId) {
  return game.gameAttributes.find(a => a.id === attrId)?.value ?? 0
}

// 文字特效样式类（fx-angry / fx-shock...，后端白名单内才有效果，否则普通显示）
const textEffectClass = computed(() => {
  const fx = activeDialogueNode.value?.text_effect
  return fx ? `fx-${fx}` : ''
})

// 文字大小样式类（后端白名单 small/medium/large/xlarge, 空=默认 text-sm/base）
const textSizes = ['small', 'medium', 'large', 'xlarge']
const textSizeClass = computed(() => {
  const s = activeDialogueNode.value?.text_size
  return textSizes.includes(s) ? `dt-${s}` : ''
})

// 飘字起始 y：属性行下方（属性行 top-16=4rem 起；单行约 1.5rem, 换行时按比例下移）
const attrFloatTop = computed(() => {
  const rows = Math.ceil(game.gameAttributes.length / 3) || 1  // 每3个约一行
  return `calc(4rem + ${rows * 1.6}rem)`
})

// 检测触发（onTimeUpdate 调用）：视频播到根对白 show_time → 暂停视频开始对白
function checkDialogueTrigger() {
  if (dialogueActiveId.value || choicesActive.value) return
  const now = videoCurrentTime.value
  const next = sceneDialogues.value.find(
    d => !d.parent_id && !shownDialogueIds.has(d.id) && now >= d.show_time
  )
  if (!next) return
  startDialogue(next)
}

function startDialogue(node) {
  shownDialogueIds.add(node.id)
  dialogueChosenId.value = null
  dialogueActiveId.value = node.id
  videoEl.value?.pause()  // 对白显示期间暂停视频
}

// 点击对白推进：沿树游走 —— 当前节点走完看子节点：
// 子节点是 line → 继续显示；是 option → 弹出提问；无子节点 → 关闭并恢复视频
function advanceDialogue() {
  const node = activeDialogueNode.value
  if (!node || node.node_type === 'option') return  // option 节点必须点选项推进
  const children = nodeChildren(node.id)
  const next = children.find(c => !shownDialogueIds.has(c.id))
  if (next) {
    startDialogue(next)
    return
  }
  // 无未显示的子节点：关闭对白，恢复视频
  dialogueActiveId.value = null
  videoEl.value?.play().catch(() => {})
}

// 玩家点了某个对白选项：进入该选项分支 —— 选项节点的子节点继续逐条显示
// 分支里遇到提问节点会再弹出提问，层级不限；同时结算该选项的属性影响
// 场景对白选项记忆：未过场景重进时保留上次选择（不允许改选其他, 也不重复结算属性）
async function pickDialogueOption(childId) {
  const node = activeDialogueNode.value
  if (!node) return
  const sid = game.currentScene?.id
  const recorded = sid != null ? game.getRecordedChoice(sid, node.id) : null
  // 已有历史选择时不允许改选其他选项
  if (recorded && recorded !== childId) return
  dialogueChosenId.value = childId
  dialogueActiveId.value = null
  // 属性影响结算（飘字 + 数值变化，服务端校验）；仅首次选择时结算
  if (!recorded) {
    if (sid != null) game.recordDialogueChoice(sid, node.id, childId)
    game.applyDialogueEffects(childId)
  }
  const next = nodeChildren(childId).find(c => !shownDialogueIds.has(c.id))
  if (next) {
    startDialogue(next)
  } else {
    // 该选项下没有后续内容：关闭并恢复视频
    videoEl.value?.play().catch(() => {})
  }
}

// ═══ 过场动画（无选项场景自动流转） ═══
const transitionActive = ref(false)    // 过场层显示（Transition 淡入淡出）
const transitionChapter = ref('')      // 下一场景章节名
const transitionTitle = ref('')        // 下一场景标题

// 主题样式：将 game.themeConfig 转换为 CSS 变量字典，应用到选项容器
// 容器 :style="themeVars" 后，子元素通过 var(--choice-xxx) 取色
// 主题样式配置 → CSS 变量字典（游戏级 themeVars 与选项级 choiceVars 共用）
function cfgToVars(cfg) {
  if (!cfg) return {}
  const vars = {}
  if (cfg.button_bg) vars['--choice-bg'] = cfg.button_bg
  if (cfg.button_border) vars['--choice-border'] = cfg.button_border
  if (cfg.button_text) vars['--choice-text'] = cfg.button_text
  if (cfg.hover_bg) vars['--choice-hover-bg'] = cfg.hover_bg
  if (cfg.hover_border) vars['--choice-hover-border'] = cfg.hover_border
  if (cfg.number_color) vars['--choice-number'] = cfg.number_color
  if (cfg.paid_bg) vars['--choice-paid-bg'] = cfg.paid_bg
  if (cfg.paid_text) vars['--choice-paid-text'] = cfg.paid_text
  if (cfg.paid_border) vars['--choice-paid-border'] = cfg.paid_border
  if (cfg.cost_bg) vars['--choice-cost-bg'] = cfg.cost_bg
  if (cfg.cost_text) vars['--choice-cost-text'] = cfg.cost_text
  if (cfg.cost_border) vars['--choice-cost-border'] = cfg.cost_border
  if (cfg.radius) vars['--choice-radius'] = cfg.radius
  return vars
}

// 游戏级主题：注入选项容器（未设置主题的选项继承）
const themeVars = computed(() => cfgToVars(game.themeConfig))

// 选项级主题：注入单个选项按钮，覆盖容器的游戏级变量
function choiceVars(c) {
  return c.theme_config ? cfgToVars(c.theme_config) : {}
}

// ═══ 控制栏自动隐藏（沉浸式播放） ═══
// 播放中 3 秒无操作自动隐藏顶栏 + 控制栏；移动鼠标/触摸/点击唤醒
// 暂停、缓冲、选项弹出、任一菜单打开时控制栏常驻
const controlsVisible = ref(true)
let hideControlsTimer = null
const shouldKeepControls = computed(() =>
  !isPlaying.value || isBuffering.value || choicesActive.value ||
  showMoreMenu.value || showSpeedMenu.value || showBackMenu.value ||
  showPropPanel.value
)
function revealControls() {
  controlsVisible.value = true
  scheduleHideControls()
}
function scheduleHideControls() {
  if (hideControlsTimer) clearTimeout(hideControlsTimer)
  hideControlsTimer = setTimeout(() => {
    if (!shouldKeepControls.value) controlsVisible.value = false
  }, 3000)
}
watch(shouldKeepControls, keep => {
  if (keep) {
    controlsVisible.value = true
    if (hideControlsTimer) { clearTimeout(hideControlsTimer); hideControlsTimer = null }
  } else {
    scheduleHideControls()
  }
})

// 拖拽 seek 已随进度条移除
// ═══════════════════════════════════════════════════════════════
// HLS 加载（照搬 hls-test 的标准实现）
// ═══════════════════════════════════════════════════════════════
function destroyHls() {
  if (hls) {
    // 记住当前音轨/字幕语言，下个场景恢复
    const curAudioTrack = audioTracks.value.find(t => t.id === audioTrackId.value)
    const curSubTrack = subtitleTracks.value.find(t => t.id === subtitleId.value)
    if (curAudioTrack) savedAudioLang = curAudioTrack.lang
    if (curSubTrack) savedSubLang = curSubTrack.lang
    hls.destroy()
    hls = null
    audioTracks.value = []
    subtitleTracks.value = []
    audioTrackId.value = -1
    subtitleId.value = -1
    subtitleText.value = ''
    subInitialized = false  // 下个场景重新走首次选择逻辑
    // subExplicitlyOff 保持不重置：用户关闭字幕的意图跨场景有效
  }
}

function loadHlsStream(url) {
  destroyHls()

  // Safari 原生 HLS
  if (videoEl.value.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
    videoEl.value.src = url
    return
  }

  hls = new Hls({
    lowLatencyMode: false,
    enableWebVTT: true,
    // 开启原生渲染（否则 cue 不进 textTrack），用 CSS 隐藏
    renderTextTracksNatively: true
  })
  hls.loadSource(url)
  hls.attachMedia(videoEl.value)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    updateAudioTracks()
    updateSubtitleTracks()
    videoEl.value.play().catch(() => {})
  })

  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateAudioTracks)
  hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateSubtitleTracks)

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => {
    audioTrackId.value = data.id
  })

  hls.on(Hls.Events.ERROR, (_evt, data) => {
    console.error('[HLS] ERROR:', data.type, data.details, data.fatal ? '(fatal)' : '')
  })

  // 字幕 cue 监听：hls.js 非原生渲染时通过 textTracks 提供字幕数据
  setupSubtitleCueListener()
}

function setupSubtitleCueListener() {
  const v = videoEl.value
  if (!v) return
  const tracks = v.textTracks
  if (!tracks) return
  let found = false
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    if (track.kind === 'subtitles') {
      // 不手动设置 track.mode，让 hls.js 管理（'showing'/'disabled'）
      // 原生渲染通过 CSS video::cue { visibility: hidden } 隐藏
      // 之前手动设 'hidden' 会导致 hls.js 误判轨道不可用，ERR_ABORTED 取消请求并回退到其他轨道
      track.oncuechange = () => {
        const cue = track.activeCues && track.activeCues[0]
        subtitleText.value = cue ? cue.text : ''
      }
      found = true
    }
  }
  // textTrack 可能还没创建，100ms 后重试
  if (!found && subtitleId.value !== -1) {
    setTimeout(() => setupSubtitleCueListener(), 100)
  }
}

function updateAudioTracks() {
  if (!hls) return
  audioTracks.value = hls.audioTracks || []
  audioTrackId.value = hls.audioTrack
  // 恢复上次选择的音轨语言，或首次匹配 UI 语言
  if (savedAudioLang && audioTrackId.value === -1) {
    const match = audioTracks.value.find(t => t.lang === savedAudioLang)
    if (match) {
      audioTrackId.value = match.id
      hls.audioTrack = match.id
    }
  }
  // 首次（无保存偏好）且无选中时，匹配 UI 语言
  if (!savedAudioLang && audioTrackId.value === -1 && audioTracks.value.length > 0) {
    const uiLang = langStore.current
    const match = audioTracks.value.find(t => t.lang === uiLang) || audioTracks.value[0]
    audioTrackId.value = match.id
    hls.audioTrack = match.id
    savedAudioLang = match.lang
  }
}

function updateSubtitleTracks() {
  if (!hls) return
  subtitleTracks.value = hls.subtitleTracks || []
  subtitleId.value = hls.subtitleTrack
  // 首次加载：按 UI 语言或保存的偏好覆盖 hls.js 默认选择
  if (!subInitialized && subtitleTracks.value.length > 0) {
    if (savedSubLang) {
      const match = subtitleTracks.value.find(t => t.lang === savedSubLang)
      if (match) {
        subtitleId.value = match.id
        hls.subtitleTrack = match.id
      }
    } else if (!subExplicitlyOff) {
      const uiLang = langStore.current
      const match = subtitleTracks.value.find(t => t.lang === uiLang) || subtitleTracks.value[0]
      subtitleId.value = match.id
      hls.subtitleTrack = match.id
      savedSubLang = match.lang
    }
    // 用户明确关闭 → 不选任何字幕
    subInitialized = true
  }
  // 字幕列表就绪后重新绑定 cue 监听
  nextTick(() => setupSubtitleCueListener())
}

function onAudioTrackChange() {
  if (!hls) return
  hls.audioTrack = audioTrackId.value
  const t = audioTracks.value.find(t => t.id === audioTrackId.value)
  if (t) savedAudioLang = t.lang
}

function onSubtitleChange() {
  if (!hls) return
  hls.subtitleTrack = subtitleId.value
  if (subtitleId.value === -1) {
    subtitleText.value = ''
    savedSubLang = null
    subExplicitlyOff = true
  } else {
    const t = subtitleTracks.value.find(t => t.id === subtitleId.value)
    if (t) savedSubLang = t.lang
    subExplicitlyOff = false
  }
  // 切换字幕后重新绑定 cue 监听
  nextTick(() => setupSubtitleCueListener())
}

// ═══════════════════════════════════════════════════════════════
// 视频事件
// ═══════════════════════════════════════════════════════════════
function onPlay() { isPlaying.value = true }
function onPause() { isPlaying.value = false }
function onWaiting() { isBuffering.value = true }
function onPlaying() { isBuffering.value = false }
function onTimeUpdate() {
  videoCurrentTime.value = videoEl.value?.currentTime || 0
  checkDialogueTrigger()
  checkChoicePopup()
}
function onDurationChange() {
  videoDuration.value = Number.isFinite(videoEl.value?.duration) ? videoEl.value.duration : 0
}
function onEnded() {
  // 循环模式：loop 属性生效时 ended 不会触发，此分支仅作异常兜底
  if (isLooping.value) {
    restartVideo()
    return
  }

  const scene = game.currentScene
  if (!scene) return

  // 结局场景：跳转结束页
  if (scene.is_ending) {
    router.push('/ending')
    return
  }

  // 有选项：视频结束弹选项（直接跳转则自动执行）
  if (scene.choices && scene.choices.length > 0) {
    const aj = autoJumpChoice(scene)
    if (aj && !choicesActive.value) { startAutoJump(aj); return }
    if (!choicesActive.value) {
      showChoices(scene.choices, scene.choice_timer)
    }
    return
  }

  // 无选项非结局：结束游戏进结局页（Ending 页无 ending 数据时显示 THE END）
  router.push('/ending')
}

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (dialogueActiveId.value || choicesActive.value) return  // 对白/选项期间不允许手动播放
  if (v.paused) v.play()
  else v.pause()
}

function replayScene() {
  restartVideo()
}

// 安全重播：ended 状态下直接 seek(0)+play 有竞态（hls.js ENDED 状态下 play 先于
// seek 完成执行，会立即再次触发 ended，表现为最后一个分片反复播放后彻底停止）
// 先 pause 退出 ended 状态，等 seek 完成后再 play
function restartVideo() {
  const v = videoEl.value
  if (!v) return
  v.pause()
  if (v.currentTime < 0.05) { v.play().catch(() => {}); return }
  v.addEventListener('seeked', () => v.play().catch(() => {}), { once: true })
  v.currentTime = 0
}

function skipScene() {
  const v = videoEl.value
  if (!v) return
  // 跳到视频末尾，触发 onEnded 逻辑（弹选项 / 直接跳转 / 进结局页）
  v.currentTime = (videoDuration.value || v.duration || 0) - 0.1
}

// 直接跳转：唯一选项标记 is_auto_jump 时，选项出现时刻自动执行该选项
// 过场动画视觉：黑幕淡入 → makeChoice 获取下一场景（内部已 loadScene）→ 淡出
// 好感度规则、扣积分、压历史栈、自动存档均走 makeChoice 正常流程
async function startAutoJump(choice) {
  if (transitionActive.value) return
  transitionActive.value = true
  transitionChapter.value = ''
  transitionTitle.value = ''

  // 暂停当前视频（保留最后一帧，由过场黑幕盖住）
  videoEl.value?.pause()

  // 执行选项：成功 {scene}/{finished}，积分不足 {insufficientPoints}，失败 null
  const choicePromise = game.makeChoice(choice.id).then(r => {
    if (r && r.scene && transitionActive.value) {
      transitionChapter.value = r.scene.chapter || ''
      transitionTitle.value = r.scene.title || ''
    }
    return r
  })

  // 保证动画最短展示时长（黑幕淡入 + 标题渐显 + 停留）
  const [result] = await Promise.all([
    choicePromise,
    new Promise(r => setTimeout(r, 2000))
  ])
  if (!transitionActive.value) return  // 中途被中断（返回大厅/组件卸载）

  transitionActive.value = false  // 淡出（成功时 makeChoice 已 loadScene，新视频在黑幕后缓冲）

  if (!result || result.insufficientPoints) {
    // 失败或积分不足：改弹选项卡交还用户手动选择（点击走正常 onChoose 流程）
    const scene = game.currentScene
    if (scene && scene.choices && scene.choices.length) {
      showChoices(scene.choices, scene.choice_timer)
    }
  } else if (result.finished) {
    // 选项无跳转目标：进入结束页
    router.push('/ending')
  }
  // result.scene：makeChoice 内部已 loadScene，watch(currentScene) 自动触发 playScene
}

function toggleLoop() {
  isLooping.value = !isLooping.value
}

function setSpeed(rate) {
  playbackRate.value = rate
  if (videoEl.value) videoEl.value.playbackRate = rate
  showSpeedMenu.value = false
}

async function toggleFullscreen() {
  const v = videoEl.value
  // 退出全屏
  if (document.fullscreenElement || (v && v.webkitDisplayingFullscreen)) {
    if (document.exitFullscreen) await document.exitFullscreen().catch(() => {})
    if (v?.webkitExitFullscreen) v.webkitExitFullscreen()
    // 解锁屏幕方向
    if (screen.orientation?.unlock) screen.orientation.unlock().catch(() => {})
    return
  }

  // 进入全屏
  // iOS Safari：仅 video 元素支持原生全屏，会自动横屏
  if (v?.webkitEnterFullscreen && !document.fullscreenEnabled) {
    v.webkitEnterFullscreen()
    return
  }

  // 标准 Fullscreen API（Android Chrome / 桌面）
  if (rootEl.value?.requestFullscreen) {
    await rootEl.value.requestFullscreen().catch(() => {})
  } else if (v?.webkitEnterFullscreen) {
    v.webkitEnterFullscreen()
  }

  // 移动端全屏后锁定横屏（iOS 不支持，Android Chrome 支持）
  if (screen.orientation?.lock) {
    screen.orientation.lock('landscape').catch(() => {})
  }
}

// ═══════════════════════════════════════════════════════════════
// 进度条已按需求移除（防拖拽快进），seek 相关逻辑一并清理
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 存档/读档入口已移除：loadScene 自动存档（slot=-game_id），读档走开场页"继续游戏"
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 场景播放 + 选项逻辑
// ═══════════════════════════════════════════════════════════════
let playRequestId = 0

async function playScene() {
  const scene = game.currentScene
  if (!scene) return
  const reqId = ++playRequestId

  currentChoices.value = []
  choicesActive.value = false
  dialogueActiveId.value = null
  dialogueChosenId.value = null
  shownDialogueIds.clear()
  isBuffering.value = true
  videoCurrentTime.value = 0
  videoDuration.value = 0
  subtitleText.value = ''

  const v = videoEl.value
  if (!v) return
  v.currentTime = 0
  v.playbackRate = playbackRate.value

  if (scene.hls_url && scene.hls_status === 'done') {
    loadHlsStream(scene.hls_url)
  } else if (scene.file_path) {
    destroyHls()
    v.src = '/' + scene.file_path.replace(/\\/g, '/')
    v.load()
    v.play().catch(() => {})
  } else {
    isBuffering.value = false
    return
  }

  await nextTick()
  if (reqId !== playRequestId) return
  isBuffering.value = false
}

// 直接跳转检测：场景只有一个选项且标记 is_auto_jump
// 付费未购时不能静默扣费，仍走弹选项卡流程
function autoJumpChoice(scene) {
  if (!scene || !scene.choices || scene.choices.length !== 1) return null
  const c = scene.choices[0]
  if (!c.is_auto_jump) return null
  if (c.point_cost > 0 && !c.paid) return null
  return c
}

// 选项弹出检测
function checkChoicePopup() {
  const scene = game.currentScene
  if (!scene || !scene.choices || !scene.choices.length) return
  if (choicesActive.value) return
  const delay = scene.choice_delay
  if (!delay || delay <= 0) return
  if (videoCurrentTime.value >= delay) {
    // 直接跳转：到选项弹出时刻自动执行，不弹选项卡
    const aj = autoJumpChoice(scene)
    if (aj) { startAutoJump(aj); return }
    showChoices(scene.choices, scene.choice_timer)
  }
}

function showChoices(choices, timer) {
  currentChoices.value = choices
  choicesActive.value = true
  // 选项不设倒计时，用户未选择则一直停留
}

async function onChoose(choiceId) {
  // 备份当前选项，积分不足取消时恢复
  const prevChoices = currentChoices.value
  const prevScene = game.currentScene
  choicesActive.value = false
  currentChoices.value = []

  const result = await game.makeChoice(choiceId)
  if (!result) return

  if (result.insufficientPoints) {
    const go = await confirm({
      title: '积分不足',
      message: `选择此选项需要 ${result.required} 💎，当前余额 ${result.current} 💎`,
      icon: '💎',
      confirmText: '去充值',
      cancelText: '取消'
    })
    if (go) {
      router.push('/profile')
    } else {
      // 取消：恢复选项，让用户重新选择
      if (game.currentScene === prevScene) {
        currentChoices.value = prevChoices
        choicesActive.value = true
      }
    }
    return
  }

  if (result.finished) {
    router.push('/ending')
  }
  // result.scene 情况：game.makeChoice 内部已 loadScene 更新 currentScene，
  // watch(currentScene) 会自动触发 playScene，无需手动调用
}

function onReturnToLobby() {
  playRequestId++
  showBackMenu.value = false
  transitionActive.value = false  // 中断进行中的过场动画
  destroyHls()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  game.returnToLobby()
  router.push('/')
}

// 返回上一场景：确认 → 扣积分 → 回退播放
async function onBacktrack() {
  showBackMenu.value = false
  if (!game.sceneHistory.length) { toast.show('已在起始场景，无法返回'); return }
  if (backtracking.value) return

  // 免费时无需确认弹窗（成本 0 直接回退）
  if (backtrackCost.value > 0) {
    const ok = await confirm({
      title: '返回上一场景',
      message: `返回上一场景将消耗 ${backtrackCost.value} 💎，确定吗？`,
      icon: '↩',
      confirmText: '返回',
      cancelText: '取消'
    })
    if (!ok) return
  }

  backtracking.value = true
  const result = await game.backtrack()
  backtracking.value = false

  if (!result) return
  if (result.insufficientPoints) {
    const go = await confirm({
      title: '积分不足',
      message: `返回上一场景需要 ${result.required} 💎，当前余额 ${result.current} 💎`,
      icon: '💎',
      confirmText: '去充值',
      cancelText: '取消'
    })
    if (go) router.push('/profile')
    return
  }
  if (result.ok) {
    const auth = useAuthStore()
    if (result.points_balance !== undefined && auth.user) {
      auth.user.points = result.points_balance
    }
    if (result.point_cost > 0) toast.show(`-${result.point_cost} 💎 已返回上一场景`)
  }
}

// ═══════════════════════════════════════════════════════════════
// 生命周期
// ═══════════════════════════════════════════════════════════════
function bindVideoEvents(el) {
  if (!el) return
  el.addEventListener('play', onPlay)
  el.addEventListener('pause', onPause)
  el.addEventListener('waiting', onWaiting)
  el.addEventListener('playing', onPlaying)
  el.addEventListener('timeupdate', onTimeUpdate)
  el.addEventListener('durationchange', onDurationChange)
  el.addEventListener('ended', onEnded)
}
function unbindVideoEvents(el) {
  if (!el) return
  el.removeEventListener('play', onPlay)
  el.removeEventListener('pause', onPause)
  el.removeEventListener('waiting', onWaiting)
  el.removeEventListener('playing', onPlaying)
  el.removeEventListener('timeupdate', onTimeUpdate)
  el.removeEventListener('durationchange', onDurationChange)
  el.removeEventListener('ended', onEnded)
}

watch(() => game.currentScene, (newScene) => {
  if (newScene) {
    nextTick(() => playScene())
    // 场景切换后重新加载该场景可用道具（按 scene_id 过滤）
    loadProps(newScene.id)
  }
}, { immediate: true })

watch(videoEl, (el, oldEl) => {
  if (oldEl && oldEl !== el) unbindVideoEvents(oldEl)
  if (el) bindVideoEvents(el)
}, { immediate: true })

function onFullscreenChange() {
  // 用户按 ESC 退出全屏时，解锁屏幕方向
  if (!document.fullscreenElement && screen.orientation?.unlock) {
    screen.orientation.unlock().catch(() => {})
  }
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  // 读取回退成本配置（后台"积分设置-返回上一场景消耗"）
  try {
    const r = await get('/config')
    const c = parseInt(r.config?.backtrack_cost)
    if (Number.isFinite(c) && c >= 0) backtrackCost.value = c
  } catch (e) { /* 用默认值 */ }
  // 道具加载由 watch(currentScene) 触发，按场景 ID 过滤
  const gameId = route.params.gameId
  if (gameId && !game.currentScene) {
    // ?new=1（详情页"重新开始"/结局页"再看一次"）= 显式新开一局（清属性+对白记忆）
    // 否则默认继续游戏（读自动档: 场景+属性快照+历史栈），无自动档才新开
    if (route.query.new === '1') {
      await game.startNewGame(parseInt(gameId) || gameId)
    } else {
      const ok = await game.continueGame(parseInt(gameId) || gameId)
      if (!ok) await game.startNewGame(parseInt(gameId) || gameId)
    }
  }
  if (!game.currentScene) router.push('/')
})

onBeforeUnmount(() => {
  playRequestId++
  transitionActive.value = false  // 中断进行中的过场动画
  if (hideControlsTimer) { clearTimeout(hideControlsTimer); hideControlsTimer = null }
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  unbindVideoEvents(videoEl.value)
  destroyHls()
  cleanupFantasy()
  cleanupParticles()
  if (videoEl.value) {
    videoEl.value.pause()
    videoEl.value.src = ''
  }
  game.returnToLobby()
})
</script>

<style>
/* ═══ 属性变化飘字（选项结算反馈） ═══ */
.attr-float {
  animation: attr-float-up 2.2s ease forwards;
}
@keyframes attr-float-up {
  0% { opacity: 0; transform: translateY(8px) scale(0.9); }
  15% { opacity: 1; transform: translateY(0) scale(1); }
  75% { opacity: 1; transform: translateY(-6px) scale(1); }
  100% { opacity: 0; transform: translateY(-22px) scale(0.95); }
}

/* 隐藏 hls.js 原生渲染的字幕（我们通过 cuechange 监听自己渲染到 DOM） */
video::cue {
  visibility: hidden;
}

/* ═══ 过场动画（无选项场景自动流转到下一场景） ═══
 * 黑幕淡入淡出由 Vue <Transition name="trans"> 管理；
 * 章节名/标题/装饰线在黑幕盖住后依次渐显
 */
.trans-enter-active,
.trans-leave-active {
  transition: opacity 0.5s ease;
}
.trans-enter-from,
.trans-leave-to {
  opacity: 0;
}
.trans-chapter {
  animation: trans-fade-up 0.6s ease 0.45s both;
}
.trans-title {
  animation: trans-fade-up 0.7s ease 0.55s both;
}
.trans-line {
  animation: trans-line-grow 0.8s ease 0.7s both;
  transform-origin: center;
}
@keyframes trans-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@keyframes trans-line-grow {
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
}

/* ═══ 对白层：立绘 + 金色名牌对话框（仿互动剧视觉） ═══ */
/* 关键定位写死在组件 CSS（不依赖 Tailwind 任意值类, 避免任何构建/缓存变数） */
/* 角色立绘：挂在框容器内左后方, 底边与框底齐平 — 从框里"长"出来, 与框连成一体无分隔 */
.dlg-figure {
  position: absolute;
  bottom: 0;
  left: 12px;
  height: clamp(240px, 50vh, 460px);
  max-width: 60%;
  width: auto;
  object-fit: contain;
  object-position: bottom;
  z-index: 0;
  pointer-events: none;
  animation: dlg-fig-in 0.32s ease-out both;
  filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.55));
}
@media (min-width: 640px) {
  .dlg-figure { height: clamp(240px, 64vh, 640px); }
}
@keyframes dlg-fig-in {
  from { opacity: 0; transform: translate(-26px, 10px); }
  to   { opacity: 1; transform: none; }
}

/* 对话框容器：底部悬浮, 抬高到控制栏上方 */
.dlg-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  padding: 0 12px 7.5rem;
  z-index: 2;
}
@media (min-width: 640px) {
  .dlg-panel { padding: 0 12px 8.5rem; }
}

/* 说话人名牌：主题色渐变（--np-color 由角色 color 注入, 未设色时兜底金色） */
.dlg-nameplate {
  --np-color: #c9900f;
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  height: 1.9rem;
  padding: 0 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--np-color) 30%, #ffe9a8) 0%,
    var(--np-color) 55%,
    color-mix(in srgb, var(--np-color) 62%, #2b1800) 100%);
  animation: dlg-name-in 0.25s ease-out both;
}
@keyframes dlg-name-in {
  from { opacity: 0; transform: translateY(8px) scale(0.92); }
  to   { opacity: 1; transform: none; }
}

/* 对话框：名牌下方升入；置在立绘上方(人物下半身沉入框后) */
.dlg-box {
  position: relative;
  z-index: 1;
  animation: dlg-box-in 0.28s ease-out both;
}
@keyframes dlg-box-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}

/* 继续指示：金色下箭头弹性律动 */
.dlg-next-arrow {
  animation: dlg-arrow-bounce 1.1s ease-in-out infinite;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
}
@keyframes dlg-arrow-bounce {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50%      { transform: translateY(3px); opacity: 1; }
}

/* ═══ 选项框主题样式（由 game.themeConfig 注入 CSS 变量驱动） ═══
 * 变量未注入时使用深色兜底（保持原有视觉），保证旧游戏/无主题配置可用
 */
.choice-btn {
  background: var(--choice-bg, rgba(0, 0, 0, 0.55));
  border-color: var(--choice-border, rgba(255, 255, 255, 0.15));
  color: var(--choice-text, #ffffff);
  border-radius: var(--choice-radius, 8px);
  backdrop-filter: blur(6px);
}
.choice-btn:hover {
  background: var(--choice-hover-bg, rgba(139, 92, 246, 0.4));
  border-color: var(--choice-hover-border, #8b5cf6);
}
.choice-number {
  color: var(--choice-number, #9ca3af);
}
.choice-paid {
  background: var(--choice-paid-bg, rgba(74, 222, 128, 0.15));
  color: var(--choice-paid-text, #4ade80);
  border-color: var(--choice-paid-border, rgba(74, 222, 128, 0.3));
}
.choice-cost {
  background: var(--choice-cost-bg, rgba(251, 191, 36, 0.15));
  color: var(--choice-cost-text, #fbbf24);
  border-color: var(--choice-cost-border, rgba(251, 191, 36, 0.3));
}

/* ═══ 道具效果动画（粒子系统） ═══ */
.prop-particle {
  position: absolute;
  transform: translate(-50%, -50%);
  line-height: 1;
  animation: var(--anim) var(--dur) cubic-bezier(0.22, 0.9, 0.35, 1) var(--delay) forwards;
  will-change: transform, opacity;
  z-index: 50;
  text-shadow: 0 0 14px currentColor, 0 0 34px currentColor;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.35));
  pointer-events: none;
}
.prop-icon {
  display: block;
  line-height: 1;
}
/* 彩色纸屑粒子 */
.prop-confetti {
  width: 10px;
  height: 6px;
  background: currentColor;
  border-radius: 1px;
  box-shadow: 0 0 8px currentColor, 0 0 18px currentColor;
  font-size: 0 !important;
}
/* 蛋壳碎片 */
.prop-shell {
  width: var(--size);
  height: calc(var(--size) * 0.85);
  background: linear-gradient(135deg, #fffdf5 0%, #f5e9c8 100%);
  border-radius: 30% 60% 40% 50%;
  box-shadow: inset 0 0 3px rgba(180, 140, 60, 0.25);
  font-size: 0 !important;
}
/* 蛋液 */
.prop-yolk {
  width: calc(var(--size) * 0.8);
  height: calc(var(--size) * 0.8);
  background: radial-gradient(circle at 35% 35%, #ffe082 0%, #ffca28 60%, #ffb300 100%);
  border-radius: 50% 55% 45% 60%;
  box-shadow: 0 0 12px rgba(255, 193, 7, 0.7), 0 0 24px rgba(255, 193, 7, 0.35);
  font-size: 0 !important;
}
/* 番茄果肉碎片（颜色由 currentColor 控制） */
.prop-flesh {
  width: var(--size);
  height: calc(var(--size) * 0.9);
  background: radial-gradient(circle at 40% 35%, rgba(255, 255, 255, 0.55) 0%, currentColor 55%, rgba(0, 0, 0, 0.15) 100%);
  border-radius: 45% 55% 60% 40%;
  box-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
  font-size: 0 !important;
}

/* 通用飞行动画：从起点位移到 (--tx, --ty)，70% 处轻微过冲 */
@keyframes pp-fly {
  0%   { transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0; }
  12%  { opacity: 1; }
  70%  { transform: translate(calc(-50% + var(--tx2)), calc(-50% + var(--ty2))) scale(var(--scale2)) rotate(var(--rot2)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)) rotate(var(--rot)); opacity: var(--end-op); }
}
/* 砸落：更快的进场 + 高速旋转 + 拖影 */
@keyframes pp-throw {
  0%   { transform: translate(-50%, -50%) scale(0.5) rotate(0deg); opacity: 0; }
  6%   { opacity: 1; }
  60%  { transform: translate(calc(-50% + var(--tx2)), calc(-50% + var(--ty2))) scale(var(--scale2)) rotate(var(--rot2)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)) rotate(var(--rot)); opacity: var(--end-op); }
}
/* 投掷：从一侧抛物线飞向目标，55% 处到达顶点（y 向上拱起 arc） */
@keyframes pp-toss {
  0%   { transform: translate(-50%, -50%) scale(0.65) rotate(0deg); opacity: 0; }
  8%   { opacity: 1; }
  /* 抛物线顶点：x 走到 55%，y 在线性基础上向上拱起 arc 高度 */
  55%  { transform: translate(calc(-50% + var(--arc-tx)), calc(-50% + var(--arc-ty))) scale(1.18) rotate(var(--arc-rot)); opacity: 1; }
  92%  { transform: translate(calc(-50% + var(--tx) * 0.98), calc(-50% + var(--ty) * 0.98)) scale(1.15) rotate(calc(var(--rot) * 0.95)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)) rotate(var(--rot)); opacity: var(--end-op); }
}
/* 烟花中心爆闪 */
@keyframes pp-pop {
  0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
  60%  { transform: translate(-50%, -50%) scale(1.6); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
}
/* 烟花光点：直线四散 + 拉长发光 */
@keyframes pp-spark {
  0%   { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
  25%  { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--scale)); opacity: 0; }
}

/* 屏幕震动 */
.effect-shake {
  animation: screen-shake 0.45s ease-out;
}
@keyframes screen-shake {
  0%   { transform: translate(0, 0); }
  15%  { transform: translate(-8px, 5px); }
  30%  { transform: translate(7px, -6px); }
  45%  { transform: translate(-6px, -4px); }
  60%  { transform: translate(5px, 6px); }
  75%  { transform: translate(-3px, 2px); }
  100% { transform: translate(0, 0); }
}

/* ═══ 对白文字特效（作用在文本 span 本身, 不影响说话人名） ═══ */
span.fx-angry {
  color: #fca5a5 !important;
  text-shadow: 0 0 1px #ef4444, 0 0 8px rgba(239, 68, 68, 0.55), 1.5px 0 0 rgba(220, 38, 38, 0.75), -1.5px 0 0 rgba(220, 38, 38, 0.75);
  animation: fx-angry-shake 0.12s linear infinite;
}
@keyframes fx-angry-shake {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-1px, 0.5px); }
  50% { transform: translate(1px, -0.5px); }
  75% { transform: translate(-0.5px, -0.5px); }
  100% { transform: translate(0, 0); }
}

span.fx-shock {
  color: #fef08a !important;
  text-shadow: 0 0 2px #facc15, 0 0 10px rgba(250, 204, 21, 0.8), 0 0 22px rgba(250, 204, 21, 0.45);
  animation: fx-shock-flash 0.7s steps(2, jump-none) infinite;
}
@keyframes fx-shock-flash {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.82; filter: brightness(1.35); }
}

span.fx-sad {
  color: #93c5fd !important;
  text-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
  filter: drop-shadow(0 1.5px 0 rgba(30, 58, 138, 0.55));
  animation: fx-sad-sink 2.6s ease-in-out infinite;
}
@keyframes fx-sad-sink {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(1.5px); opacity: 0.85; }
}

span.fx-happy {
  color: #fde68a !important;
  text-shadow: 0 0 2px #fbbf24, 0 0 9px rgba(251, 191, 36, 0.55);
  animation: fx-happy-bounce 0.9s ease-in-out infinite;
}
@keyframes fx-happy-bounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-2px) rotate(-0.6deg); }
  60% { transform: translateY(0.5px) rotate(0.6deg); }
}

span.fx-whisper {
  color: rgba(226, 232, 240, 0.78) !important;
  font-style: italic;
  letter-spacing: 0.04em;
  text-shadow: 0 0 4px rgba(148, 163, 184, 0.25);
  animation: fx-whisper-breathe 2.8s ease-in-out infinite;
}
@keyframes fx-whisper-breathe {
  0%, 100% { opacity: 0.78; }
  50% { opacity: 0.52; }
}

/* ═══ 对白文字大小（dt-xxx, 与特效类可叠加） ═══ */
span.dt-small  { font-size: 0.8rem  !important; }
span.dt-medium { font-size: 1rem    !important; }
span.dt-large  { font-size: 1.35rem !important; }
span.dt-xlarge { font-size: 1.8rem  !important; line-height: 1.35; }


</style>
