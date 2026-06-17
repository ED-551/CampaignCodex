import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Sword, Plus, BookOpen, X, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'

const GAME_STYLE = {
  shadowdark: { label: 'Shadowdark',  accent: '#c9a84c', badge: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  morkborg:   { label: 'Mörk Borg',   accent: '#d4d400', badge: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG',  accent: '#4a8c5c', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

export default function CampaignDetail() {
  const { id }                      = useParams()
  const { user }                    = useAuth()
  const navigate                    = useNavigate()
  const [campaign, setCampaign]     = useState(null)
  const [members, setMembers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [copied, setCopied]         = useState(false)
  const [error, setError]           = useState('')
  const [showDeleteModal, setShowDeleteModal]   = useState(false)
  const [deleteConfirm, setDeleteConfirm]       = useState('')
  const [deleteError, setDeleteError]           = useState('')
  const [deleting, setDeleting]                 = useState(false)

  useEffect(() => {
    api.get(`/campaigns/${id}`)
      .then(({ campaign, members }) => { setCampaign(campaign); setMembers(members) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function copyCode() {
    navigator.clipboard.writeText(campaign.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <PageShell><div className="text-center text-codex-muted animate-pulse py-24">Loading campaign…</div></PageShell>
  if (error)   return <PageShell><div className="text-center text-red-400 py-24">{error}</div></PageShell>
  if (!campaign) return null

  const isGM      = campaign.gm_user_id === user?.id
  const style     = GAME_STYLE[campaign.game_system] ?? GAME_STYLE.shadowdark
  const myMember  = members.find(m => m.user_id === user?.id && !m.left_at)
  const activeMembers = members.filter(m => !m.left_at)
  const formerMembers = members.filter(m => m.left_at)

  async function dismissFormerMember(memberId) {
    try {
      await api.delete(`/campaigns/${id}/members/${memberId}`)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err) {
      console.error('Failed to dismiss member:', err)
    }
  }

  async function handleDeleteCampaign() {
    if (deleteConfirm !== campaign.name) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/campaigns/${id}`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setDeleteError(err.message || 'Deletion failed.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-6">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-codex-text">{campaign.name}</h1>
              <span className={`text-xs border rounded-full px-2.5 py-0.5 ${style.badge}`}>
                {style.label}
              </span>
              {isGM && <span className="text-xs text-codex-subtext border border-codex-border rounded-full px-2.5 py-0.5">⚔️ Game Master</span>}
            </div>
            {campaign.description && (
              <p className="text-sm text-codex-subtext max-w-xl">{campaign.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 items-end shrink-0">
            {isGM && (
              <div className="flex items-center gap-2 bg-codex-surface border border-codex-border rounded-lg px-3 py-2">
                <span className="text-xs text-codex-subtext">Join code</span>
                <span className="font-mono font-semibold text-codex-text tracking-widest text-sm">
                  {campaign.join_code}
                </span>
                <button onClick={copyCode} className="text-codex-muted hover:text-codex-gold transition-colors ml-1">
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              {isGM && (
                <button
                  onClick={() => navigate(`/campaigns/${id}/combat`)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 transition-all"
                >
                  <Sword size={14} /> Start Combat
                </button>
              )}
              {!isGM && !myMember?.character_id && (
                <button
                  onClick={() => navigate(`/characters/new?system=${campaign.game_system}&campaignId=${id}`)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all"
                >
                  <Plus size={14} /> Add My Character
                </button>
              )}
              {!isGM && myMember?.character_id && (
                <button
                  onClick={() => navigate(`/characters/${myMember.character_id}`)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-surface border border-codex-border text-codex-text hover:border-codex-gold transition-all"
                >
                  <BookOpen size={14} /> My Character Sheet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-codex-border" />

      {/* Player Roster */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Active Members */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-codex-text">
              Party Roster
              <span className="ml-2 text-codex-subtext font-normal text-sm">
                {activeMembers.length} / {isGM ? (user?.campaignLimit ?? 6) : '?'} players
              </span>
            </h2>
          </div>

          {activeMembers.length === 0 ? (
            <div className="border border-dashed border-codex-border rounded-xl p-12 text-center">
              <p className="text-codex-subtext text-sm">No players have joined yet.</p>
              {isGM && (
                <p className="text-codex-muted text-xs mt-2">
                  Share the join code <span className="font-mono text-codex-text">{campaign.join_code}</span> with your players.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {activeMembers.map(m => (
                <PlayerCard
                  key={m.id}
                  member={m}
                  isGM={isGM}
                  gameSystem={campaign.game_system}
                  onClick={isGM && m.character_id
                    ? () => navigate(`/characters/${m.character_id}?readOnly=true`)
                    : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Former Members — shown to GM only when someone has left */}
        {isGM && formerMembers.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-codex-subtext mb-4">
              Former Members
              <span className="ml-2 text-codex-muted font-normal text-xs">(left the campaign — click to dismiss)</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {formerMembers.map(m => (
                <FormerMemberCard
                  key={m.id}
                  member={m}
                  onDismiss={() => dismissFormerMember(m.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Danger Zone (GM only) ── */}
        {isGM && (
          <div className="border border-red-500/20 rounded-xl p-5 bg-red-950/10">
            <h2 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h2>
            <p className="text-xs text-codex-subtext mb-4">
              Permanently delete this campaign and all associated data. Players will see a notification and can dismiss it from their dashboard.
            </p>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); setDeleteError('') }}
              className="flex items-center gap-2 text-sm text-red-400 border border-red-500/30 rounded-lg px-4 py-2 hover:bg-red-500/10 hover:border-red-500/60 transition-all"
            >
              <Trash2 size={14} /> Delete Campaign
            </button>
          </div>
        )}
      </div>

      {/* ── Delete Campaign Modal ── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setShowDeleteModal(false) }}
        >
          <div className="relative w-full max-w-md bg-codex-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />

            <div className="flex items-start justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-codex-text">Delete campaign?</h2>
                  <p className="text-xs text-codex-subtext mt-0.5">This action is permanent and irreversible.</p>
                </div>
              </div>
              {!deleting && (
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface ml-2"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="px-6 pb-6 flex flex-col gap-4">
              <p className="text-sm text-codex-subtext leading-relaxed">
                You are about to permanently delete{' '}
                <span className="font-semibold text-codex-text">{campaign.name}</span>.
                All party members will receive a notification on their dashboard and will be able to dismiss it.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-codex-subtext">
                  Type <span className="font-semibold text-codex-text">{campaign.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => { setDeleteConfirm(e.target.value); setDeleteError('') }}
                  placeholder={campaign.name}
                  disabled={deleting}
                  autoFocus
                  className="w-full bg-codex-surface border border-codex-border rounded-lg px-3 py-2 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-colors disabled:opacity-40"
                />
              </div>

              {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCampaign}
                  disabled={deleting || deleteConfirm !== campaign.name}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </PageShell>
  )
}

function PlayerCard({ member, isGM, gameSystem, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 bg-codex-surface border border-codex-border rounded-xl transition-all duration-150
        ${onClick ? 'cursor-pointer hover:border-codex-gold hover:bg-codex-card group' : ''}`}
    >
      {/* Portrait */}
      <div className="w-16 h-16 rounded-full bg-codex-bg border-2 border-codex-border overflow-hidden flex items-center justify-center">
        {member.portrait_url ? (
          <img src={member.portrait_url} alt={member.character_name} className="w-full h-full object-cover" />
        ) : (
          <DefaultPortrait system={gameSystem} />
        )}
      </div>

      {/* Character name */}
      <div className="text-center">
        <p className={`text-sm font-semibold text-codex-text leading-tight ${onClick ? 'group-hover:text-codex-gold transition-colors' : ''}`}>
          {member.character_name || '—'}
        </p>
        <p className="text-xs text-codex-muted mt-0.5">{member.username}</p>
      </div>

      {!member.character_id && (
        <span className="text-xs text-codex-muted italic">No sheet yet</span>
      )}
    </div>
  )
}

function FormerMemberCard({ member, onDismiss }) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismiss() {
    if (dismissing) return
    setDismissing(true)
    await onDismiss()
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={dismissing}
      title="Click to dismiss from your view"
      className="relative flex flex-col items-center gap-2 p-4 bg-codex-surface/40 border border-dashed border-codex-border/50 rounded-xl transition-all duration-150 hover:border-red-500/30 hover:bg-red-500/5 group opacity-60 hover:opacity-100 disabled:opacity-30"
    >
      <div className="w-16 h-16 rounded-full bg-codex-bg border-2 border-codex-border/50 overflow-hidden flex items-center justify-center grayscale">
        {member.portrait_url ? (
          <img src={member.portrait_url} alt={member.character_name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl opacity-40">👤</span>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-codex-muted leading-tight line-through">
          {member.character_name || '—'}
        </p>
        <p className="text-xs text-codex-muted mt-0.5">{member.username}</p>
        <p className="text-[10px] text-red-400/70 mt-1">Left campaign</p>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={12} className="text-codex-muted" />
      </div>
    </button>
  )
}

function DefaultPortrait({ system }) {
  const icons = { shadowdark: '⚔️', morkborg: '💀', nimble: '🛡️' }
  return <span className="text-2xl">{icons[system] ?? '🎲'}</span>
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-codex-bg">
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
