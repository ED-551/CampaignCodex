import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Users, Scroll, Trophy, Swords, ArrowLeft, Shield, Trash2, X, Mail, Send } from 'lucide-react'
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

  // ── Broadcast email state ──────────────────────────────────────────────────
  const [bSubject, setBSubject]   = useState('')
  const [bBody, setBBody]         = useState('')
  const [bStep, setBStep]         = useState('idle')   // 'idle' | 'confirm' | 'sending' | 'done'
  const [bResult, setBResult]     = useState(null)     // { sent, failed, total, stub, message }
  const [bError, setBError]       = useState('')
  const confirmTimer              = useRef(null)

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/users')])
      .then(([statsRes, usersRes]) => { setData(statsRes); setUsers(usersRes.users) })
      .catch(err => {
        // Gate stack trace behind DEV — production consoles should not expose API error shapes
        if (import.meta.env.DEV) console.error('[AdminDashboard] load failed', err)
        setLoading(false)  // ensure spinner clears even on error
      })
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

  // ── Broadcast helpers ──────────────────────────────────────────────────────
  function handleBroadcastFirstClick() {
    if (!bSubject.trim()) { setBError('Subject is required.'); return }
    if (!bBody.trim())    { setBError('Message body is required.'); return }
    setBError('')
    setBStep('confirm')
    // Auto-revert confirmation state after 8 seconds if admin doesn't confirm
    clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setBStep('idle'), 8000)
  }

  async function handleBroadcastConfirm() {
    clearTimeout(confirmTimer.current)
    setBStep('sending')
    setBError('')
    try {
      const result = await api.post('/admin/broadcast-email', {
        subject: bSubject.trim(),
        body:    bBody.trim(),
        confirm: true,
      })
      setBResult(result)
      setBStep('done')
    } catch (err) {
      setBError(err.message || 'Broadcast failed.')
      setBStep('idle')
    }
  }

  function handleBroadcastReset() {
    setBSubject('')
    setBBody('')
    setBStep('idle')
    setBResult(null)
    setBError('')
  }

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
              {[
                { id: 'overview',   label: 'Overview'  },
                { id: 'users',      label: 'Users'     },
                { id: 'broadcast',  label: '📧 Broadcast' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    tab === t.id
                      ? 'border-codex-gold text-codex-gold'
                      : 'border-transparent text-codex-subtext hover:text-codex-text'
                  }`}>
                  {t.label}
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

            {tab === 'broadcast' && (
              <BroadcastPanel
                subscriberCount={data?.stats.newsletterSubscribers ?? 0}
                subject={bSubject}   onSubjectChange={setBSubject}
                body={bBody}         onBodyChange={setBBody}
                step={bStep}
                result={bResult}
                error={bError}
                onFirstClick={handleBroadcastFirstClick}
                onConfirm={handleBroadcastConfirm}
                onCancel={() => { clearTimeout(confirmTimer.current); setBStep('idle'); setBError('') }}
                onReset={handleBroadcastReset}
              />
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

// ─── Broadcast Email Panel ─────────────────────────────────────────────────────
function BroadcastPanel({
  subscriberCount,
  subject, onSubjectChange,
  body,    onBodyChange,
  step, result, error,
  onFirstClick, onConfirm, onCancel, onReset,
}) {
  const BODY_MAX = 5000
  const bodyLen  = body.length

  // ── Done state ──────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    const isStub = result.stub
    return (
      <div className="max-w-2xl">
        <div className={`rounded-xl border p-6 flex flex-col gap-4 ${
          isStub ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              isStub ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'
            }`}>
              {isStub
                ? <span className="text-amber-400 text-base">⚠</span>
                : <span className="text-emerald-400 text-base">✓</span>
              }
            </div>
            <div>
              <p className={`font-semibold text-sm ${isStub ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isStub ? 'Stubbed — no email sent' : 'Broadcast delivered'}
              </p>
              <p className="text-codex-subtext text-sm mt-0.5">{result.message}</p>
            </div>
          </div>

          {!isStub && (
            <div className="flex gap-6 pl-12">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{result.sent}</div>
                <div className="text-xs text-codex-muted">Delivered</div>
              </div>
              {result.failed > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{result.failed}</div>
                  <div className="text-xs text-codex-muted">Failed</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold text-codex-subtext">{result.total}</div>
                <div className="text-xs text-codex-muted">Total opted-in</div>
              </div>
            </div>
          )}

          <button
            onClick={onReset}
            className="ml-12 self-start px-4 py-2 rounded-lg border border-codex-border text-sm
              text-codex-subtext hover:text-codex-text hover:border-codex-text/40 transition-colors"
          >
            Compose another
          </button>
        </div>
      </div>
    )
  }

  // ── Compose / confirm / sending state ───────────────────────────────────────
  return (
    <div className="max-w-2xl flex flex-col gap-6">

      {/* Header card */}
      <div className="bg-codex-surface border border-codex-border rounded-xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Mail size={18} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-codex-text">Newsletter Broadcast</h2>
          <p className="text-xs text-codex-subtext mt-0.5 leading-relaxed">
            Send an email to all users who opted in to the newsletter.
            {' '}
            <span className="text-blue-400 font-medium">
              {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''} opted in.
            </span>
          </p>
          {subscriberCount === 0 && (
            <p className="text-xs text-amber-400 mt-1">
              No subscribers yet — nobody will receive this email until users opt in at signup.
            </p>
          )}
        </div>
      </div>

      {/* Compose form */}
      <div className="bg-codex-surface border border-codex-border rounded-xl p-5 flex flex-col gap-4">
        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => onSubjectChange(e.target.value)}
            maxLength={200}
            placeholder="e.g. New features just dropped — Nimble RPG support is live"
            disabled={step !== 'idle'}
            className="w-full bg-codex-bg border border-codex-border rounded-lg px-4 py-2.5
              text-codex-text placeholder-codex-muted text-sm
              focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
              transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-codex-muted text-right">{subject.length}/200</p>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">Message</label>
          <textarea
            value={body}
            onChange={e => onBodyChange(e.target.value)}
            maxLength={BODY_MAX}
            rows={10}
            placeholder={`Hey Codex crew,\n\nWe just shipped something big...`}
            disabled={step !== 'idle'}
            className="w-full bg-codex-bg border border-codex-border rounded-lg px-4 py-3
              text-codex-text placeholder-codex-muted text-sm leading-relaxed resize-y
              focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
              transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-codex-muted">Plain text — line breaks become paragraphs.</p>
            <p className={`text-xs ${bodyLen > BODY_MAX * 0.9 ? 'text-amber-400' : 'text-codex-muted'}`}>
              {bodyLen.toLocaleString()}/{BODY_MAX.toLocaleString()}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        {step === 'idle' && (
          <button
            onClick={onFirstClick}
            disabled={!subject.trim() || !body.trim() || subscriberCount === 0}
            className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg
              bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm
              transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            Send to {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
          </button>
        )}

        {step === 'confirm' && (
          <div className="flex flex-col gap-3 border border-amber-500/30 bg-amber-500/5 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <span>⚠</span> Confirm broadcast
            </p>
            <p className="text-xs text-codex-subtext leading-relaxed">
              This will send a real email to{' '}
              <span className="text-codex-text font-semibold">{subscriberCount} user{subscriberCount !== 1 ? 's' : ''}</span>.
              {' '}Make sure your message is proofread and your Resend API key is configured.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-codex-border text-codex-subtext text-sm
                  hover:border-codex-text hover:text-codex-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-lg
                  bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-all"
              >
                <Send size={13} />
                Yes, send it
              </button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex items-center gap-3 text-codex-subtext text-sm">
            <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
            Sending to {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}…
          </div>
        )}
      </div>

      {/* Resend reminder */}
      <div className="text-xs text-codex-muted flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">ℹ</span>
        <span>
          Emails stub to the server console until{' '}
          <code className="bg-codex-surface px-1 py-0.5 rounded text-codex-subtext">RESEND_API_KEY</code>
          {' '}is set in your <code className="bg-codex-surface px-1 py-0.5 rounded text-codex-subtext">.env</code> file.
          See the Pre-Launch Email Setup checklist in your Obsidian vault.
        </span>
      </div>
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
