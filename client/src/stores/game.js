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
  const affections = ref({})
  const characters = ref([])
  const isEnding = ref(false)
  const ending = ref(null)
  const choiceDelayId = ref(null)
  const timerInterval = ref(null)
  const showingChoices = ref(false)
  const currentAudioEl = ref(null)

  function langParam() {
    const l = langStore.current
    return l && l !== 'zh' ? { lang: l } : {}
  }

  async function startNewGame(gameId) {
    const params = gameId ? { game_id: gameId, ...langParam() } : langParam()
    const res = await get('/play/start', params)
    if (res.error) { toast.show(res.error); return }
    affections.value = {}
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
    if (scene.characters) characters.value = scene.characters
  }

  async function makeChoice(choiceId) {
    clearInterval(timerInterval.value)
    showingChoices.value = false
    if (choiceDelayId.value) { clearTimeout(choiceDelayId.value); choiceDelayId.value = null }

    let res
    try {
      res = await post('/play/choose', {
        choice_id: choiceId,
        scene_id: currentScene.value.id,
        affections: affections.value
      })
    } catch (e) {
      if (e.status === 402) {
        return { insufficientPoints: true, required: e.data.required, current: e.data.current, message: e.data.message }
      }
      toast.show(e.message)
      return null
    }
    if (res.error) { toast.show(res.error); return null }

    // 更新积分
    if (res.points_consumed && res.points_balance !== undefined) {
      if (authStore.user) authStore.user.points = res.points_balance
      toast.show('-1 💎 剩余 ' + res.points_balance)
    }

    affections.value = res.affections || {}

    if (res.next_scene_id) {
      const sceneRes = await get('/play/scene/' + res.next_scene_id, {
        affections: JSON.stringify(affections.value),
        ...langParam()
      })
      if (sceneRes.scene) {
        loadScene(sceneRes.scene)
        return { scene: sceneRes.scene, changes: res.affection_changes }
      } else {
        toast.show('场景加载失败')
        return null
      }
    } else {
      toast.show('故事完结')
      return { finished: true, changes: res.affection_changes }
    }
  }

  async function saveGame(slot, title) {
    if (!currentScene.value) { toast.show('没有进行中的游戏'); return false }
    const res = await post('/saves', {
      slot,
      scene_id: currentScene.value.id,
      title: title || currentScene.value.title,
      play_time: 0,
      affections: affections.value
    })
    if (res.error) { toast.show(res.error); return false }
    toast.show('存档成功！')
    return true
  }

  async function loadGame(saveId) {
    const res = await get('/saves/' + saveId + '/load')
    if (res.error) { toast.show(res.error); return false }
    const save = res.save

    affections.value = {}
    if (save.affections) {
      save.affections.forEach(a => { affections.value[a.character_id] = a.value })
    }

    const sceneRes = await get('/play/scene/' + save.scene_id, {
      affections: JSON.stringify(affections.value),
      ...langParam()
    })
    if (sceneRes.scene) {
      loadScene(sceneRes.scene)
      toast.show('读档成功！')
      return true
    } else {
      toast.show('场景加载失败')
      return false
    }
  }

  async function fetchCharacters() {
    const res = await get('/characters')
    if (res.characters) characters.value = res.characters
    return res.characters || []
  }

  async function fetchEndings() {
    const res = await get('/endings')
    return res.endings || []
  }

  async function fetchMyEndings() {
    const res = await get('/endings/my')
    return res.endings || []
  }

  function cleanup() {
    clearInterval(timerInterval.value)
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
    currentScene, affections, characters, isEnding, ending,
    choiceDelayId, timerInterval, showingChoices, currentAudioEl,
    startNewGame, loadScene, makeChoice,
    saveGame, loadGame,
    fetchCharacters, fetchEndings, fetchMyEndings,
    cleanup, returnToLobby
  }
})
