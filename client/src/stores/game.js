import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { useLangStore } from './lang'
import { useAuthStore } from './auth'

export const useGameStore = defineStore('game', () => {
  const { get, post } = useApi()
  const toast = useToast()
  const langStore = useLangStore()
  const authStore = useAuthStore()

  const currentScene = ref(null)
  const isEnding = ref(false)
  const ending = ref(null)
  const currentGameId = ref(null)  // 持久化，returnToLobby 不清理
  const themeConfig = ref(null)    // 选项主题样式配置（从 /play/start 返回）
  const sceneHistory = ref([])     // 场景历史栈（存 scene id），供"返回上一场景"
  const gameAttributes = ref([])           // 游戏自定义属性 [{id, attr_key, name, value}]（value 为当前值）
  const dialogueEffectMap = ref({})        // 对白选项影响表 {dialogue_id: [{attr_id, delta}]}
  const attrChangeAnims = ref([])          // 属性变化飘字 [{id, name, delta, color}]
  const choiceDelayId = ref(null)
  const timerInterval = ref(null)
  const showingChoices = ref(false)
  const currentAudioEl = ref(null)
  const playSeconds = ref(0)
  // ═══ 玩家角色命名（随自动档存服务端, 属性栏首位展示） ═══
  const playerName = ref('')            // 当前角色名（开始时命名/随机生成, 读档恢复）
  const pendingPlayerName = ref(null)   // 命名弹窗确认后暂存, GamePlayer 挂载 startNewGame 时消费
  let playTimer = null

  // 随机名生成：中文单姓 + 名组合（60 姓 × 80 名 ≈ 4800 种）
  const RAND_SURNAMES = [
    '云', '沈', '顾', '江', '苏', '林', '叶', '秦', '白', '陆',
    '宋', '楚', '萧', '裴', '温', '韩', '祁', '简', '谢', '段',
    '程', '许', '崔', '傅', '卫', '凌', '骆', '容', '闻', '姜',
    '殷', '纪', '封', '阮', '辜', '兰', '季', '贺', '时', '施',
    '聂', '岳', '谭', '章', '曾', '龚', '常', '茅', '翟', '闵',
    '蔚', '尹', '席', '薛', '甄', '桑', '宁', '钟', '乔', '霍'
  ]
  const RAND_GIVENS = [
    '平', '川', '岚', '澈', '野', '洲', '昀', '澜', '砚', '行',
    '舟', '越', '衡', '衍', '宸', '蔚', '霁', '霜', '叙', '谦',
    '知远', '暮白', '清晏', '听澜', '云舟', '亦风', '南絮', '北辰', '疏影', '青梧',
    '见山', '怀瑾', '无恙', '长明', '三省', '九思', '逸辰', '子昂', '若谷', '临风',
    '斯年', '望舒', '既明', '朝雨', '星野', '墨白', '止戈', '归远', '拾光', '照野',
    '春池', '听雪', '抚琴', '染墨', '沉舟', '拂晓', '折枝', '寄舟', '问渠', '执一',
    '澄', '珉', '钧', '陌', '栖', '晏', '沐', '卿', '珩', '望',
    '昀安', '知微', '清和', '长庚', '流光', '未晞', '无咎', '守拙', '抱朴', '观棋'
  ]
  function randomPlayerName() {
    const s = RAND_SURNAMES[Math.floor(Math.random() * RAND_SURNAMES.length)]
    const g = RAND_GIVENS[Math.floor(Math.random() * RAND_GIVENS.length)]
    return s + g
  }

  // ═══ 场景对白选项记忆（在场景中选过但未过场景时, 重进保留上次选择且不允许改选其他） ═══
  // 结构 { [sceneId]: { options: { [optionNodeId]: chosenChildId } } }
  // localStorage 持久化（key 按 用户+游戏 隔离）: 关页面/换标签页/隔天继续游戏都保留
  const DIALOGUE_HIST_PREFIX = 'pg_dialogue_history'
  function dialogueHistKey() {
    return `${DIALOGUE_HIST_PREFIX}_u${authStore.user?.id ?? 'anon'}_g${currentGameId.value ?? 'any'}`
  }
  let dialogueHistLoadedKey = null
  const dialogueHistory = ref({})
  function ensureDialogueHistory() {
    const key = dialogueHistKey()
    if (dialogueHistLoadedKey === key) return
    dialogueHistLoadedKey = key
    try {
      const v = JSON.parse(localStorage.getItem(key))
      dialogueHistory.value = v && typeof v === 'object' ? v : {}
    } catch { dialogueHistory.value = {} }
  }
  function persistDialogueHistory() {
    ensureDialogueHistory()
    try { localStorage.setItem(dialogueHistKey(), JSON.stringify(dialogueHistory.value)) } catch { /* ignore */ }
  }
  function recordDialogueChoice(sceneId, optionNodeId, childId) {
    ensureDialogueHistory()
    const key = String(sceneId)
    const h = dialogueHistory.value[key] || (dialogueHistory.value[key] = { options: {} })
    if (!h.options) h.options = {}
    h.options[String(optionNodeId)] = childId
    persistDialogueHistory()
  }
  function getRecordedChoice(sceneId, optionNodeId) {
    ensureDialogueHistory()
    return dialogueHistory.value[String(sceneId)]?.options?.[String(optionNodeId)] || null
  }
  function clearSceneDialogueHistory(sceneId) {
    ensureDialogueHistory()
    if (dialogueHistory.value[String(sceneId)]) {
      delete dialogueHistory.value[String(sceneId)]
      persistDialogueHistory()
    }
  }
  function clearAllDialogueHistory() {
    ensureDialogueHistory()
    dialogueHistory.value = {}
    persistDialogueHistory()
  }

  function langParam() {
    const l = langStore.current
    return l && l !== 'zh' ? { lang: l } : {}
  }

  function startPlayTimer() {
    stopPlayTimer()
    playTimer = setInterval(() => { playSeconds.value++ }, 1000)
  }

  function stopPlayTimer() {
    if (playTimer) { clearInterval(playTimer); playTimer = null }
  }

  async function startNewGame(gameId, name) {
    const params = gameId ? { game_id: gameId, ...langParam() } : langParam()
    const res = await get('/play/start', params)
    if (res.error) { toast.show(res.error); return }
    playSeconds.value = 0
    sceneHistory.value = []   // 新游戏清空历史
    clearAllDialogueHistory()  // 重玩：清空全部场景对白选择记忆（重新可自由选择）
    // 角色名：优先用本次命名, 其次保留旧名（结局页重开不改名）, 都没有则随机生成
    playerName.value = (typeof name === 'string' && name.trim())
      ? name.trim().slice(0, 24)
      : (playerName.value || randomPlayerName())
    themeConfig.value = res.theme_config || null
    // 游戏属性：重玩清零 —— 一律按定义重置（初始值统一 0），影响表重建
    gameAttributes.value = (res.scene?.attributes || []).map(a => ({
      id: a.id, attr_key: a.attr_key, name: a.name,
      value: 0, sort_order: a.sort_order
    }))
    const effMap = {}
    for (const e of (res.scene?.dialogue_effects || [])) {
      if (!effMap[e.dialogue_id]) effMap[e.dialogue_id] = []
      effMap[e.dialogue_id].push({ attr_id: e.attr_id, delta: e.delta })
    }
    dialogueEffectMap.value = effMap
    loadScene(res.scene)
  }

  // 应用对白选项的属性影响（本地立即反馈 + 服务端权威结算），返回变化列表
  async function applyDialogueEffects(dialogueId) {
    const effects = dialogueEffectMap.value[dialogueId] || []
    if (!effects.length) return []
    // 关键：先快照结算"前"的值（服务端按影响表对快照做一次结算）
    // 若传结算后的值会双倍结算（服务端再加一次 delta）
    const before = Object.fromEntries(gameAttributes.value.map(a => [a.id, a.value]))
    // 本地即时显示（按服务端同规则钳制 0）
    const local = []
    for (const e of effects) {
      const attr = gameAttributes.value.find(a => a.id === e.attr_id)
      if (!attr) continue
      const oldVal = attr.value
      attr.value = Math.max(0, oldVal + (parseInt(e.delta) || 0))
      local.push({ attr_id: attr.id, name: attr.name, delta: attr.value - oldVal, new_value: attr.value })
    }
    pushAttrAnims(local)
    // 服务端 authoritative：用结算前快照结算, 返回值覆盖本地（一致时无感知）
    try {
      const res = await post('/play/dialogue-choice', {
        dialogue_id: dialogueId,
        attributes: before
      })
      if (res && res.attributes) {
        for (const [id, val] of Object.entries(res.attributes)) {
          const attr = gameAttributes.value.find(a => a.id === parseInt(id))
          if (attr) attr.value = val
        }
      }
      // 结算完成后立即刷新自动存档快照：否则本场景内选完直接刷新/继续游戏,
      // 读档会恢复旧快照, 属性加成"丢了"（快照只随 loadScene 写入是原缺陷）
      autoSave()
      return res?.changes || local
    } catch (e) {
      autoSave()
      return local
    }
  }

  // 属性变化飘字（自动消失）
  let attrAnimId = 0
  function pushAttrAnims(changes) {
    for (const c of changes) {
      const id = ++attrAnimId
      attrChangeAnims.value.push({ id, name: c.name, delta: c.delta })
      setTimeout(() => {
        attrChangeAnims.value = attrChangeAnims.value.filter(a => a.id !== id)
      }, 2200)
    }
  }

  // options.backtrack = true 表示回退加载（不把当前场景压入历史栈）
  function loadScene(scene, options = {}) {
    if (choiceDelayId.value) { clearTimeout(choiceDelayId.value); choiceDelayId.value = null }
    clearInterval(timerInterval.value)
    showingChoices.value = false

    // 前进加载：当前场景压入历史栈（回退/重复加载不压栈）
    if (currentScene.value && !options.backtrack && currentScene.value.id !== scene.id) {
      sceneHistory.value.push(currentScene.value.id)
    }

    currentScene.value = scene
    if (scene.game_id) currentGameId.value = scene.game_id
    isEnding.value = scene.is_ending && scene.ending
    if (scene.ending) ending.value = scene.ending
    else ending.value = null

    // 属性定义/影响表随场景刷新（保留已累计的 value；首次拿到定义时初始化 value）
    if (Array.isArray(scene.attributes)) {
      for (const a of scene.attributes) {
        const known = gameAttributes.value.find(x => x.id === a.id)
        if (known) {
          known.attr_key = a.attr_key; known.name = a.name
        } else {
          gameAttributes.value.push({ ...a, value: a.default_value || 0 })
        }
      }
    }
    if (Array.isArray(scene.dialogue_effects) && Object.keys(dialogueEffectMap.value).length === 0) {
      const effMap = {}
      for (const e of scene.dialogue_effects) {
        if (!effMap[e.dialogue_id]) effMap[e.dialogue_id] = []
        effMap[e.dialogue_id].push({ attr_id: e.attr_id, delta: e.delta })
      }
      dialogueEffectMap.value = effMap
    }

    startPlayTimer()
    // skipAutoSave: 读档流程中由 loadGame 在属性快照恢复完成后统一写自动档,
    // 避免此刻先用"默认值0"的属性覆盖掉好快照
    if (!options.skipAutoSave) autoSave()
  }

  // 返回上一场景（扣积分，数额后台 backtrack_cost 配置）
  // 返回 { ok, insufficientPoints, required, current } 或 null（无历史/失败）
  async function backtrack() {
    if (!sceneHistory.value.length) { toast.show('没有可返回的场景'); return null }
    const prevId = sceneHistory.value[sceneHistory.value.length - 1]

    let res
    try {
      res = await post('/play/backtrack', { to_scene_id: prevId, ...langParam() })
    } catch (e) {
      if (e.status === 402) {
        return { insufficientPoints: true, required: e.data.required, current: e.data.current }
      }
      toast.show(e.message || '返回失败')
      return null
    }
    if (res.error) { toast.show(res.error); return null }

    sceneHistory.value.pop()
    loadScene(res.scene, { backtrack: true })
    return { ok: true, point_cost: res.point_cost, points_balance: res.points_balance }
  }

  // 过场景自动存档：slot = -game_id（每游戏独立一份自动档，与手动档 slot 1-9 区分）
  async function autoSave() {
    if (!currentScene.value) return
    try {
      await post('/saves', {
        slot: currentScene.value.game_id ? -currentScene.value.game_id : 0,
        scene_id: currentScene.value.id,
        game_id: currentScene.value.game_id || null,
        title: currentScene.value.title,
        play_time: playSeconds.value,
        audio_label: localStorage.getItem('plot_game_audio_label') || null,
        sub_label: localStorage.getItem('plot_game_sub_label') || null,
        scene_history: sceneHistory.value.slice(),   // 历史栈随存档保存，读档后可继续返回
        attributes: Object.fromEntries(gameAttributes.value.map(a => [a.id, a.value])),  // 属性值快照
        player_name: playerName.value || null  // 角色命名随档持久化
      })
    } catch (e) { /* 静默失败 */ }
  }

  // 继续游戏：读取该游戏最近的自动存档
  async function continueGame(gameId) {
    try {
      const res = await get('/saves/auto', gameId ? { game_id: gameId } : {})
      if (res.save && res.save.scene_id) {
        return await loadGame(res.save.id)
      }
    } catch (e) { /* ignore */ }
    return false
  }

  async function makeChoice(choiceId) {
    clearInterval(timerInterval.value)
    showingChoices.value = false
    if (choiceDelayId.value) { clearTimeout(choiceDelayId.value); choiceDelayId.value = null }

    let res
    try {
      res = await post('/play/choose', {
        choice_id: choiceId,
        scene_id: currentScene.value.id
      })
    } catch (e) {
      if (e.status === 402) {
        return { insufficientPoints: true, required: e.data.required, current: e.data.current, message: e.data.message }
      }
      toast.show(e.message)
      return null
    }
    if (res.error) { toast.show(res.error); return null }

    if (res.points_consumed && res.points_balance !== undefined) {
      if (authStore.user) authStore.user.points = res.points_balance
      toast.show(`-${res.point_cost} 💎 剩余 ${res.points_balance}`)
    }

    if (res.next_scene_id) {
      // 过场景：清掉当前场景的对白选择记忆（下次再来可重新选择）
      if (currentScene.value) clearSceneDialogueHistory(currentScene.value.id)
      const sceneRes = await get('/play/scene/' + res.next_scene_id, langParam())
      if (sceneRes.scene) {
        loadScene(sceneRes.scene)
        return { scene: sceneRes.scene }
      } else {
        toast.show('场景加载失败')
        return null
      }
    } else {
      stopPlayTimer()
      return { finished: true }
    }
  }

  // 手动存档已移除：改为过场景自动存档（autoSave），读档入口为"继续游戏"（continueGame）

  async function loadGame(saveId) {
    const res = await get('/saves/' + saveId + '/load')
    if (res.error) { toast.show(res.error); return false }
    const save = res.save

    if (!save.scene_id) { toast.show('该存档的场景已被删除'); return false }

    // 恢复存档时的音轨/字幕选择
    if (save.audio_label) localStorage.setItem('plot_game_audio_label', save.audio_label)
    else localStorage.removeItem('plot_game_audio_label')
    if (save.sub_label) localStorage.setItem('plot_game_sub_label', save.sub_label)
    else localStorage.removeItem('plot_game_sub_label')

    playSeconds.value = save.play_time || 0
    playerName.value = save.player_name || ''  // 角色名随档恢复
    // 恢复存档的场景历史栈（旧存档无此字段时为空，无法返回）
    try {
      const h = save.history_json ? JSON.parse(save.history_json) : []
      sceneHistory.value = Array.isArray(h) ? h : []
    } catch { sceneHistory.value = [] }

    // 属性快照的恢复必须放在 loadScene 之后：刷新/继续游戏时 gameAttributes 初始为空,
    // 提前恢复是空操作, 随后 loadScene 会用 default_value(0) 重新定义属性把快照顶掉
    const sceneRes = await get('/play/scene/' + save.scene_id, langParam())
    if (sceneRes.scene) {
      loadScene(sceneRes.scene, { skipAutoSave: true })  // 先载入场景(定义属性), 暂不写自动档
      // 恢复属性快照到已定义的属性上
      try {
        const savedAttrs = save.attributes_json ? JSON.parse(save.attributes_json) : null
        if (savedAttrs && typeof savedAttrs === 'object') {
          for (const attr of gameAttributes.value) {
            if (savedAttrs[attr.id] !== undefined) attr.value = savedAttrs[attr.id]
          }
        }
      } catch { /* ignore */ }
      autoSave()  // 以恢复后的完整状态(场景+属性)重写自动档
      toast.show('读档成功！')
      return true
    } else {
      toast.show('场景加载失败')
      return false
    }
  }

  function cleanup() {
    clearInterval(timerInterval.value)
    stopPlayTimer()
    if (choiceDelayId.value) { clearTimeout(choiceDelayId.value); choiceDelayId.value = null }
    if (currentAudioEl.value) {
      try {
        if (typeof currentAudioEl.value.pause === 'function') currentAudioEl.value.pause()
        if (typeof currentAudioEl.value.remove === 'function') currentAudioEl.value.remove()
      } catch (e) { /* ignore */ }
      currentAudioEl.value = null
    }
    showingChoices.value = false
  }

  function returnToLobby() {
    cleanup()
    currentScene.value = null
  }

  return {
    currentScene, isEnding, ending, currentGameId, sceneHistory, themeConfig,
    gameAttributes, dialogueEffectMap, attrChangeAnims,
    choiceDelayId, timerInterval, showingChoices, currentAudioEl,
    playSeconds, playerName, pendingPlayerName, randomPlayerName,
    startNewGame, loadScene, makeChoice, backtrack,
    applyDialogueEffects,
    recordDialogueChoice, getRecordedChoice, clearSceneDialogueHistory, clearAllDialogueHistory,
    loadGame, continueGame, autoSave,
    startPlayTimer, stopPlayTimer,
    cleanup, returnToLobby
  }
})
