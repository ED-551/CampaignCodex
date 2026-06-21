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

  if (!user) return <Navigate to="/" replace />
  if (adminOnly     && !isAdmin)                  return <Navigate to="/dashboard" replace />
  if (moderatorOnly && !isAdmin && !isModerator)  return <Navigate to="/dashboard" replace />

  return children
}
