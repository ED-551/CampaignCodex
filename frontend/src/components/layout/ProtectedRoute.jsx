import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Wraps routes that require authentication.
 * Shows nothing while auth is loading (prevents flash of login page).
 * Redirects to / if no user is found.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-codex-bg flex items-center justify-center">
        <div className="text-codex-muted text-sm animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />
  if (adminOnly && !user.isAdmin) return <Navigate to="/dashboard" replace />

  return children
}
