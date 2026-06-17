import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Users, Scroll, Trophy, Swords, ArrowLeft, Shield, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'

const TIER_COLORS = {
  bronze:   'text-amber-600',
  silver:   'text-slate-300',
  gold:     'text-yellow-400',
  platinum: 'text-purple-400',
}

const GAME_COLORS = {
  shadowdark: 'text-amber-500',
  morkborg:   'text-yellow-300',
  nimble:     'text-emerald-400',
}

export default function AdminDashboard() {
  const { logout }              = useAuth()
  const navigate                = useNavigate()
  const [data, setData]               = useState(null)
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('overview')
  const [deleteTarget, setDeleteTarget] = useState(null)   // { id, username }
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting]       = useState(false)

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/users')])
      .then(([statsRes, usersRes]) => { setData(statsRes); setUsers(usersRes.users) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function updateTier(userId, tier) {
    try {
      await api.patch(`/admin/users/${userId}/tier`, { tier })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, supporter_tier: tier } : u))
    } catch (err) {
      alert(err.message)
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`)
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err.message || 'Deletion failed.')
    } finally {
      setDeleting(false)
    }
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  return (
    <div className="min-h-screen bg-codex-bg">
      {/* Nav */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-codex-gold" />
            <span className="font-display text-sm text-codex-gold tracking-wide">CampaignCodex</span>
            <span className="text-codex-border">·</span>
            <span className="flex items-center gap-1 text-xs text-purple-400">
              <Shield size={11} /> Admin Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xs text-codex-subtext hover:text-codex-text transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> User Dashboard
            </Link>
            <button onClick={handleLogout} className="text-xs text-codex-subtext hover:text-codex-text transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-codex-text">Admin Console</h1>
          <p className="text-sm text-codex-subtext mt-1">Platform overview and user management</p>
        </div>

        {loading ? (
          <div className="text-center text-codex-muted animate-pulse py-24">Loading stats…</div>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <StatTile icon={<Users size={18}/>}    label="Total Users"    value={data?.stats.totalUsers}       color="text-blue-400" />
              <StatTile icon={<Swords size={18}/>}   label="Active Campaigns" value={data?.stats.activeCampaigns} color="text-red-400" />
              <StatTile icon={<Scroll size={18}/>}   label="Character Sheets" value={data?.stats.totalCharacters} color="text-amber-400" />
              <StatTile icon={<Trophy size={18}/>}   label="Supporters"     value={data?.stats.totalSupporters}  color="text-purple-400" />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-codex-border">
              {['overview', 'users'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? 'border-codex-gold text-codex-gold'
                      : 'border-transparent text-codex-subtext hover:text-codex-text'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Supporters by tier */}
                <Section title="Supporters by Tier">
                  {data?.stats.supportersByTier?.length === 0 ? (
                    <p className="text-codex-muted text-sm">No supporters yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data?.stats.supportersByTier?.map(row => (
                        <div key={row.tier} className="flex items-center justify-between">
                          <span className={`text-sm capitalize ${TIER_COLORS[row.tier] ?? 'text-codex-text'}`}>
                            {row.tier}
                          </span>
                          <span className="text-sm font-semibold text-codex-text">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Characters by system */}
                <Section title="Characters by System">
                  {data?.stats.charactersBySystem?.map(row => (
                    <div key={row.system} className="flex items-center justify-between">
                      <span className={`text-sm capitalize ${GAME_COLORS[row.system] ?? 'text-codex-text'}`}>
                        {row.system === 'morkborg' ? 'Mörk Borg' : row.system === 'shadowdark' ? 'Shadowdark' : 'Nimble RPG'}
                      </span>
                      <span className="text-sm font-semibold text-codex-text">{row.count}</span>
                    </div>
                  ))}
                </Section>

                {/* Campaigns by system */}
                <Section title="Campaigns by System">
                  {data?.stats.campaignsBySystem?.map(row => (
                    <div key={row.system} className="flex items-center justify-between">
                      <span className={`text-sm capitalize ${GAME_COLORS[row.system] ?? 'text-codex-text'}`}>
                        {row.system === 'morkborg' ? 'Mörk Borg' : row.system === 'shadowdark' ? 'Shadowdark' : 'Nimble RPG'}
                      </span>
                      <span className="text-sm font-semibold text-codex-text">{row.count}</span>
                    </div>
                  ))}
                </Section>

                {/* Recent users */}
                <Section title="Recent Registrations">
                  <div className="flex flex-col gap-2">
                    {data?.recentUsers?.map(u => (
                      <div key={u.id} className="flex items-center justify-between">
                        <span className="text-sm text-codex-text">{u.username}</span>
                        <span className="text-xs text-codex-muted">
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {tab === 'users' && (
              <div className="bg-codex-surface border border-codex-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-codex-border text-left">
                      <Th>Username</Th>
                      <Th>Email</Th>
                      <Th>Tier</Th>
                      <Th>Joined</Th>
                      <Th>Sheets</Th>
                      <Th>Campaigns</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id}
                        className={`border-b border-codex-border/40 ${i % 2 === 0 ? '' : 'bg-codex-card/30'}`}>
                        <Td><span className="text-codex-text font-medium">{u.username}</span></Td>
                        <Td><span className="text-codex-subtext">{u.email}</span></Td>
                        <Td>
                          <span className={`capitalize text-xs font-medium ${TIER_COLORS[u.supporter_tier] ?? 'text-codex-muted'}`}>
                            {u.supporter_tier}
                          </span>
                        </Td>
                        <Td>{new Date(u.created_at).toLocaleDateString()}</Td>
                        <Td>{u.character_count}</Td>
                        <Td>{u.campaign_count}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <select
                              value={u.supporter_tier}
                              onChange={e => updateTier(u.id, e.target.value)}
                              className="bg-codex-bg border border-codex-border rounded px-2 py-1 text-xs text-codex-text focus:outline-none focus:border-codex-gold"
                            >
                              {['free','bronze','silver','gold','platinum'].map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => { setDeleteError(''); setDeleteTarget({ id: u.id, username: u.username }) }}
                              title={`Delete ${u.username}`}
                              className="flex items-center justify-center w-7 h-7 rounded border border-codex-border text-codex-muted
                                hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* Admin delete user modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}
        >
          <div className="relative w-full max-w-md bg-codex-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />
            <div className="flex items-start justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-codex-text">Delete user?</h2>
                  <p className="text-xs text-codex-subtext mt-0.5">This action is permanent and irreversible.</p>
                </div>
              </div>
              {!deleting && (
                <button onClick={() => setDeleteTarget(null)}
                  className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface ml-2">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="px-6 pb-6 flex flex-col gap-4">
              <p className="text-sm text-codex-subtext leading-relaxed">
                You are about to permanently delete the account{' '}
                <span className="font-semibold text-codex-text">@{deleteTarget.username}</span>{' '}
                and all their campaigns, characters, and data. This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-sm text-red-400">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm
                    hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteUser}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm
                    transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      Delete forever
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ icon, label, value, color }) {
  return (
    <div className="bg-codex-surface border border-codex-border rounded-xl p-4">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-codex-text">{value ?? '—'}</div>
      <div className="text-xs text-codex-subtext mt-0.5">{label}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-codex-surface border border-codex-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-codex-text mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-medium text-codex-subtext">{children}</th>
}
function Td({ children }) {
  return <td className="px-4 py-3 text-xs text-codex-text">{children}</td>
}
