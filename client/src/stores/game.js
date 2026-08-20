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
  const sceneHistory = ref([])     // 场景历史栈（存 scene id），供"返回上一场景"
  const choiceDelayId = ref(null)
  const timerInterval = ref(null)
  const showingChoices = ref(false)
  const currentAudioEl = ref(null)
  const playSeconds = ref(0)
  let playTimer = null

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

  async function startNewGame(gameId) {
    const params = gameId ? { game_id: gameId, ...langParam() } : langParam()
    const res = await get('/play/start', params)
    if (res.error) { toast.show(res.error); return }
    playSeconds.value = 0
    sceneHistory.value = []   // 新游戏清空历史
    loadScene(res.scene)
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

    startPlayTimer()
    autoSave()
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
        scene_history: sceneHistory.value.slice()   // 历史栈随存档保存，读档后可继续返回
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
    // 恢复存档的场景历史栈（旧存档无此字段时为空，无法返回）
    try {
      const h = save.history_json ? JSON.parse(save.history_json) : []
      sceneHistory.value = Array.isArray(h) ? h : []
    } catch { sceneHistory.value = [] }

    const sceneRes = await get('/play/scene/' + save.scene_id, langParam())
    if (sceneRes.scene) {
      loadScene(sceneRes.scene)
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
    currentScene, isEnding, ending, currentGameId, sceneHistory,
    choiceDelayId, timerInterval, showingChoices, currentAudioEl,
    playSeconds,
    startNewGame, loadScene, makeChoice, backtrack,
    loadGame, continueGame, autoSave,
    startPlayTimer, stopPlayTimer,
    cleanup, returnToLobby
  }
})
