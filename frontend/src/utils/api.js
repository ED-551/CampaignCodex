/**
 * Thin API wrapper.
 * - Reads JWT from localStorage
 * - Attaches Authorization header automatically
 * - Throws on non-OK responses with the server's error message
 */

const BASE = '/api'

function getToken() {
  return localStorage.getItem('cc_token')
}

export function setToken(token) {
  localStorage.setItem('cc_token', token)
}

export function clearToken() {
  localStorage.removeItem('cc_token')
}

async function request(method, path, body) {
  const token   = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err  = new Error(data.error || `Request failed: ${res.status}`)
    err.status = res.status
    throw err
  }

  return data
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path, body)   => request('DELETE', path, body),
}
