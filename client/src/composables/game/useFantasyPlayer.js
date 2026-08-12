/**
 * 幻想场景播放
 * 从 GamePlayer.vue 抽出，负责幻想视频的加载/播放/结束恢复
 */
import { ref, nextTick } from 'vue'
import Hls from 'hls.js'

export function useFantasyPlayer(videoEl, toast) {
  const fantasyPlaying = ref(false)
  const fantasyVideoEl = ref(null)
  let fantasyHls = null
  let fantasyResumeAt = 0

  async function playFantasy(video) {
    if (!video) { toast.show('幻想场景视频不存在'); return }
    const mainVideo = videoEl.value
    if (mainVideo) {
      fantasyResumeAt = mainVideo.currentTime || 0
      mainVideo.pause()
    }
    fantasyPlaying.value = true
    await nextTick()
    const fv = fantasyVideoEl.value
    if (!fv) return
    let src = ''
    if (video.hls_status === 'done' && video.hls_master_path) {
      src = '/' + video.hls_master_path.replace(/\\/g, '/')
    } else {
      src = '/' + (video.file_path || '').replace(/\\/g, '/')
    }
    if (Hls.isSupported() && video.hls_status === 'done') {
      fantasyHls = new Hls({ renderTextTracksNatively: true })
      fantasyHls.loadSource(src)
      fantasyHls.attachMedia(fv)
    } else {
      fv.src = src
    }
    fv.play().catch(() => {})
  }

  function onFantasyEnded() {
    if (fantasyHls) { try { fantasyHls.destroy() } catch(e) {} fantasyHls = null }
    fantasyPlaying.value = false
    const mainVideo = videoEl.value
    if (mainVideo) {
      mainVideo.currentTime = fantasyResumeAt
      mainVideo.play().catch(() => {})
    }
  }

  function cleanup() {
    if (fantasyHls) { try { fantasyHls.destroy() } catch(e) {} fantasyHls = null }
    fantasyPlaying.value = false
  }

  return { fantasyPlaying, fantasyVideoEl, playFantasy, onFantasyEnded, cleanup }
}
