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
import { ArrowLeft, Check, X, ChevronDown, ChevronUp, Share2 } from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import { api }                               from '../utils/api'

// ─── Custom thematic icons ────────────────────────────────────────────────────

/**
 * Parchment envelope viewed from the back — four triangular flaps meet at center
 * in an X pattern, sealed with a blob-edged red wax seal.
 * Size prop controls width; height is proportional (landscape 64:46 ratio).
 */
function WaxSealLetterIcon({ size = 48 }) {
  const h = Math.round(size * 46 / 64)
  return (
    <svg width={size} height={h} viewBox="0 0 64 46" fill="none" aria-hidden="true">

      {/* Subtle drop shadow */}
      <rect x="2" y="2" width="62" height="43" rx="3" fill="#8b6f30" opacity="0.18" />

      {/* Parchment base */}
      <rect x="0" y="0" width="64" height="46" rx="3" fill="#e8d5a8" />

      {/* Four triangular flaps — the X fold on the back of a sealed envelope.
          Each flap is a slightly different parchment tone to suggest 3-D folding. */}
      {/* Top flap (slightly cooler/lighter) */}
      <polygon points="0,0 64,0 32,23" fill="#dccf98" />
      {/* Bottom flap (warmer/darker — back face) */}
      <polygon points="0,46 64,46 32,23" fill="#c4b07a" />
      {/* Left flap */}
      <polygon points="0,0 0,46 32,23" fill="#d0c08e" />
      {/* Right flap (lightest — catches the most light) */}
      <polygon points="64,0 64,46 32,23" fill="#dcd2a0" />

      {/* Fold crease lines radiating from center */}
      <line x1="0"  y1="0"  x2="32" y2="23" stroke="#a89060" strokeWidth="0.75" />
      <line x1="64" y1="0"  x2="32" y2="23" stroke="#a89060" strokeWidth="0.75" />
      <line x1="0"  y1="46" x2="32" y2="23" stroke="#a89060" strokeWidth="0.75" />
      <line x1="64" y1="46" x2="32" y2="23" stroke="#a89060" strokeWidth="0.75" />

      {/* Envelope border */}
      <rect x="0.5" y="0.5" width="63" height="45" rx="2.5"
        fill="none" stroke="#a08050" strokeWidth="1" />

      {/* ── Wax seal ──
          24-point blob polygon (12 outer bumps at r=10, 12 inner valleys at r=8.5)
          centered at (32, 23) — matches the X fold center. */}
      <polygon
        points="42,23 40.2,25.2 40.7,28 38,29 37,31.7 34.2,31.2 32,33 29.8,31.2 27,31.7 26,29 23.3,28 23.8,25.2 22,23 23.8,20.8 23.3,18 26,17 27,14.3 29.8,14.8 32,13 34.2,14.8 37,14.3 38,17 40.7,18 40.2,20.8"
        fill="#7f1111"
      />
      {/* Mid ring */}
      <circle cx="32" cy="23" r="8"   fill="#9b1c1c" />
      {/* Inner raised circle */}
      <circle cx="32" cy="23" r="6"   fill="#b91c1c" />
      {/* Inner ring detail */}
      <circle cx="32" cy="23" r="4.5" fill="none" stroke="#ef4444" strokeWidth="0.7" opacity="0.5" />
      {/* Light catch / specular highlight */}
      <ellipse cx="29.5" cy="20.5" rx="2.8" ry="1.6"
        fill="#ef8080" opacity="0.28" transform="rotate(-30 29.5 20.5)" />

    </svg>
  )
}

/**
 * Log-cabin mailbox on a post: horizontal log stripes, peaked cedar roof with
 * shingle rows, arched front opening, stone chimney, and a raised red flag.
 * Size prop controls width; height is proportional (70:82 ratio).
 */
function CabinMailboxIcon({ size = 56 }) {
  const h = Math.round(size * 82 / 70)
  return (
    <svg width={size} height={h} viewBox="0 0 70 82" fill="none" aria-hidden="true">
      <defs>
        {/* Clip the shingle lines to the roof triangle */}
        <clipPath id="ccRoofClip">
          <polygon points="1,36 35,8 69,36" />
        </clipPath>
      </defs>

      {/* ── Post and stand ── */}
      {/* Center vertical post */}
      <rect x="29" y="62" width="12" height="18" rx="1.5"
        fill="#a06030" stroke="#6b3d18" strokeWidth="0.9" />
      {/* Post wood grain */}
      <line x1="32" y1="65" x2="32" y2="78" stroke="#6b3d18" strokeWidth="0.5" opacity="0.5" />
      {/* Horizontal crossbar (top of T) */}
      <rect x="14" y="58" width="42" height="5" rx="1"
        fill="#8b5020" stroke="#6b3d18" strokeWidth="0.9" />
      {/* Base foot */}
      <rect x="18" y="78" width="34" height="4" rx="1"
        fill="#8b5020" stroke="#6b3d18" strokeWidth="0.9" />

      {/* ── Log cabin body ── */}
      <rect x="4" y="36" width="62" height="26" rx="1.5"
        fill="#b8692a" stroke="#7a3d12" strokeWidth="1" />
      {/* Horizontal log seam lines every 4 px */}
      <line x1="4"  y1="40" x2="66" y2="40" stroke="#7a3d12" strokeWidth="0.85" />
      <line x1="4"  y1="44" x2="66" y2="44" stroke="#7a3d12" strokeWidth="0.85" />
      <line x1="4"  y1="48" x2="66" y2="48" stroke="#7a3d12" strokeWidth="0.85" />
      <line x1="4"  y1="52" x2="66" y2="52" stroke="#7a3d12" strokeWidth="0.85" />
      <line x1="4"  y1="56" x2="66" y2="56" stroke="#7a3d12" strokeWidth="0.85" />
      {/* Log end-grain circles on the left side */}
      <ellipse cx="5" cy="38" rx="2" ry="2" fill="#c87840" stroke="#7a3d12" strokeWidth="0.6" />
      <ellipse cx="5" cy="42" rx="2" ry="2" fill="#c87840" stroke="#7a3d12" strokeWidth="0.6" />
      <ellipse cx="5" cy="46" rx="2" ry="2" fill="#c87840" stroke="#7a3d12" strokeWidth="0.6" />
      <ellipse cx="5" cy="50" rx="2" ry="2" fill="#c87840" stroke="#7a3d12" strokeWidth="0.6" />
      <ellipse cx="5" cy="54" rx="2" ry="2" fill="#c87840" stroke="#7a3d12" strokeWidth="0.6" />
      <ellipse cx="5" cy="58" rx="2" ry="2" fill="#c87840" stroke="#7a3d12" strokeWidth="0.6" />

      {/* ── Arched mailbox opening ──
          Semi-arch (10px radius) spanning the left half of the body front face. */}
      <path d="M15,62 L15,46 A11,11 0 0,1 37,46 L37,62 Z" fill="#140a02" />
      {/* Metal rim */}
      <path d="M15,46 A11,11 0 0,1 37,46"
        stroke="#9b8060" strokeWidth="1.3" fill="none" />
      {/* Inner depth shadow */}
      <path d="M17,62 L17,47 A9,9 0 0,1 35,47 L35,62 Z"
        fill="#0d0805" opacity="0.5" />

      {/* ── Cedar roof ── */}
      <polygon points="1,36 35,8 69,36" fill="#9b4e1e" />
      {/* Shingle rows (clipped inside the roof triangle) */}
      <g clipPath="url(#ccRoofClip)" stroke="#7a3d0e" strokeWidth="0.8" opacity="0.85">
        <line x1="0" y1="13" x2="70" y2="13" />
        <line x1="0" y1="18" x2="70" y2="18" />
        <line x1="0" y1="23" x2="70" y2="23" />
        <line x1="0" y1="28" x2="70" y2="28" />
        <line x1="0" y1="33" x2="70" y2="33" />
      </g>
      {/* Ridge highlight */}
      <line x1="35" y1="8" x2="35" y2="15"
        stroke="#c8702a" strokeWidth="1.1" opacity="0.6" />
      {/* Roof outline */}
      <polygon points="1,36 35,8 69,36"
        fill="none" stroke="#6b3010" strokeWidth="1.2" />

      {/* ── Stone chimney (right side of roof, protrudes through slope) ── */}
      <rect x="46" y="16" width="10" height="22"
        fill="#8c8882" stroke="#5c5852" strokeWidth="1" />
      {/* Stone course lines */}
      <line x1="46" y1="20" x2="56" y2="20" stroke="#5c5852" strokeWidth="0.7" />
      <line x1="46" y1="24" x2="56" y2="24" stroke="#5c5852" strokeWidth="0.7" />
      <line x1="46" y1="28" x2="56" y2="28" stroke="#5c5852" strokeWidth="0.7"/>
      <line x1="46" y1="32" x2="56" y2="32" stroke="#5c5852" strokeWidth="0.7" />
      {/* Vertical break (alternating bond) */}
      <line x1="51" y1="16" x2="51" y2="38"
        stroke="#5c5852" strokeWidth="0.5" opacity="0.55" />
      {/* Chimney cap */}
      <rect x="44" y="13" width="14" height="4"
        fill="#6b6460" stroke="#3a3430" strokeWidth="0.9" />
      {/* Pointed cap */}
      <polygon points="44,13 51,8 58,13"
        fill="#5a5450" stroke="#3a3430" strokeWidth="0.9" />

      {/* ── Flag ── */}
      {/* Pole attached to right side of body */}
      <rect x="63" y="36" width="2.5" height="24"
        fill="#6b5030" stroke="#4a3020" strokeWidth="0.6" />
      {/* Red flag triangle pointing right */}
      <polygon points="64,36 64,46 73,41"
        fill="#dc2626" stroke="#9b1c1c" strokeWidth="0.8" />

    </svg>
  )
}

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
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext
            hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <WaxSealLetterIcon size={48} />
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
            <div className="flex justify-center mb-5">
              <CabinMailboxIcon size={56} />
            </div>
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
