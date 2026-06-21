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
    // Global 401 handler — token expired or revoked mid-session.
    // Clear the stale token and reload to the landing page so AuthContext
    // re-initialises cleanly rather than leaving the user in a broken state.
    if (res.status === 401) {
      clearToken()
      window.location.href = '/'
      return  // unreachable after redirect, but prevents the throw firing
    }
    const err  = new Error(data.error || `Request failed: ${res.status}`)
    err.status = res.status
    throw err
  }

  return data
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path, body)   => request('DELETE', path, body),
}
