import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft, BookOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'

export default function ModeratorDashboard() {
  const { logout }                  = useAuth()
  const navigate                    = useNavigate()
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [banTarget, setBanTarget]   = useState(null)  // { id, username }
  const [banReason, setBanReason]   = useState('')
  const [banDuration, setBanDuration] = useState('permanent')
  const [banError, setBanError]     = useState('')
  const [error, setError]           = useState('')

  useEffect(() => {
    api.get('/admin/moderator/users')
      .then(res => setUsers(res.users ?? []))
      .catch(err => setError(err.message ?? 'Failed to load users.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleBan(userId) {
    if (!banReason.trim()) { setBanError('A reason is required.'); return }
    setBanError('')
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/ban`, {
        isBanned:  true,
        reason:    banReason.trim(),
        duration:  banDuration,
      })
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_banned: true, ban_reason: banReason.trim() } : u
      ))
      setBanTarget(null)
      setBanReason('')
      setBanDuration('permanent')
    } catch (err) {
      setBanError(err.message ?? 'Ban failed.')
    }
  }

  async function handleUnban(userId) {
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/ban`, { isBanned: false })
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_banned: false, ban_reason: null } : u
      ))
    } catch (err) {
      setError(err.message ?? 'Unban failed.')
    }
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  return (
    <div className="min-h-screen bg-codex-bg">
      {/* Nav */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-codex-gold" />
            <span className="font-display text-sm text-codex-gold tracking-wide">CampaignCodex</span>
            <span className="text-codex-border">·</span>
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Shield size={11} /> Moderation Panel
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xs text-codex-subtext hover:text-codex-text transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Dashboard
            </Link>
            <button onClick={handleLogout} className="text-xs text-codex-subtext hover:text-codex-text transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Shield size={20} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-semibold text-codex-text">Moderation Panel</h1>
            <p className="text-sm text-codex-subtext mt-0.5">View and moderate user accounts</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-codex-muted animate-pulse py-24">Loading users…</div>
        ) : (
          <div className="bg-codex-surface border border-codex-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-codex-border text-left">
                  <Th>Username</Th>
                  <Th>Email</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={`border-b border-codex-border/40 ${i % 2 === 0 ? '' : 'bg-codex-card/30'}`}>
                    <Td>
                      <span className="text-codex-text font-medium">{u.username}</span>
                    </Td>
                    <Td><span className="text-codex-subtext">{u.email}</span></Td>
                    <Td>{new Date(u.created_at).toLocaleDateString()}</Td>
                    <Td>
                      {u.is_banned ? (
                        <div>
                          <span className="text-xs font-semibold text-red-400">Banned</span>
                          {u.ban_reason && (
                            <p className="text-[10px] text-codex-muted mt-0.5 max-w-[160px] truncate" title={u.ban_reason}>
                              {u.ban_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-400">Active</span>
                      )}
                    </Td>
                    <Td>
                      {u.is_banned ? (
                        <button
                          onClick={() => handleUnban(u.id)}
                          className="text-xs px-3 py-1.5 rounded border border-codex-border text-codex-subtext
                            hover:text-codex-text hover:border-codex-text/40 transition-colors"
                        >
                          Unban
                        </button>
                      ) : banTarget?.id === u.id ? (
                        /* Inline ban confirmation */
                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                          {/* Duration */}
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { value: '1day',      label: '1d'   },
                              { value: '1week',     label: '1w'   },
                              { value: '1month',    label: '1mo'  },
                              { value: 'permanent', label: 'Perm' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setBanDuration(opt.value)}
                                className={`py-1 rounded border text-[10px] font-medium transition-all ${
                                  banDuration === opt.value
                                    ? 'border-red-500/60 bg-red-500/15 text-red-300'
                                    : 'border-codex-border text-codex-muted hover:border-red-500/30 hover:text-red-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {/* Reason — required */}
                          <input
                            type="text"
                            value={banReason}
                            onChange={e => { setBanReason(e.target.value); if (banError) setBanError('') }}
                            placeholder="Reason (required)"
                            maxLength={200}
                            autoFocus
                            className={`w-full bg-codex-bg border rounded px-2 py-1 text-xs
                              text-codex-text placeholder-codex-muted focus:outline-none transition-colors ${
                              banError ? 'border-red-500/60' : 'border-codex-border focus:border-red-500/50'
                            }`}
                          />
                          {banError && <p className="text-[10px] text-red-400">{banError}</p>}
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleBan(u.id)}
                              disabled={!banReason.trim()}
                              className="text-xs px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => { setBanTarget(null); setBanReason(''); setBanDuration('permanent'); setBanError('') }}
                              className="text-xs px-2.5 py-1 rounded border border-codex-border text-codex-muted hover:text-codex-text transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setBanTarget({ id: u.id, username: u.username }); setBanReason('') }}
                          className="text-xs px-3 py-1.5 rounded border border-red-500/30 text-red-400
                            hover:bg-red-500/10 hover:border-red-500/60 transition-colors"
                        >
                          Ban
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center text-codex-muted text-sm py-12">No users found.</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-medium text-codex-subtext">{children}</th>
}
function Td({ children }) {
  return <td className="px-4 py-3 text-xs text-codex-text">{children}</td>
}
