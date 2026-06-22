import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Copy, Check, Trash2, Sword, BookOpen,
  X, Info, ExternalLink, Settings, Library,
} from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import PageShell from '../components/layout/PageShell'

const GAME_STYLE = {
  shadowdark: { label: 'Shadowdark',  badge: 'text-amber-500  bg-amber-500/10  border-amber-500/30'  },
  morkborg:   { label: 'Mörk Borg',   badge: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG',  badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function CampaignSettings() {
  const { id }       = useParams()
  const { user }     = useAuth()
  const navigate     = useNavigate()

  const [campaign,  setCampaign]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [copied,    setCopied]    = useState(false)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm,   setDeleteConfirm]   = useState('')
  const [deleteError,     setDeleteError]     = useState('')
  const [deleting,        setDeleting]        = useState(false)

  useEffect(() => {
    api.get(`/campaigns/${id}`)
      .then(({ campaign }) => {
        setCampaign(campaign)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // Access control — redirect non-GMs once data loads
  useEffect(() => {
    if (!loading && campaign && campaign.gm_user_id !== user?.id) {
      navigate(`/campaigns/${id}`, { replace: true })
    }
  }, [loading, campaign, user, id, navigate])

  function copyCode() {
    navigator.clipboard.writeText(campaign.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  if (loading) {
    return (
      <PageShell>
        <div className="text-center text-codex-muted animate-pulse py-24">Loading…</div>
      </PageShell>
    )
  }
  if (error) {
    return (
      <PageShell>
        <div className="text-center text-red-400 py-24">{error}</div>
      </PageShell>
    )
  }
  if (!campaign) return null

  const style = GAME_STYLE[campaign.game_system] ?? GAME_STYLE.shadowdark

  return (
    <PageShell>
      <Helmet><title>Campaign Settings — CampaignCodex</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">

        {/* Back link */}
        <Link
          to={`/campaigns/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to {campaign.name}
        </Link>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <Settings size={18} className="text-codex-gold" />
          <h1 className="text-xl font-semibold text-codex-text">Campaign Settings & Info</h1>
          <span className={`text-xs border rounded-full px-2.5 py-0.5 ${style.badge}`}>
            {style.label}
          </span>
        </div>
        <p className="text-sm text-codex-subtext mb-8 ml-7">{campaign.name}</p>

        <div className="h-px bg-codex-border mb-8" />

        {/* ── Two-column layout (desktop) / stacked (mobile) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Campaign Info */}
          <div className="bg-codex-surface border border-codex-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info size={13} className="text-codex-gold" />
              <h2 className="text-sm font-semibold text-codex-text">Campaign Info</h2>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Created">
                {formatDate(campaign.created_at)}
              </InfoRow>
              <InfoRow label="Game System">
                <span className={`text-xs border rounded-full px-2.5 py-0.5 ${style.badge}`}>
                  {style.label}
                </span>
              </InfoRow>
              <InfoRow label="Join Code">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-codex-text tracking-widest">
                    {campaign.join_code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="text-codex-muted hover:text-codex-gold transition-colors"
                    title="Copy join code"
                  >
                    {copied
                      ? <Check size={13} className="text-emerald-400" />
                      : <Copy size={13} />}
                  </button>
                </span>
              </InfoRow>
              <InfoRow label="Encounters Completed">
                <span className="text-codex-text font-medium tabular-nums">
                  {campaign.encounters_completed ?? 0}
                </span>
              </InfoRow>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="bg-codex-surface border border-codex-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sword size={13} className="text-codex-gold" />
              <h2 className="text-sm font-semibold text-codex-text">Quick Actions</h2>
            </div>
            <div className="flex flex-col gap-3">

              {/* Create Encounter */}
              <Link
                to={`/encounters/new?system=${campaign.game_system}&campaignId=${id}&from=settings`}
                className="flex items-start gap-3 p-3 rounded-lg border border-codex-border bg-codex-bg/40 hover:border-codex-gold/40 hover:bg-codex-surface transition-all group"
              >
                <Sword size={14} className="text-codex-subtext group-hover:text-codex-gold mt-0.5 shrink-0 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-codex-subtext group-hover:text-codex-text font-medium transition-colors">
                    Create Encounter
                  </p>
                  <p className="text-xs text-codex-muted mt-0.5">Build and save a reusable combat encounter.</p>
                </div>
              </Link>

              {/* Encounter Library */}
              <Link
                to={`/encounters?system=${campaign.game_system}&campaignId=${id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-codex-border bg-codex-bg/40 hover:border-codex-gold/40 hover:bg-codex-surface transition-all group"
              >
                <Library size={14} className="text-codex-subtext group-hover:text-codex-gold mt-0.5 shrink-0 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-codex-subtext group-hover:text-codex-text font-medium transition-colors">
                    Encounter Library
                  </p>
                  <p className="text-xs text-codex-muted mt-0.5">
                    Browse all your {style.label} encounters.
                  </p>
                </div>
              </Link>

              {/* Create Monster — opens bestiary in new tab */}
              <a
                href={`/bestiary/${campaign.game_system}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg border border-codex-border bg-codex-bg/40 hover:border-codex-gold/40 hover:bg-codex-surface transition-all group"
              >
                <BookOpen size={14} className="text-codex-subtext group-hover:text-codex-gold mt-0.5 shrink-0 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-codex-subtext group-hover:text-codex-text font-medium transition-colors">
                    Create Monster
                  </p>
                  <p className="text-xs text-codex-muted mt-0.5">
                    Open the {style.label} bestiary to add or edit monsters.
                  </p>
                </div>
                <ExternalLink size={12} className="text-codex-muted group-hover:text-codex-subtext mt-0.5 shrink-0 transition-colors" />
              </a>

            </div>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="border border-red-500/20 rounded-xl p-5 bg-red-950/10">
          <h2 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h2>
          <p className="text-xs text-codex-subtext mb-4">
            Permanently delete this campaign and all associated data. Players will see a tombstone
            on their dashboard and can dismiss it.
          </p>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); setDeleteError('') }}
            className="flex items-center gap-2 text-sm text-red-400 border border-red-500/30 rounded-lg px-4 py-2 hover:bg-red-500/10 hover:border-red-500/60 transition-all"
          >
            <Trash2 size={14} /> Delete Campaign
          </button>
        </div>
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
                All party members will receive a notification and will be able to dismiss it from their dashboards.
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

// ─── Info Row helper ──────────────────────────────────────────────────────────
function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-codex-subtext shrink-0">{label}</dt>
      <dd className="text-codex-text text-right">{children}</dd>
    </div>
  )
}
