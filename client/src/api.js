
const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  ''
).replace(/\/$/, '')
const ADMIN_TOKEN = 'question-desk-session'

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN) || ''
}

export function setAdminToken(value) {
  localStorage.removeItem('question-desk-admin')
  if (value) localStorage.setItem(ADMIN_TOKEN, value)
  else localStorage.removeItem(ADMIN_TOKEN)
}

export async function api(path, { admin = false, body, method = 'GET', headers = {} } = {}) {
  const requestHeaders = { ...headers }
  if (admin) requestHeaders['x-admin-token'] = getAdminToken()
  let payload = body
  if (body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, { method, headers: requestHeaders, body: payload })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}
