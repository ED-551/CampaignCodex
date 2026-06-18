/**
 * BestiaryPage — /bestiary/:system
 *
 * Lists a user's custom monsters for one game system. Supports creating,
 * editing, and deleting monsters.
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

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link }      from 'react-router-dom'
import { ArrowLeft, BookOpen, Plus, Trash2, X, Pencil } from 'lucide-react'
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
  text-codex-text placeholder-codex-muted text-sm
  focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
  transition-colors disabled:opacity-40`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BestiaryPage() {
  const { system }  = useParams()
  const navigate    = useNavigate()
  const meta        = SYSTEM_META[system]

  const [monsters,      setMonsters]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  // Full-page form (Shadowdark only)
  const [formView,      setFormView]      = useState(false)
  const [formTarget,    setFormTarget]    = useState(null)   // null = create, object = edit

  // Modal (non-Shadowdark systems)
  const [showModal,     setShowModal]     = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)

  // Delete
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Redirect unknown system slugs
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-semibold text-codex-text">{meta.label} Bestiary</h1>
              <p className="text-xs text-codex-muted mt-0.5">
                Your custom monsters — owned by you, usable in any campaign
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg
              bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all"
          >
            <Plus size={14} /> New Monster
          </button>
        </div>

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

        {!loading && !error && monsters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {monsters.map(m => (
              <MonsterCard
                key={m.id}
                monster={m}
                meta={meta}
                system={system}
                onEdit={() => openEdit(m)}
                onDelete={() => setDeleteTarget(m)}
              />
            ))}
          </div>
        )}
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
    </div>
  )
}

// ─── Monster Card ─────────────────────────────────────────────────────────────

function MonsterCard({ monster, meta, system, onEdit, onDelete }) {
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

  return (
    <div className={`group relative flex flex-col gap-3 p-4
      bg-codex-surface border border-codex-border rounded-xl
      transition-all duration-150 ${meta.cardBorder}`}>

      {/* Action buttons — revealed on hover */}
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
                <StatPip label="Type" value="Legendary" />
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
