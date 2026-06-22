/**
 * BestiaryPage — /bestiary/:system
 *
 * Lists a user's custom monsters for one game system. Supports creating,
 * editing, and deleting monsters. Supports share mode for sending monsters
 * to other users.
 *
 * Full-page stat block builders:
 *   Shadowdark : ShadowdarkMonsterForm (amber theme)
 *   Mörk Borg  : MorkborgMonsterForm   (near-black + yellow theme)
 *   Nimble RPG : NimbleMonsterForm      (emerald theme, tier selection)
 *
 * Card display per system:
 *   Shadowdark : "Lv. 3" — numeric challenge gets the prefix; free text shown as-is
 *   Mörk Borg  : "HP 12" — numeric challenge gets the prefix; free text shown as-is
 *   Nimble RPG : "Lv. 3" — numeric challenge gets the prefix; free text shown as-is
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link }      from 'react-router-dom'
import { ArrowLeft, BookOpen, Plus, Trash2, X, Pencil, Share2, Send, Check, Square, CheckSquare, Search, Inbox } from 'lucide-react'
import { Helmet }                            from 'react-helmet-async'
import { api }                               from '../utils/api'
import ShadowdarkMonsterForm                 from '../components/bestiary/ShadowdarkMonsterForm'
import MorkborgMonsterForm                   from '../components/bestiary/MorkborgMonsterForm'
import NimbleMonsterForm                     from '../components/bestiary/NimbleMonsterForm'

// ─── System metadata ──────────────────────────────────────────────────────────

const SYSTEM_META = {
  shadowdark: {
    label:                'Shadowdark',
    icon:                 '🗡️',
    color:                'text-amber-500',
    badgeClass:           'text-amber-500 bg-amber-500/10 border-amber-500/30',
    cardBorder:           'hover:border-amber-500/50',
    challengeLabel:       'Level',
    challengePlaceholder: 'e.g. 3',
    tagsPlaceholder:      'e.g. Undead, Humanoid',
    formatChallenge: c => c ? (/^\d+$/.test(c.trim()) ? `Lv. ${c.trim()}` : c) : null,
  },
  morkborg: {
    label:                'Mörk Borg',
    icon:                 '💀',
    color:                'text-yellow-300',
    badgeClass:           'text-yellow-300 bg-yellow-300/10 border-yellow-300/30',
    cardBorder:           'hover:border-yellow-300/40',
    challengeLabel:       'HP',
    challengePlaceholder: 'e.g. 12',
    tagsPlaceholder:      'e.g. Undead, Spectral',
    // challenge stores raw HP; prefix it for display
    formatChallenge: c => c ? (/^\d+$/.test(c.trim()) ? `HP ${c.trim()}` : c) : null,
  },
  nimble: {
    label:                'Nimble RPG',
    icon:                 '🛡️',
    color:                'text-emerald-400',
    badgeClass:           'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    cardBorder:           'hover:border-emerald-400/40',
    challengeLabel:       'Level',
    challengePlaceholder: 'e.g. 3',
    tagsPlaceholder:      'e.g. Beast, Aerial',
    // challenge stores the level string; prefix numeric values for display
    formatChallenge: c => c ? (/^\d+$/.test(c.trim()) ? `Lv. ${c.trim()}` : c) : null,
  },
}

// Systems that have a full-page stat block form (vs the lightweight modal)
const FULL_FORM_SYSTEMS = ['shadowdark', 'morkborg', 'nimble']

const INPUT = `w-full bg-codex-surface border border-codex-border rounded-lg px-4 py-2.5
  text-codex-text placeholder-codex-muted text-base sm:text-sm
  focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
  transition-colors disabled:opacity-40`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseChallengeLevel(c) {
  if (!c) return 999
  const s = c.trim()
  if (s.includes('/')) {
    const [a, b] = s.split('/')
    return parseFloat(a) / parseFloat(b)
  }
  const n = parseFloat(s)
  return isNaN(n) ? 999 : n
}

function sortMonsters(arr, order) {
  const copy = [...arr]
  if (order === 'alpha') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (order === 'level') return copy.sort((a, b) =>
    parseChallengeLevel(a.challenge) - parseChallengeLevel(b.challenge)
  )
  // 'created' — newest first
  return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BestiaryPage() {
  // The URL param (:system) is the single source of truth for which game system
  // is being viewed. It maps directly into SYSTEM_META to get display labels,
  // theme colours, and field-formatting rules. An unrecognised slug produces
  // meta = undefined, which the effect below redirects away from immediately.
  //
  // There is no "All Systems" view at this route — the dashboard links each
  // system separately (/bestiary/shadowdark, /bestiary/morkborg, etc.). The API
  // call at /bestiary?system=<slug> already filters server-side, so the client
  // never loads monsters for other systems on this page.
  const { system }  = useParams()
  const navigate    = useNavigate()
  const meta        = SYSTEM_META[system]

  const [monsters,      setMonsters]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  // Full-page form (systems in FULL_FORM_SYSTEMS: shadowdark, morkborg, nimble)
  //
  // Two pieces of state are needed here, not one, because they carry orthogonal
  // information:
  //   formView   — a boolean gate: should the list view be replaced by a form?
  //   formTarget — the identity of what the form is editing (null = create new,
  //                monster object = editing an existing record).
  //
  // A single combined value (e.g. { open, target }) would work but makes the
  // conditional renders noisier. Keeping them separate also lets handleSaved
  // reset both independently without a spread-and-mutate pattern.
  //
  // Transitions:
  //   openCreate()  → formTarget = null,    formView = true   (blank form)
  //   openEdit(m)   → formTarget = monster, formView = true   (pre-filled form)
  //   handleSaved() → formTarget = null,    formView = false  (back to list)
  //   formBack()    → formTarget = null,    formView = false  (user cancelled)
  const [formView,      setFormView]      = useState(false)
  const [formTarget,    setFormTarget]    = useState(null)   // null = create, object = edit

  // Modal (non-Shadowdark systems)
  const [showModal,     setShowModal]     = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)

  // Delete
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Sort + share
  const [sortOrder,      setSortOrder]      = useState('created') // 'created' | 'level' | 'alpha'
  const [shareMode,      setShareMode]      = useState(false)
  const [selectedIds,    setSelectedIds]    = useState(new Set())
  const [showShareModal, setShowShareModal] = useState(false)

  // Pending share count — shown as a badge on the Inbox button
  const [pendingShares,  setPendingShares]  = useState(0)
  useEffect(() => {
    api.get('/bestiary/shares/inbox')
      .then(({ shares }) => setPendingShares(shares.length))
      .catch(() => {})
  }, [])

  // Guards against manually typed or bookmarked URLs with invalid system slugs
  // (e.g. /bestiary/dnd5e). replace:true keeps the history stack clean so the
  // user doesn't land back here if they press Back from the dashboard.
  useEffect(() => {
    if (!meta) navigate('/dashboard', { replace: true })
  }, [meta, navigate])

  // Load monsters for this system
  const loadMonsters = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { monsters: list } = await api.get(`/bestiary?system=${system}`)
      setMonsters(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [system])

  // Re-fetches whenever the system slug changes (navigation between systems).
  // Wrapped in useCallback so this effect only fires when system truly changes,
  // not on every parent re-render.
  useEffect(() => { loadMonsters() }, [loadMonsters])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openCreate() {
    if (FULL_FORM_SYSTEMS.includes(system)) {
      setFormTarget(null)
      setFormView(true)
    } else {
      setEditTarget(null)
      setShowModal(true)
    }
  }

  function openEdit(monster) {
    if (FULL_FORM_SYSTEMS.includes(system)) {
      setFormTarget(monster)
      setFormView(true)
    } else {
      setEditTarget(monster)
      setShowModal(true)
    }
  }

  function handleSaved(updated) {
    // Upsert into local list
    setMonsters(prev => {
      const exists = prev.some(m => m.id === updated.id)
      return exists
        ? prev.map(m => m.id === updated.id ? updated : m)
        : [updated, ...prev]
    })
    setFormView(false)
    setFormTarget(null)
    setShowModal(false)
    setEditTarget(null)
  }

  async function handleDelete(monsterId) {
    setDeleteLoading(true)
    try {
      await api.delete(`/bestiary/${monsterId}`)
      setMonsters(prev => prev.filter(m => m.id !== monsterId))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Share mode handlers ────────────────────────────────────────────────────

  function toggleShareMode() {
    setShareMode(v => !v)
    setSelectedIds(new Set())
    setShowShareModal(false)
  }

  function toggleSelect(id) {
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

  function handleShared() {
    setShareMode(false)
    setSelectedIds(new Set())
    setShowShareModal(false)
  }

  if (!meta) return null

  // ── Full-page form (system-specific) ──────────────────────────────────────

  const formBack = () => { setFormView(false); setFormTarget(null) }

  if (system === 'shadowdark' && formView) {
    return (
      <ShadowdarkMonsterForm existing={formTarget} onBack={formBack} onSaved={handleSaved} />
    )
  }

  if (system === 'morkborg' && formView) {
    return (
      <MorkborgMonsterForm existing={formTarget} onBack={formBack} onSaved={handleSaved} />
    )
  }

  if (system === 'nimble' && formView) {
    return (
      <NimbleMonsterForm existing={formTarget} onBack={formBack} onSaved={handleSaved} />
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-codex-bg">
      <Helmet><title>{meta?.label ? `${meta.label} Bestiary` : 'Bestiary'} — CampaignCodex</title></Helmet>

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
          <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Back link ── */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext
            hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* ── Section header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-semibold text-codex-text">{meta.label} Bestiary</h1>
              <p className="text-xs text-codex-muted mt-0.5">
                Your custom monsters — owned by you, usable in any campaign
              </p>
            </div>
          </div>

          {shareMode ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                  border border-codex-border text-codex-subtext
                  hover:border-codex-text hover:text-codex-text transition-colors"
              >
                {selectedIds.size > 0 && selectedIds.size === monsters.length
                  ? <CheckSquare size={12} />
                  : <Square size={12} />
                }
                {selectedIds.size === monsters.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg
                  bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={13} />
                {selectedIds.size > 0
                  ? `Share ${selectedIds.size} Monster${selectedIds.size !== 1 ? 's' : ''}`
                  : 'Share Monsters'}
              </button>
              <button
                onClick={toggleShareMode}
                className="flex items-center gap-1 text-sm text-codex-muted
                  hover:text-codex-text transition-colors px-2 py-2"
                title="Cancel"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Inbox — always visible; badge shows pending count */}
              <Link
                to="/bestiary/shares"
                className="relative flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg
                  border border-codex-border text-codex-subtext
                  hover:border-codex-gold hover:text-codex-gold transition-all"
                title="Monster share inbox"
              >
                <Inbox size={14} /> Inbox
                {pendingShares > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full
                    bg-codex-gold text-codex-bg text-[10px] font-bold flex items-center justify-center px-1">
                    {pendingShares > 9 ? '9+' : pendingShares}
                  </span>
                )}
              </Link>
              {monsters.length > 0 && (
                <button
                  onClick={toggleShareMode}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg
                    border border-codex-border text-codex-subtext
                    hover:border-codex-gold hover:text-codex-gold transition-all"
                  title="Share monsters with a friend"
                >
                  <Share2 size={14} /> Share
                </button>
              )}
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg
                  bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all"
              >
                <Plus size={14} /> New Monster
              </button>
            </div>
          )}
        </div>

        {/* ── Sort controls ── */}
        {!loading && !error && monsters.length > 0 && (
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs text-codex-muted">Sort:</span>
            {[
              { key: 'created', label: 'Date Added' },
              { key: 'level',   label: 'Level / HP' },
              { key: 'alpha',   label: 'A–Z' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortOrder(key)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  sortOrder === key
                    ? 'border-codex-gold text-codex-gold bg-codex-gold/10'
                    : 'border-codex-border text-codex-muted hover:border-codex-subtext hover:text-codex-subtext'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading && (
          <div className="text-center text-codex-muted animate-pulse py-24 text-sm">
            Loading bestiary…
          </div>
        )}

        {error && (
          <div className="text-center text-red-400 py-24 text-sm">{error}</div>
        )}

        {!loading && !error && monsters.length === 0 && (
          <div className="border border-dashed border-codex-border rounded-xl p-16 text-center">
            <p className="text-4xl mb-4">{meta.icon}</p>
            <p className="text-codex-subtext text-sm mb-4">
              No monsters yet. Create your first {meta.label} creature.
            </p>
            <button
              onClick={openCreate}
              className="text-codex-gold hover:text-codex-goldHover text-sm transition-colors"
            >
              + Create a monster
            </button>
          </div>
        )}

        {!loading && !error && monsters.length > 0 && (() => {
          // For Nimble: split into entry vs legendary, sort each group
          if (system === 'nimble') {
            const entry     = sortMonsters(monsters.filter(m => (m.stat_data?.monsterTier ?? 'entry') !== 'legendary'), sortOrder)
            const legendary = sortMonsters(monsters.filter(m => m.stat_data?.monsterTier === 'legendary'), sortOrder)
            return (
              <div className="space-y-10">
                {entry.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-widest">
                        Bestiary
                      </h2>
                      <span className="text-xs text-codex-muted">
                        ({entry.length} monsters)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {entry.map(m => (
                        <MonsterCard key={m.id} monster={m} meta={meta} system={system}
                          onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)}
                          shareMode={shareMode}
                          selected={selectedIds.has(m.id)}
                          onSelect={() => toggleSelect(m.id)} />
                      ))}
                    </div>
                  </section>
                )}

                {legendary.length > 0 && (
                  <section>
                    {/* Legendary divider */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-codex-gold/60 to-transparent" />
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full
                        border border-codex-gold/40 bg-codex-gold/5">
                        <span className="text-codex-gold text-xs">⚔</span>
                        <span className="text-xs font-bold text-codex-gold uppercase tracking-widest">
                          Legendary Monsters
                        </span>
                        <span className="text-xs text-codex-muted">({legendary.length})</span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-l from-codex-gold/60 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {legendary.map(m => (
                        <MonsterCard key={m.id} monster={m} meta={meta} system={system}
                          onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)}
                          shareMode={shareMode}
                          selected={selectedIds.has(m.id)}
                          onSelect={() => toggleSelect(m.id)} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )
          }

          // All other systems: flat grid
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortMonsters(monsters, sortOrder).map(m => (
                <MonsterCard
                  key={m.id}
                  monster={m}
                  meta={meta}
                  system={system}
                  onEdit={() => openEdit(m)}
                  onDelete={() => setDeleteTarget(m)}
                  shareMode={shareMode}
                  selected={selectedIds.has(m.id)}
                  onSelect={() => toggleSelect(m.id)}
                />
              ))}
            </div>
          )
        })()}
      </main>

      {/* ── Modal (non-Shadowdark systems) ── */}
      {showModal && (
        <MonsterFormModal
          system={system}
          meta={meta}
          existing={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <DeleteModal
          monster={deleteTarget}
          loading={deleteLoading}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-codex-border/30 py-4 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-codex-muted/50">
            © {new Date().getFullYear()} CampaignCodex · All rights reserved
          </p>
        </div>
      </footer>

      {/* ── Share Modal ── */}
      {showShareModal && (
        <ShareModal
          monsters={monsters}
          selectedIds={selectedIds}
          system={system}
          meta={meta}
          onClose={() => setShowShareModal(false)}
          onShared={handleShared}
        />
      )}
    </div>
  )
}

// ─── Monster Card ─────────────────────────────────────────────────────────────

function MonsterCard({ monster, meta, system, onEdit, onDelete, shareMode = false, selected = false, onSelect }) {
  const challenge = meta.formatChallenge(monster.challenge)
  const tagList   = monster.tags
    ? monster.tags.split(',').map(t => t.trim()).filter(Boolean)
    : []

  // Stat block summary from JSONB — per system
  const sd = monster.stat_data ?? {}
  const hasStatBlock = system === 'shadowdark'
    ? Boolean(sd.ac || sd.hp || sd.level != null)
    : system === 'morkborg'
    ? Boolean(sd.hp || sd.morale || sd.armor)
    : system === 'nimble'
    ? Boolean(sd.hp || sd.level)
    : false

  const isLegendary = system === 'nimble' && sd.monsterTier === 'legendary'

  return (
    <div
      onClick={shareMode ? onSelect : undefined}
      className={`group relative flex flex-col gap-3 p-4
        bg-codex-surface border rounded-xl
        transition-all duration-150
        ${shareMode ? 'cursor-pointer' : ''}
        ${shareMode && selected
          ? 'border-codex-gold ring-1 ring-codex-gold/30 bg-codex-gold/5'
          : isLegendary
          ? 'border-codex-gold/30 hover:border-codex-gold/60 bg-gradient-to-br from-codex-surface to-codex-gold/5'
          : `border-codex-border ${meta.cardBorder}`
        }`}
    >

      {shareMode ? (
        /* Share-mode checkbox */
        <div className="absolute top-3 right-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            selected
              ? 'bg-codex-gold border-codex-gold'
              : 'border-codex-border bg-codex-bg'
          }`}>
            {selected && <Check size={11} className="text-codex-bg" strokeWidth={3} />}
          </div>
        </div>
      ) : (
        /* Normal edit/delete buttons */
        <div className="absolute top-3 right-3 flex items-center gap-1
          opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-codex-muted hover:text-codex-gold
              hover:bg-codex-bg border border-transparent hover:border-codex-border transition-all"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-codex-muted hover:text-red-400
              hover:bg-red-500/5 border border-transparent hover:border-red-500/30 transition-all"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Name */}
      <div className="pr-14">
        <h3 className="text-sm font-semibold text-codex-text leading-snug">
          {monster.name}
        </h3>
        {sd?.combatRole && (
          <p className="text-[10px] text-codex-muted mt-0.5 capitalize">{sd.combatRole}</p>
        )}
      </div>

      {/* Challenge + tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        {challenge && (
          <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${meta.badgeClass}`}>
            {challenge}
          </span>
        )}
        {tagList.map(tag => (
          <span key={tag}
            className="text-[10px] text-codex-muted border border-codex-border
              rounded-full px-2 py-0.5 bg-codex-bg">
            {tag}
          </span>
        ))}
        {!challenge && tagList.length === 0 && (
          <span className="text-[10px] text-codex-muted italic">No details yet</span>
        )}
      </div>

      {/* Stat block summary */}
      <div className="border-t border-codex-border/60 pt-2 mt-auto">
        {hasStatBlock ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {/* Shadowdark */}
            {system === 'shadowdark' && <>
              {sd.ac    != null && <StatPip label="AC"  value={sd.ac} />}
              {sd.hp    != null && <StatPip label="HP"  value={sd.hp} />}
              {sd.level != null && <StatPip label="LV"  value={sd.level} />}
              {sd.movement      && <StatPip label="MV"  value={sd.movement} />}
              {sd.attacks?.length > 0 && (
                <StatPip label="ATK" value={`${sd.attacks.length}×`} />
              )}
              {sd.talents?.length > 0 && (
                <StatPip label="Talents" value={sd.talents.length} />
              )}
            </>}
            {/* Mörk Borg */}
            {system === 'morkborg' && <>
              {sd.hp     != null && <StatPip label="HP"     value={sd.hp} />}
              {sd.morale          && <StatPip label="Morale" value={sd.morale} />}
              {sd.armor           && <StatPip label="Armor"  value={sd.armor} />}
              {sd.attacks?.length > 0 && (
                <StatPip label="ATK" value={`${sd.attacks.length}×`} />
              )}
            </>}
            {/* Nimble RPG */}
            {system === 'nimble' && <>
              {sd.level           && <StatPip label="LV"    value={sd.level} />}
              {sd.hp     != null  && <StatPip label="HP"    value={sd.hp} />}
              {sd.armor && sd.armor !== 'none' && (
                <StatPip label="Armor" value={sd.armor === 'heavy' ? 'Heavy' : 'Medium'} />
              )}
              {sd.monsterTier === 'entry' && sd.attacks?.length > 0 && (
                <StatPip label="ATK" value={`${sd.attacks.length}×`} />
              )}
              {sd.monsterTier === 'legendary' && (
                <span className="text-[10px] font-bold text-codex-gold border border-codex-gold/40
                  rounded-full px-2 py-0.5 bg-codex-gold/5">⚔ Legendary</span>
              )}
              {sd.monsterTier === 'legendary' && sd.actions?.length > 0 && (
                <StatPip label="Actions" value={sd.actions.length} />
              )}
            </>}
          </div>
        ) : FULL_FORM_SYSTEMS.includes(system) ? (
          <p className="text-[10px] text-codex-muted">
            📋 Click <span className="text-codex-subtext">edit</span> to fill in the stat block
          </p>
        ) : (
          <p className="text-[10px] text-codex-muted">📋 Stat block form coming soon</p>
        )}
      </div>

      {/* Attribution — only shown for monsters received via share */}
      {monster.shared_from_username && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-codex-muted italic">
            Shared by <span className="text-codex-subtext font-medium">{monster.shared_from_username}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function StatPip({ label, value }) {
  return (
    <span className="text-[10px] text-codex-muted">
      <span className="font-bold text-codex-subtext">{label}</span> {value}
    </span>
  )
}

// ─── Create / Edit Form Modal (non-Shadowdark systems) ────────────────────────

function MonsterFormModal({ system, meta, existing, onClose, onSaved }) {
  const isEdit = Boolean(existing)

  const [name,      setName]      = useState(existing?.name      ?? '')
  const [challenge, setChallenge] = useState(existing?.challenge ?? '')
  const [tags,      setTags]      = useState(existing?.tags      ?? '')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  // Escape closes the form unless a save is in flight, preventing data loss on
  // accidental dismissal (the form state would be destroyed on unmount).
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loading, onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Monster name is required.'); return }
    setLoading(true)
    try {
      let monster
      if (isEdit) {
        const res = await api.patch(`/bestiary/${existing.id}`, {
          name:      name.trim(),
          challenge: challenge.trim() || null,
          tags:      tags.trim()      || null,
        })
        monster = res.monster
      } else {
        const res = await api.post('/bestiary', {
          name:       name.trim(),
          gameSystem: system,
          challenge:  challenge.trim() || null,
          tags:       tags.trim()      || null,
        })
        monster = res.monster
      }
      onSaved(monster)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div className="relative w-full max-w-md bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-codex-text">
              {isEdit ? 'Edit Monster' : `New ${meta.label} Monster`}
            </h2>
            <p className="text-xs text-codex-subtext mt-0.5">
              {isEdit ? 'Update the details for this creature.' : 'Fill in what you know now — stat block fields coming soon.'}
            </p>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="text-codex-muted hover:text-codex-text transition-colors p-1
                rounded-lg hover:bg-codex-surface ml-2"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-codex-text">
              Monster Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Corpse-Hauler, Ash Revenant, Rotting Warden"
              maxLength={100} disabled={loading} autoFocus className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-codex-text">
              {meta.challengeLabel}
              <span className="ml-1 text-xs font-normal text-codex-muted">(optional)</span>
            </label>
            <input type="text" value={challenge} onChange={e => setChallenge(e.target.value)}
              placeholder={meta.challengePlaceholder} maxLength={50}
              disabled={loading} className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-codex-text">
              Type / Tags
              <span className="ml-1 text-xs font-normal text-codex-muted">(optional, comma-separated)</span>
            </label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)}
              placeholder={meta.tagsPlaceholder} maxLength={200}
              disabled={loading} className={INPUT} />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext
                text-sm hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-codex-gold hover:bg-codex-goldHover
                text-codex-bg font-semibold text-sm transition-all
                disabled:opacity-30 disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin" />
                : isEdit ? 'Save Changes' : 'Create Monster'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({ monster, loading, onConfirm, onCancel }) {
  // Escape is blocked while the DELETE request is in flight so the modal can't
  // be dismissed in a half-deleted state.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !loading) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loading, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel() }}
    >
      <div className="w-full max-w-sm bg-codex-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30
              flex items-center justify-center">
              <Trash2 size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-codex-text">Delete monster?</p>
              <p className="text-xs text-codex-subtext mt-0.5">This cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-codex-subtext leading-relaxed">
            <span className="font-semibold text-codex-text">{monster.name}</span> will be
            permanently removed from your bestiary.
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext
                text-sm hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white
                font-semibold text-sm transition-all disabled:opacity-40
                flex items-center justify-center gap-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Trash2 size={13} /> Delete</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ monsters, selectedIds, system, meta, onClose, onShared }) {
  const selectedMonsters = monsters.filter(m => selectedIds.has(m.id))

  const [contacts,       setContacts]       = useState([])
  const [contactsLoaded, setContactsLoaded] = useState(false)
  const [recipient,      setRecipient]      = useState(null)  // { id, username }
  const [searchQuery,    setSearchQuery]    = useState('')
  const [searchResults,  setSearchResults]  = useState([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [showResults,    setShowResults]    = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState(false)

  const searchRef  = useRef(null)
  const timerRef   = useRef(null)

  // Escape is blocked while a share is in flight (loading=true) to prevent
  // accidental dismissal while the POST is pending.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loading, onClose])

  // Pre-loads the user's raven contacts (people they've previously shared with
  // or campaigned with) to show as quick-pick chips above the search field.
  // Empty dep array = once on modal open; failure is silently swallowed because
  // contacts are a convenience shortcut, not a required flow.
  useEffect(() => {
    api.get('/users/contacts')
      .then(({ contacts: list }) => setContacts(list))
      .catch(() => {})
      .finally(() => setContactsLoaded(true))
  }, [])

  // Debounces the username search input (300 ms) to avoid hammering the API on
  // every keystroke. Short queries (< 2 chars) are ignored to prevent returning
  // too many results. The timer is cleared both on the next keystroke and on
  // unmount via the returned cleanup function.
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const { users } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
        setSearchResults(users)
        setShowResults(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [searchQuery])

  // Closes the search results dropdown when the user clicks anywhere outside the
  // search container (tracked via searchRef). Uses mousedown rather than click
  // so the handler fires before the button's onClick, preventing a race where the
  // dropdown is still open when a result is selected.
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectRecipient(user) {
    setRecipient(user)
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  // Sharing is a server-side inbox model, not a public URL/token link.
  // POSTing to /bestiary/shares creates a share record owned by the recipient
  // (identified by their user ID). The recipient sees it in their /bestiary/shares
  // inbox and can choose to import individual monsters into their own bestiary.
  // No share token or expiry is involved — the sender keeps their originals.
  async function handleShare() {
    if (!recipient) return
    setError('')
    setLoading(true)
    try {
      await api.post('/bestiary/shares', {
        toUserId:   recipient.id,
        monsterIds: [...selectedIds],
      })
      setSuccess(true)
      setTimeout(() => {
        onShared()
        onClose()
      }, 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div className="relative w-full max-w-md bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-codex-border/40">
          <div>
            <h2 className="text-base font-semibold text-codex-text flex items-center gap-2">
              <Share2 size={16} className="text-codex-gold" />
              Share Monsters
            </h2>
            <p className="text-xs text-codex-subtext mt-0.5">
              Sharing <span className="text-codex-gold font-medium">{selectedMonsters.length}</span> monster{selectedMonsters.length !== 1 ? 's' : ''} from your {meta.label} bestiary
            </p>
          </div>
          {!loading && (
            <button onClick={onClose}
              className="text-codex-muted hover:text-codex-text p-1 rounded-lg hover:bg-codex-surface transition-colors ml-2">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Monster preview chips */}
          <div>
            <p className="text-xs font-medium text-codex-subtext mb-2">Monsters to share:</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectedMonsters.map(m => (
                <span key={m.id}
                  className={`text-xs border rounded-full px-2.5 py-0.5 ${meta.badgeClass}`}>
                  {m.name}
                </span>
              ))}
            </div>
          </div>

          {/* Recipient selector */}
          <div>
            <p className="text-xs font-medium text-codex-subtext mb-2">Send to:</p>

            {/* Selected recipient chip */}
            {recipient ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-codex-gold/10
                border border-codex-gold/40">
                <div className="w-6 h-6 rounded-full bg-codex-gold/20 border border-codex-gold/40
                  flex items-center justify-center text-xs font-bold text-codex-gold">
                  {recipient.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-codex-text font-medium flex-1">@{recipient.username}</span>
                <button onClick={() => setRecipient(null)}
                  className="text-codex-muted hover:text-codex-text transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Friends dropdown */}
                {contactsLoaded && contacts.length > 0 && (
                  <div>
                    <p className="text-[10px] text-codex-muted mb-1.5 uppercase tracking-wider">Your contacts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {contacts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => selectRecipient(c)}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full
                            border border-codex-border text-codex-subtext
                            hover:border-codex-gold hover:text-codex-gold hover:bg-codex-gold/5
                            transition-all"
                        >
                          <span className="w-4 h-4 rounded-full bg-codex-surface border border-codex-border
                            flex items-center justify-center text-[9px] font-bold">
                            {c.username[0].toUpperCase()}
                          </span>
                          @{c.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Username search */}
                <div>
                  <p className="text-[10px] text-codex-muted mb-1.5 uppercase tracking-wider">
                    {contacts.length > 0 ? 'Or search by username' : 'Enter a username'}
                  </p>
                  <div ref={searchRef} className="relative">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-codex-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowResults(true)}
                        placeholder="Type a username…"
                        maxLength={20}
                        className="w-full bg-codex-surface border border-codex-border rounded-lg
                          pl-8 pr-4 py-2 text-sm text-codex-text placeholder-codex-muted
                          focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
                          transition-colors"
                      />
                      {searchLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2
                          w-3.5 h-3.5 border-2 border-codex-border border-t-codex-gold
                          rounded-full animate-spin" />
                      )}
                    </div>

                    {/* Search results dropdown */}
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-full mt-1 w-full bg-codex-card border border-codex-border
                        rounded-lg shadow-xl z-10 overflow-hidden">
                        {searchResults.map(u => (
                          <button
                            key={u.id}
                            onClick={() => selectRecipient(u)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-codex-subtext
                              hover:bg-codex-surface hover:text-codex-text transition-colors text-left"
                          >
                            <span className="w-6 h-6 rounded-full bg-codex-surface border border-codex-border
                              flex items-center justify-center text-xs font-bold text-codex-gold">
                              {u.username[0].toUpperCase()}
                            </span>
                            @{u.username}
                          </button>
                        ))}
                      </div>
                    )}
                    {showResults && !searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                      <div className="absolute top-full mt-1 w-full bg-codex-card border border-codex-border
                        rounded-lg shadow-xl z-10 px-3 py-2.5 text-xs text-codex-muted">
                        No users found matching "@{searchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          {success && (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-400 py-2">
              <Check size={16} /> Raven dispatched! Your monsters are on their way.
            </div>
          )}

          {/* Actions */}
          {!success && (
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext
                  text-sm hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={loading || !recipient}
                className="flex-1 py-2.5 rounded-xl bg-codex-gold hover:bg-codex-goldHover
                  text-codex-bg font-semibold text-sm transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin" />
                  : <><Send size={13} /> Send Raven</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
