function normalizeMediaPath(path) {
  if (!path) return ''
  return '/' + String(path).replace(/\\/g, '/').replace(/^\/+/, '')
}

function waitForElementReady(el, timeout = 8000) {
  return new Promise((resolve) => {
    let done = false
    let timer = null

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      el.removeEventListener('canplay', onReady)
      el.removeEventListener('error', onError)
    }

    const finish = (ok) => {
      if (done) return
      done = true
      cleanup()
      try { el.pause() } catch (e) { /* ignore */ }
      resolve(ok)
    }

    const onReady = () => finish(true)
    const onError = () => finish(false)

    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      finish(true)
      return
    }

    timer = setTimeout(() => finish(false), timeout)
    el.addEventListener('canplay', onReady)
    el.addEventListener('error', onError)
    el.load()
  })
}

function findPreferredAudio(audios = [], lang = 'zh', savedLabel = '') {
  if (!Array.isArray(audios) || audios.length === 0) return null
  if (savedLabel) {
    const saved = audios.find((item) => item.label === savedLabel)
    if (saved) return saved
  }
  const langMatched = audios.find((item) => item.language === lang)
  if (langMatched) return langMatched
  const defaultMatched = audios.find((item) => item.is_default)
  return defaultMatched || audios[0] || null
}

function preloadUrl(url, tagName, timeout = 8000) {
  if (!url) return Promise.resolve(false)
  const el = document.createElement(tagName)
  el.preload = 'auto'
  el.src = url
  return waitForElementReady(el, timeout)
}

export function getSceneMediaUrls(scene, lang = 'zh', savedAudioLabel = '') {
  if (!scene) return { videoUrl: '', audioUrl: '' }
  const videoUrl = normalizeMediaPath(scene.file_path)
  const audio = findPreferredAudio(scene.audios || [], lang, savedAudioLabel)
  const audioUrl = normalizeMediaPath(audio?.file_path || '')
  return { videoUrl, audioUrl }
}

export async function preloadSceneMedia(scene, options = {}) {
  const { lang = 'zh', savedAudioLabel = '', timeout = 8000 } = options
  const { videoUrl, audioUrl } = getSceneMediaUrls(scene, lang, savedAudioLabel)
  const [videoReady, audioReady] = await Promise.all([
    preloadUrl(videoUrl, 'video', timeout),
    audioUrl ? preloadUrl(audioUrl, 'audio', timeout) : Promise.resolve(true)
  ])
  return { videoReady, audioReady }
}

export function waitForVideoElementReady(videoEl, timeout = 8000) {
  if (!videoEl) return Promise.resolve(false)
  return waitForElementReady(videoEl, timeout)
}
