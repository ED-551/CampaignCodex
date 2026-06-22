/**
 * BestiarySharesPage — /bestiary/shares
 *
 * Shows pending incoming bestiary monster shares from other users.
 * Recipients can accept all monsters, select a subset, or dismiss the share.
 * Accepted monsters are added directly to the recipient's bestiary.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link }                              from 'react-router-dom'
import { Helmet }                            from 'react-helmet-async'
import { ArrowLeft, BookOpen, Check, X, ChevronDown, ChevronUp, Share2 } from 'lucide-react'
import { api }                               from '../utils/api'

const SYSTEM_META = {
  shadowdark: { label: 'Shadowdark', icon: '🗡️', color: 'text-amber-500',  badgeClass: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  morkborg:   { label: 'Mörk Borg',  icon: '💀', color: 'text-yellow-300', badgeClass: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG', icon: '🛡️', color: 'text-emerald-400',badgeClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

export default function BestiarySharesPage() {
  const [shares,  setShares]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const loadShares = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { shares: list } = await api.get('/bestiary/shares/inbox')
      setShares(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadShares() }, [loadShares])

  function removeShare(id) {
    setShares(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="min-h-screen bg-codex-bg">
      <Helmet><title>Shared Bestiaries — CampaignCodex</title></Helmet>
      {/* ── Nav ── */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
          <span className="text-codex-border">/</span>
          <span className="text-sm text-codex-subtext">Bestiary</span>
          <span className="text-codex-border">/</span>
          <span className="text-sm font-medium text-codex-gold">Shared with You</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext
            hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📨</span>
          <div>
            <h1 className="text-xl font-semibold text-codex-text">Shared with You</h1>
            <p className="text-xs text-codex-muted mt-0.5">
              Monsters other players have shared from their bestiaries
            </p>
          </div>
        </div>

        {loading && (
          <div className="text-center text-codex-muted animate-pulse py-24 text-sm">
            Summoning your shares…
          </div>
        )}

        {error && (
          <div className="text-center text-red-400 py-24 text-sm">{error}</div>
        )}

        {!loading && !error && shares.length === 0 && (
          <div className="border border-dashed border-codex-border rounded-xl p-16 text-center">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-codex-subtext text-sm mb-2">No pending shares.</p>
            <p className="text-codex-muted text-xs">
              When a friend shares monsters from their bestiary, they'll appear here.
            </p>
          </div>
        )}

        {!loading && !error && shares.length > 0 && (
          <div className="flex flex-col gap-4">
            {shares.map(share => (
              <ShareCard
                key={share.id}
                share={share}
                onDone={() => removeShare(share.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Share Card ───────────────────────────────────────────────────────────────

function ShareCard({ share, onDone }) {
  const meta     = SYSTEM_META[share.game_system] ?? SYSTEM_META.shadowdark
  const monsters = share.monsters_data ?? []

  const [expanded,     setExpanded]     = useState(false)
  const [selectMode,   setSelectMode]   = useState(false)
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [done,         setDone]         = useState(false)
  const [doneMsg,      setDoneMsg]      = useState('')

  function toggleMonster(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev =>
      prev.size === monsters.length
        ? new Set()
        : new Set(monsters.map(m => m.id))
    )
  }

  async function acceptMonsters(monsterIds) {
    setError('')
    setLoading(true)
    try {
      const body = monsterIds ? { monsterIds } : {}
      const { accepted } = await api.post(`/bestiary/shares/${share.id}/accept`, body)
      const count = accepted?.length ?? monsters.length
      setDoneMsg(`✓ ${count} monster${count !== 1 ? 's' : ''} added to your ${meta.label} bestiary!`)
      setDone(true)
      setTimeout(onDone, 2200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function dismiss() {
    setError('')
    setLoading(true)
    try {
      await api.patch(`/bestiary/shares/${share.id}/dismiss`, {})
      onDone()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const dateStr = new Date(share.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  if (done) {
    return (
      <div className="p-5 bg-codex-surface border border-emerald-500/30 rounded-xl
        flex items-center gap-3 text-emerald-400 text-sm">
        <Check size={16} />
        {doneMsg}
      </div>
    )
  }

  return (
    <div className={`bg-codex-surface border rounded-xl overflow-hidden transition-all ${
      selectMode ? 'border-codex-gold/40' : 'border-codex-border'
    }`}>
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-codex-card border border-codex-border
              flex items-center justify-center text-sm font-bold text-codex-gold flex-shrink-0">
              {share.from_username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-codex-text">
                @{share.from_username}
              </p>
              <p className="text-xs text-codex-muted">
                Shared {monsters.length} monster{monsters.length !== 1 ? 's' : ''}
                {' '}from their <span className={meta.color}>{meta.label}</span> bestiary
              </p>
              <p className="text-[10px] text-codex-muted mt-0.5">{dateStr}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-codex-muted hover:text-codex-text transition-colors p-1 flex-shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Monster name chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {monsters.slice(0, 6).map(m => (
            <span key={m.id}
              className={`text-xs border rounded-full px-2.5 py-0.5 ${meta.badgeClass}`}>
              {m.name}
            </span>
          ))}
          {monsters.length > 6 && (
            <span className="text-xs text-codex-muted border border-codex-border rounded-full px-2.5 py-0.5">
              +{monsters.length - 6} more
            </span>
          )}
        </div>
      </div>

      {/* Expanded monster list (for Select mode) */}
      {(expanded || selectMode) && (
        <div className="border-t border-codex-border/40 px-5 pt-4 pb-2">
          {selectMode && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-codex-subtext font-medium">
                Select monsters to add:
              </p>
              <button onClick={toggleSelectAll}
                className="text-xs text-codex-gold hover:text-codex-goldHover transition-colors">
                {selectedIds.size === monsters.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {monsters.map(m => (
              <button
                key={m.id}
                onClick={selectMode ? () => toggleMonster(m.id) : undefined}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left w-full
                  transition-all
                  ${selectMode
                    ? selectedIds.has(m.id)
                      ? 'border-codex-gold bg-codex-gold/10 cursor-pointer'
                      : 'border-codex-border hover:border-codex-subtext cursor-pointer'
                    : 'border-codex-border/50 cursor-default'
                  }`}
              >
                {selectMode && (
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    selectedIds.has(m.id)
                      ? 'bg-codex-gold border-codex-gold'
                      : 'border-codex-border bg-codex-bg'
                  }`}>
                    {selectedIds.has(m.id) && <Check size={10} className="text-codex-bg" strokeWidth={3} />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-codex-text truncate">{m.name}</p>
                  {m.challenge && (
                    <p className="text-[10px] text-codex-muted">
                      {meta.formatChallenge?.(m.challenge) ?? m.challenge}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        {selectMode ? (
          <div className="flex gap-2">
            <button
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-codex-border text-codex-subtext
                text-xs hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={() => acceptMonsters([...selectedIds])}
              disabled={loading || selectedIds.size === 0}
              className="flex-1 py-2 rounded-lg bg-codex-gold hover:bg-codex-goldHover
                text-codex-bg font-semibold text-xs transition-all
                disabled:opacity-30 disabled:cursor-not-allowed
                flex items-center justify-center gap-1.5"
            >
              {loading
                ? <span className="w-3.5 h-3.5 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin" />
                : <><Check size={12} /> Add {selectedIds.size || ''} to My Bestiary</>
              }
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={dismiss}
              disabled={loading}
              className="py-2 px-3 rounded-lg border border-codex-border text-codex-muted
                text-xs hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-40"
              title="Dismiss this share"
            >
              <X size={13} />
            </button>
            <button
              onClick={() => { setSelectMode(true); setExpanded(true) }}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-codex-border text-codex-subtext
                text-xs hover:border-codex-subtext hover:text-codex-text transition-colors disabled:opacity-40"
            >
              Select Monsters
            </button>
            <button
              onClick={() => acceptMonsters(null)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-codex-gold hover:bg-codex-goldHover
                text-codex-bg font-semibold text-xs transition-all disabled:opacity-30
                flex items-center justify-center gap-1.5"
            >
              {loading
                ? <span className="w-3.5 h-3.5 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin" />
                : <><Check size={12} /> Accept All</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
