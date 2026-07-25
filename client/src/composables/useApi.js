import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('plot_game_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r.data,
  err => {
    const status = err.response?.status
    const data = err.response?.data || {}
    const error = new Error(data.error || '请求失败')
    error.status = status
    error.data = data
    return Promise.reject(error)
  }
)

export function useApi() {
  return {
    get: (url, params) => api.get(url, { params }),
    post: (url, data) => api.post(url, data),
    put: (url, data) => api.put(url, data),
    del: (url) => api.delete(url),
    upload: (url, formData, onProgress) => {
      const token = localStorage.getItem('plot_game_token')
      return axios.post(url, formData, {
        baseURL: '/api',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: onProgress
      }).then(r => r.data)
    }
  }
}
