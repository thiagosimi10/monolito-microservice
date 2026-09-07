import axios from 'axios'

// The browser talks to the backend directly. Inside Docker the backend is
// published on the host at localhost:8000, so that is the default base URL.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL })

export function extractError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg).join('; ')
  }
  if (typeof detail === 'string') {
    return detail
  }
  return fallback
}
