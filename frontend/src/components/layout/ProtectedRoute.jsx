import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Wraps routes that require authentication.
 * Shows nothing while auth is loading (prevents flash of login page).
 * Redirects to / if no user is found.
 *
 * Props:
 *   adminOnly     — only admins may access
 *   moderatorOnly — admins and moderators may access
 *
 * Guards (in order):
 *   1. Loading spinner while AuthContext resolves.
 *   2. No user → redirect to / (not logged in).
 *   3. Banned user → redirect to / (the API already 403s every request for
 *      banned accounts; this ensures the UI doesn't render protected content).
 *   4. Unverified email → redirect to /verify-pending (defensive — login already
 *      hard-gates on email_verified, but this catches edge cases like a direct
 *      DB update resetting the flag on an existing session).
 *   5. adminOnly / moderatorOnly role checks.
 */
export default function ProtectedRoute({ children, adminOnly = false, moderatorOnly = false }) {
  const { user, loading, isAdmin, isModerator } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-codex-bg flex items-center justify-center">
        <div className="text-codex-muted text-sm animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!user)                                      return <Navigate to="/" replace />
  // Banned users get 403 on every API call — redirect to landing rather than
  // leaving them stuck on a page that can't load any data.
  if (user.isBanned)                              return <Navigate to="/" replace />
  // Unverified email should not access any protected page.
  if (user.emailVerified === false)               return <Navigate to="/verify-pending" replace />
  if (adminOnly     && !isAdmin)                  return <Navigate to="/dashboard" replace />
  if (moderatorOnly && !isAdmin && !isModerator)  return <Navigate to="/dashboard" replace />

  return children
}
