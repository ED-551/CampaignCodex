import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft, BookOpen, Search, Users, UserX, CheckCircle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import TierBadge from '../components/ui/TierBadge'

const PAGE_SIZE = 25

export default function ModeratorDashboard() {
  const { logout }                      = useAuth()
  const navigate                        = useNavigate()
  const [users, setUsers]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)

  // Ban state
  const [banTarget, setBanTarget]       = useState(null)   // { id, username }
  const [banReason, setBanReason]       = useState('')
  const [banDuration, setBanDuration]   = useState('permanent')
  const [banError, setBanError]         = useState('')

  useEffect(() => {
    api.get('/admin/moderator/users')
      .then(res => setUsers(res.users ?? []))
      .catch(err => setError(err.message ?? 'Failed to load users.'))
      .finally(() => setLoading(false))
  }, [])

  // ── Client-side filter + paginate ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  }, [users, search])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageSlice   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset to page 1 on search change
  useEffect(() => { setPage(1) }, [search])

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalUsers  = users.length
  const bannedCount = users.filter(u => u.is_banned).length
  const activeCount = totalUsers - bannedCount

  // ── Ban handlers ─────────────────────────────────────────────────────────────
  async function handleBan(userId) {
    if (!banReason.trim()) { setBanError('A reason is required.'); return }
    setBanError('')
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
    try {
      await api.patch(`/admin/users/${userId}/ban`, { isBanned: false })
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_banned: false, ban_reason: null, banned_until: null } : u
      ))
    } catch (err) {
      setError(err.message ?? 'Unban failed.')
    }
  }

  function openBan(u) {
    setBanTarget({ id: u.id, username: u.username })
    setBanReason('')
    setBanDuration('permanent')
    setBanError('')
  }

  function cancelBan() {
    setBanTarget(null)
    setBanReason('')
    setBanDuration('permanent')
    setBanError('')
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  return (
    <div className="min-h-screen bg-codex-bg">

      {/* ── Nav ── */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-codex-gold" />
            <span className="font-display text-sm text-codex-gold tracking-wide">CampaignCodex</span>
            <span className="text-codex-border">·</span>
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Shield size={11} /> Moderation Panel
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard"
              className="text-xs text-codex-subtext hover:text-codex-text transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Dashboard
            </Link>
            <button onClick={handleLogout}
              className="text-xs text-codex-subtext hover:text-codex-text transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Page title ── */}
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-semibold text-codex-text">Moderation Panel</h1>
            <p className="text-sm text-codex-subtext mt-0.5">Review and moderate user accounts</p>
          </div>
        </div>

        {/* ── Stats row ── */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={Users} label="Total Users" value={totalUsers} color="text-codex-gold" />
            <StatCard icon={CheckCircle} label="Active" value={activeCount} color="text-emerald-400" />
            <StatCard icon={UserX} label="Banned" value={bannedCount} color="text-red-400" />
          </div>
        )}

        {error && (
          <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-codex-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or email…"
            className="w-full bg-codex-surface border border-codex-border rounded-lg pl-8 pr-4 py-2
              text-sm text-codex-text placeholder-codex-muted
              focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20
              transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-codex-muted hover:text-codex-text"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* ── Table ── */}
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
                {pageSlice.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-codex-muted text-sm py-12">
                      {search ? 'No users match your search.' : 'No users found.'}
                    </td>
                  </tr>
                )}
                {pageSlice.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`border-b border-codex-border/40 ${i % 2 === 0 ? '' : 'bg-codex-card/30'}`}
                  >
                    {/* Username */}
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-codex-text font-medium">{u.username}</span>
                        <TierBadge tier={u.supporter_tier ?? 'free'} size={13} />
                      </div>
                    </Td>

                    {/* Email */}
                    <Td>
                      <span className="text-codex-subtext">{u.email}</span>
                    </Td>

                    {/* Joined */}
                    <Td>
                      <span className="text-codex-muted">
                        {new Date(u.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </Td>

                    {/* Status */}
                    <Td>
                      {u.is_banned ? (
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-red-400">Banned</span>
                          {u.ban_reason && (
                            <p className="text-[10px] text-codex-muted max-w-[160px] truncate" title={u.ban_reason}>
                              {u.ban_reason}
                            </p>
                          )}
                          {u.banned_until && (
                            <p className="text-[10px] text-codex-muted">
                              Until {new Date(u.banned_until).toLocaleDateString()}
                            </p>
                          )}
                          {!u.banned_until && u.is_banned && (
                            <p className="text-[10px] text-red-400/60">Permanent</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-400">Active</span>
                      )}
                    </Td>

                    {/* Action */}
                    <Td>
                      {u.is_banned ? (
                        <button
                          onClick={() => handleUnban(u.id)}
                          className="text-xs px-3 py-1.5 rounded border border-codex-border
                            text-codex-subtext hover:text-codex-text hover:border-codex-text/40
                            transition-colors"
                        >
                          Unban
                        </button>
                      ) : banTarget?.id === u.id ? (
                        /* Inline ban form */
                        <div className="flex flex-col gap-1.5 min-w-[220px]">
                          {/* Duration selector */}
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
                          {/* Reason */}
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
                              className="text-xs px-2.5 py-1 rounded bg-red-600 hover:bg-red-500
                                text-white font-semibold transition-colors
                                disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={cancelBan}
                              className="text-xs px-2.5 py-1 rounded border border-codex-border
                                text-codex-muted hover:text-codex-text transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openBan(u)}
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
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-codex-muted">
            <span>
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} users
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded border border-codex-border hover:border-codex-text/40
                  hover:text-codex-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-codex-subtext">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded border border-codex-border hover:border-codex-text/40
                  hover:text-codex-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-codex-surface border border-codex-border rounded-xl px-5 py-4 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-lg bg-codex-card flex items-center justify-center ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xl font-bold text-codex-text">{value}</p>
        <p className="text-xs text-codex-muted mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-medium text-codex-subtext">{children}</th>
}
function Td({ children }) {
  return <td className="px-4 py-3 text-xs text-codex-text">{children}</td>
}
