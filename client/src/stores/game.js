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
    loadScene(res.scene)
  }

  function loadScene(scene) {
    if (choiceDelayId.value) { clearTimeout(choiceDelayId.value); choiceDelayId.value = null }
    clearInterval(timerInterval.value)
    showingChoices.value = false

    currentScene.value = scene
    isEnding.value = scene.is_ending && scene.ending
    if (scene.ending) ending.value = scene.ending
    else ending.value = null

    startPlayTimer()
    autoSave()
  }

  async function autoSave() {
    if (!currentScene.value) return
    try {
      await post('/saves', {
        slot: 0,
        scene_id: currentScene.value.id,
        game_id: currentScene.value.game_id || null,
        title: currentScene.value.title,
        play_time: playSeconds.value,
        audio_label: localStorage.getItem('plot_game_audio_label') || null,
        sub_label: localStorage.getItem('plot_game_sub_label') || null
      })
    } catch (e) { /* 静默失败 */ }
  }

  async function continueGame() {
    try {
      const res = await get('/saves/auto')
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
      toast.show('-1 💎 剩余 ' + res.points_balance)
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

  async function saveGame(slot, title) {
    if (!currentScene.value) { toast.show('没有进行中的游戏'); return false }
    const res = await post('/saves', {
      slot,
      scene_id: currentScene.value.id,
      game_id: currentScene.value.game_id || null,
      title: title || currentScene.value.title,
      play_time: playSeconds.value,
      audio_label: localStorage.getItem('plot_game_audio_label') || null,
      sub_label: localStorage.getItem('plot_game_sub_label') || null
    })
    if (res.error) { toast.show(res.error); return false }
    toast.show('存档成功！')
    return true
  }

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

  async function fetchGameSaves(gameId) {
    const res = await get('/saves', { game_id: gameId })
    return res.saves || []
  }

  function returnToLobby() {
    cleanup()
    currentScene.value = null
  }

  return {
    currentScene, isEnding, ending,
    choiceDelayId, timerInterval, showingChoices, currentAudioEl,
    playSeconds,
    startNewGame, loadScene, makeChoice,
    saveGame, loadGame, continueGame, autoSave, fetchGameSaves,
    startPlayTimer, stopPlayTimer,
    cleanup, returnToLobby
  }
})
