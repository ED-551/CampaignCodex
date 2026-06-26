/**
 * EncounterLibrary — /encounters?system=shadowdark
 *
 * Browseable list of all saved encounter templates for the authenticated user.
 * Filtered by game system. GMs can create, edit, or delete encounters here.
 * Accessible from Campaign Settings and directly via URL.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Sword, Search, X, BookOpen } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { api } from '../utils/api'
import PageShell from '../components/layout/PageShell'

const SYSTEMS = ['shadowdark', 'morkborg', 'nimble']
const SYSTEM_META = {
  shadowdark: { label: 'Shadowdark', badge: 'text-amber-500  bg-amber-500/10  border-amber-500/30'  },
  morkborg:   { label: 'Mörk Borg',  badge: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EncounterLibrary() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const systemParam     = searchParams.get('system')
  const campaignIdParam = searchParams.get('campaignId')

  const [system,        setSystem]        = useState(SYSTEMS.includes(systemParam) ? systemParam : null)
  const [encounters,    setEncounters]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = system ? `/encounters?system=${system}` : '/encounters'
      const { encounters: list } = await api.get(url)
      setEncounters(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [system])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    setDeleteLoading(true)
    try {
      await api.delete(`/encounters/${id}`)
      setEncounters(prev => prev.filter(e => e.id !== id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Filter locally by search query
  const visible = encounters.filter(e =>
    !searchQuery ||
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.tags ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeSystem = system ? SYSTEM_META[system] : null

  return (
    <PageShell>
      <Helmet><title>Encounters — CampaignCodex</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">

        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> ← Back
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Sword size={18} className="text-codex-gold" />
            <h1 className="text-xl font-semibold text-codex-text">Encounter Library</h1>
            {activeSystem && (
              <span className={`text-xs border rounded-full px-2.5 py-0.5 ${activeSystem.badge}`}>
                {activeSystem.label}
              </span>
            )}
          </div>
          <Link
            to={system
              ? `/encounters/new?system=${system}${campaignIdParam ? `&campaignId=${campaignIdParam}` : ''}`
              : '/encounters/new'}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all shrink-0"
          >
            <Plus size={14} /> New Encounter
          </Link>
        </div>

        {/* System filter tabs */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setSystem(null)}
            className={`text-xs rounded-full px-3 py-1 border transition-colors ${
              !system
                ? 'border-codex-gold/50 text-codex-gold bg-codex-gold/10'
                : 'border-codex-border text-codex-subtext hover:border-codex-gold/30'
            }`}
          >
            All Systems
          </button>
          {SYSTEMS.map(s => {
            const m = SYSTEM_META[s]
            return (
              <button
                key={s}
                onClick={() => setSystem(s)}
                className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                  system === s ? m.badge : 'border-codex-border text-codex-subtext hover:border-codex-gold/30'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-codex-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or tag…"
            className="w-full bg-codex-surface border border-codex-border rounded-lg pl-9 pr-9 py-2 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-codex-muted hover:text-codex-text transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center text-codex-muted animate-pulse py-24">Loading encounters…</div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-codex-border rounded-xl p-16 text-center">
            <Sword size={28} className="text-codex-border mx-auto mb-3" />
            <p className="text-codex-subtext text-sm mb-1">
              {searchQuery ? 'No encounters match your search.' : 'No encounters saved yet.'}
            </p>
            {!searchQuery && (
              <p className="text-codex-muted text-xs mt-2">
                Create your first encounter to start building your library.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map(enc => {
              const sysMeta = SYSTEM_META[enc.game_system]
              return (
                <div
                  key={enc.id}
                  className="flex items-center gap-4 p-4 bg-codex-surface border border-codex-border rounded-xl hover:border-codex-gold/20 transition-all group"
                >
                  {/* Icon */}
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-codex-bg border border-codex-border flex items-center justify-center">
                    <Sword size={14} className="text-codex-subtext" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm text-codex-text">{enc.name}</span>
                      {sysMeta && (
                        <span className={`text-[10px] border rounded-full px-2 py-0.5 ${sysMeta.badge}`}>
                          {sysMeta.label}
                        </span>
                      )}
                      {enc.tags && (
                        <span className="text-[10px] text-codex-muted">{enc.tags}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-codex-muted">
                      <span>{enc.monster_count ?? 0} monster type{enc.monster_count !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>Used {enc.times_used} time{enc.times_used !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{formatDate(enc.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(
                        `/encounters/${enc.id}/edit${campaignIdParam ? `?campaignId=${campaignIdParam}` : ''}`
                      )}
                      className="flex items-center gap-1 text-xs text-codex-subtext hover:text-codex-gold border border-codex-border hover:border-codex-gold/50 rounded-lg px-2.5 py-1.5 transition-all"
                      title="Edit encounter"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(enc)}
                      className="text-codex-muted hover:text-red-400 border border-codex-border hover:border-red-500/40 rounded-lg p-1.5 transition-all"
                      title="Delete encounter"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !deleteLoading) setDeleteTarget(null) }}
        >
          <div className="relative w-full max-w-sm bg-codex-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Trash2 size={15} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-codex-text">Delete encounter?</p>
                  <p className="text-xs text-codex-subtext mt-0.5">
                    <span className="text-codex-text font-medium">{deleteTarget.name}</span> will be permanently removed.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="flex-1 py-2 rounded-xl border border-codex-border text-codex-subtext text-sm hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget.id)}
                  disabled={deleteLoading}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {deleteLoading
                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Trash2 size={13} /> Delete</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
