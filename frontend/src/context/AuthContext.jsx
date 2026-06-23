import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { api, setToken, clearToken } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  // Lazy initializer: loading starts true only when a stored token exists and
  // needs verification against the server.  If there is no token the user is
  // definitely logged out — starting false avoids a synchronous setLoading(false)
  // inside the effect body, which would trigger an extra render and violates the
  // react-hooks/set-state-in-effect lint rule.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('cc_token')))

  // On mount: verify stored token and load user
  useEffect(() => {
    const token = localStorage.getItem('cc_token')
    // No token → loading is already false (set by lazy initializer above); nothing to do.
    if (!token) return

    api.get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(err => {
        // Only wipe the token on 401 (invalid/expired/revoked JWT).
        // Any other error (500, network down) is transient — don't log the user out.
        if (err.status === 401) clearToken()
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const { token, user } = await api.post('/auth/login', { username, password })
    setToken(token)
    setUser(user)
    return user
  }, [])

  const signup = useCallback(async (formData) => {
    const data = await api.post('/auth/signup', formData)
    // Hard-gate: backend returns { pending: true, email } when email verification
    // is required. No token is issued until the user clicks the link.
    if (data.pending) return { pending: true, email: data.email }
    // Fallback for any future codepath that skips verification (e.g. admin-created accounts)
    setToken(data.token)
    setUser(data.user)
    return { pending: false }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const updateSettings = useCallback(async (fields) => {
    // When an email change triggers re-verification, the response includes
    // requiresVerification: true alongside the updated user. Return the full
    // response so callers can branch on that flag (e.g. show "check your inbox"
    // instead of "saved"). setUser still runs so emailVerified flips to false
    // in AuthContext, which causes ProtectedRoute to redirect to /verify-pending.
    const res = await api.patch('/auth/settings', fields)
    setUser(res.user)
    return res   // { user, requiresVerification? }
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword, confirmPassword) => {
    return api.patch('/auth/change-password', { currentPassword, newPassword, confirmPassword })
  }, [])

  const deleteAccount = useCallback(async (password) => {
    await api.delete('/auth/account', { password })
    clearToken()
    setUser(null)
  }, [])

  // Derived convenience flags so consumers don't have to do user?.isAdmin checks
  const isAdmin     = Boolean(user?.isAdmin)
  const isModerator = Boolean(user?.isModerator)

  // Memoize the value object so all consumers only re-render when something
  // actually changed. Without this, every AuthProvider render (e.g. from a
  // parent re-render) creates a new object reference and forces every useAuth()
  // consumer to re-render even if user/loading haven't moved.
  const value = useMemo(() => ({
    user, loading,
    login, signup, logout, updateSettings, changePassword, deleteAccount,
    isAdmin, isModerator,
  }), [user, loading, isAdmin, isModerator, login, signup, logout, updateSettings, changePassword, deleteAccount])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
