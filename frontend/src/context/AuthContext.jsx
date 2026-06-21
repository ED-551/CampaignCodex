import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken, clearToken } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)   // true on first load

  // On mount: verify stored token and load user
  useEffect(() => {
    const token = localStorage.getItem('cc_token')
    if (!token) { setLoading(false); return }

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
    const { token, user } = await api.post('/auth/signup', formData)
    setToken(token)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const updateSettings = useCallback(async (fields) => {
    const { user: updated } = await api.patch('/auth/settings', fields)
    setUser(updated)
    return updated
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

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateSettings, changePassword, deleteAccount, isAdmin, isModerator }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
