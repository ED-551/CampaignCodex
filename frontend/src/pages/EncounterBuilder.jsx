/**
 * EncounterBuilder — /encounters/new  /encounters/:id/edit
 *
 * Build or edit a saved encounter template. Monsters can be pulled from
 * the user's bestiary (auto-fills stats) or entered as custom inline entries.
 *
 * URL params:
 *   ?system=shadowdark   — pre-selects the game system (new encounters only)
 *   ?campaignId=uuid     — back-link destination after save
 *
 * Encounter monster entry shape:
 *   { _key, monsterId, name, count, hp, maxHp, ac, dexMod, notes, fromBestiary }
 *   _key        : local React key only — not sent to API
 *   monsterId   : UUID of bestiary entry, or null for custom inline
 *   fromBestiary: display-only flag
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, X, BookOpen, Sword, Save,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { api } from '../utils/api'
import PageShell from '../components/layout/PageShell'

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEMS = ['shadowdark', 'morkborg', 'nimble']
const SYSTEM_META = {
  shadowdark: { label: 'Shadowdark', badge: 'text-amber-500  bg-amber-500/10  border-amber-500/30'  },
  morkborg:   { label: 'Mörk Borg',  badge: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

const INP = `bg-codex-bg border border-codex-border rounded-lg px-3 py-2 text-sm text-codex-text
  placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 transition-colors
  disabled:opacity-40`

// DEX modifier from raw stat (standard RPG formula)
function dexMod(dex) {
  if (dex == null || isNaN(dex)) return 0
  return Math.floor((Number(dex) - 10) / 2)
}

// Generate a local-only key for new monster rows
let _keyCounter = 0
function newKey() { return `mk_${++_keyCounter}` }

// Build a blank monster row
function blankEntry() {
  return {
    _key: newKey(), monsterId: null, name: '', count: 1,
    hp: '', maxHp: '', ac: '', dexMod: 0, hitDie: '', talents: [],
    notes: '', fromBestiary: false,
  }
}

// Map a bestiary monster to an encounter entry
function fromBestiary(m) {
  const sd = m.stat_data ?? {}
  return {
    _key:         newKey(),
    monsterId:    m.id,
    name:         m.name,
    count:        1,
    hp:           sd.hp    != null ? String(sd.hp) : '',
    maxHp:        sd.hp    != null ? String(sd.hp) : '',
    ac:           sd.ac    != null ? String(sd.ac) : '',
    dexMod:       sd.stats?.dex != null ? dexMod(sd.stats.dex) : 0,
    hitDie:       sd.hitDie ?? '',
    talents:      Array.isArray(sd.talents) ? sd.talents : [],
    notes:        '',
    fromBestiary: true,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EncounterBuilder() {
  const { id: editId }   = useParams()          // present when editing
  const [searchParams]   = useSearchParams()
  const navigate         = useNavigate()

  const systemParam     = searchParams.get('system')
  const campaignIdParam = searchParams.get('campaignId')
  const fromParam       = searchParams.get('from')   // 'campaign' | 'settings' | null
  const isEdit          = Boolean(editId)

  // Form state
  const [system,       setSystem]       = useState(
    SYSTEMS.includes(systemParam) ? systemParam : 'shadowdark'
  )
  const [name,         setName]         = useState('')
  const [description,  setDescription]  = useState('')
  const [tags,         setTags]         = useState('')
  const [rows,         setRows]         = useState([])   // monster entries

  // UI state
  const [loading,      setLoading]      = useState(isEdit)  // loading existing encounter
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Bestiary picker modal
  const [showPicker,   setShowPicker]   = useState(false)
  const [pickMonsters, setPickMonsters] = useState([])
  const [pickLoading,  setPickLoading]  = useState(false)
  const [pickSearch,   setPickSearch]   = useState('')

  // ── Load existing encounter for edit ────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    api.get(`/encounters/${editId}`)
      .then(({ encounter }) => {
        setSystem(encounter.game_system)
        setName(encounter.name)
        setDescription(encounter.description ?? '')
        setTags(encounter.tags ?? '')
        setRows((encounter.monsters ?? []).map(m => ({
          _key:         newKey(),
          monsterId:    m.monsterId || null,
          name:         m.name,
          count:        m.count,
          hp:           String(m.hp),
          maxHp:        String(m.maxHp ?? m.hp),
          ac:           String(m.ac),
          dexMod:       m.dexMod ?? 0,
          hitDie:       m.hitDie ?? '',
          talents:      Array.isArray(m.talents) ? m.talents : [],
          notes:        m.notes ?? '',
          fromBestiary: Boolean(m.monsterId),
        })))
      })
      .catch(err => setSaveError(err.message))
      .finally(() => setLoading(false))
  }, [isEdit, editId])

  // ── Open bestiary picker ─────────────────────────────────────────────────────
  const openPicker = useCallback(async () => {
    setShowPicker(true)
    setPickSearch('')
    setPickLoading(true)
    try {
      const { monsters } = await api.get(`/bestiary?system=${system}`)
      setPickMonsters(monsters)
    } catch {
      setPickMonsters([])
    } finally {
      setPickLoading(false)
    }
  }, [system])

  // ── Add monster from bestiary ────────────────────────────────────────────────
  function pickMonster(monster) {
    setRows(prev => [...prev, fromBestiary(monster)])
    setShowPicker(false)
  }

  // ── Add blank custom monster ─────────────────────────────────────────────────
  function addCustom() {
    setRows(prev => [...prev, blankEntry()])
  }

  // ── Update one field on a row ────────────────────────────────────────────────
  function updateRow(key, field, value) {
    setRows(prev => prev.map(r =>
      r._key === key ? { ...r, [field]: value } : r
    ))
  }

  // ── Remove a row ────────────────────────────────────────────────────────────
  function removeRow(key) {
    setRows(prev => prev.filter(r => r._key !== key))
  }

  // ── Duplicate a row (inserts copy immediately after original) ────────────────
  function duplicateRow(key) {
    setRows(prev => {
      const idx = prev.findIndex(r => r._key === key)
      if (idx === -1) return prev
      const copy = { ...prev[idx], _key: newKey() }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { setSaveError('Encounter name is required.'); return }

    // Validate rows: must have name, hp, ac
    for (const r of rows) {
      if (!r.name.trim()) { setSaveError('All monster entries must have a name.'); return }
      if (!r.hp || isNaN(r.hp)) { setSaveError(`"${r.name}" must have a valid HP.`); return }
      if (r.ac === '' || isNaN(r.ac)) { setSaveError(`"${r.name}" must have a valid AC.`); return }
    }

    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        name: name.trim(),
        gameSystem: system,
        description: description.trim() || null,
        tags: tags.trim() || null,
        monsters: rows.map(r => ({
          monsterId: r.monsterId || null,
          name:      r.name.trim(),
          count:     Number(r.count) || 1,
          hp:        Number(r.hp),
          maxHp:     Number(r.maxHp || r.hp),
          ac:        Number(r.ac),
          dexMod:    Number(r.dexMod) || 0,
          hitDie:    r.hitDie || '',
          talents:   r.talents ?? [],
          notes:     r.notes.trim(),
        })),
      }

      if (isEdit) {
        await api.put(`/encounters/${editId}`, payload)
      } else {
        await api.post('/encounters', payload)
      }

      // Navigate back — context-aware based on where the user came from
      if (campaignIdParam) {
        if (fromParam === 'campaign') navigate(`/campaigns/${campaignIdParam}`)
        else navigate(`/campaigns/${campaignIdParam}/settings`)
      } else {
        navigate(`/encounters?system=${system}`)
      }
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Back destination — context-aware ────────────────────────────────────────
  const backHref = campaignIdParam
    ? (fromParam === 'campaign'
        ? `/campaigns/${campaignIdParam}`
        : `/campaigns/${campaignIdParam}/settings`)
    : `/encounters?system=${system}`
  const backLabel = campaignIdParam
    ? (fromParam === 'campaign' ? 'Back to Campaign' : 'Back to Campaign Settings')
    : 'Encounter Library'

  // ── Filtered bestiary in picker ──────────────────────────────────────────────
  const filteredPick = pickMonsters.filter(m =>
    !pickSearch || m.name.toLowerCase().includes(pickSearch.toLowerCase())
  )

  const sysMeta = SYSTEM_META[system] ?? SYSTEM_META.shadowdark

  if (loading) {
    return (
      <PageShell>
        <div className="text-center text-codex-muted animate-pulse py-24">Loading encounter…</div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Helmet><title>Encounter Builder — CampaignCodex</title></Helmet>
      <form onSubmit={handleSave} className="max-w-5xl mx-auto px-4 pt-8 pb-16">

        {/* Back link */}
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> {backLabel}
        </Link>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <Sword size={18} className="text-codex-gold" />
          <h1 className="text-xl font-semibold text-codex-text">
            {isEdit ? 'Edit Encounter' : 'New Encounter'}
          </h1>
          <span className={`text-xs border rounded-full px-2.5 py-0.5 ${sysMeta.badge}`}>
            {sysMeta.label}
          </span>
        </div>

        <div className="h-px bg-codex-border mb-8" />

        {/* ── Basic Info ── */}
        <div className="bg-codex-surface border border-codex-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-codex-text mb-4">Encounter Details</h2>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-codex-subtext">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Goblin Ambush, The Dark Vault…"
                maxLength={100}
                className={`${INP} w-full`}
              />
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1 text-xs text-codex-muted hover:text-codex-subtext transition-colors w-fit"
            >
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAdvanced ? 'Hide' : 'Show'} description & tags
            </button>

            {showAdvanced && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-codex-subtext">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Optional notes about this encounter…"
                    rows={3}
                    maxLength={2000}
                    className={`${INP} w-full resize-none`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-codex-subtext">Tags</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="e.g. Ambush, Boss, Dungeon…"
                    maxLength={200}
                    className={`${INP} w-full`}
                  />
                </div>
              </>
            )}

            {/* System selector — only shown when creating a new encounter */}
            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-codex-subtext">Game System</label>
                <div className="flex gap-2 flex-wrap">
                  {SYSTEMS.map(s => {
                    const m = SYSTEM_META[s]
                    return (
                      <button
                        key={s}
                        type="button"
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
              </div>
            )}
          </div>
        </div>

        {/* ── Monster List ── */}
        <div className="bg-codex-surface border border-codex-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-codex-text">
              Monsters
              {rows.length > 0 && (
                <span className="ml-2 text-codex-subtext font-normal text-xs">
                  {rows.length} type{rows.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
          </div>

          {/* Header row (desktop only) */}
          {rows.length > 0 && (
            <div className="hidden sm:grid grid-cols-[28px_minmax(120px,260px)_76px_76px_76px_84px_28px] gap-2 mb-2 px-1">
              <span /> {/* + duplicate button */}
              <span className="text-[10px] text-codex-muted uppercase tracking-wide">Name</span>
              <span className="text-[10px] text-codex-muted uppercase tracking-wide text-center">#</span>
              <span className="text-[10px] text-codex-muted uppercase tracking-wide text-center">HP</span>
              <span className="text-[10px] text-codex-muted uppercase tracking-wide text-center">AC</span>
              <span className="text-[10px] text-codex-muted uppercase tracking-wide text-center">HD</span>
              <span /> {/* remove button */}
            </div>
          )}

          {/* Monster rows */}
          <div className="flex flex-col gap-2">
            {rows.map(row => (
              <MonsterRow
                key={row._key}
                row={row}
                onChange={(field, val) => updateRow(row._key, field, val)}
                onRemove={() => removeRow(row._key)}
                onDuplicate={() => duplicateRow(row._key)}
              />
            ))}
          </div>

          {/* Empty state */}
          {rows.length === 0 && (
            <div className="border border-dashed border-codex-border rounded-lg p-8 text-center mb-3">
              <Sword size={22} className="text-codex-border mx-auto mb-2" />
              <p className="text-sm text-codex-subtext">No monsters added yet.</p>
              <p className="text-xs text-codex-muted mt-1">
                Add from your {sysMeta.label} bestiary, or enter stats manually.
              </p>
            </div>
          )}

          {/* Add buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={openPicker}
              className="flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text border border-codex-border hover:border-codex-gold/50 rounded-lg px-3 py-1.5 transition-all"
            >
              <BookOpen size={13} /> From Bestiary
            </button>
            <button
              type="button"
              onClick={addCustom}
              className="flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text border border-codex-border hover:border-codex-gold/50 rounded-lg px-3 py-1.5 transition-all"
            >
              <Plus size={13} /> Custom Entry
            </button>
            <a
              href={`/bestiary/${system}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-codex-muted hover:text-codex-subtext border border-dashed border-codex-border hover:border-codex-border rounded-lg px-3 py-1.5 transition-all"
              title="Open bestiary in a new tab to create a monster"
            >
              <ExternalLink size={11} /> Create monster first
            </a>
          </div>
        </div>

        {/* ── Error + Save bar ── */}
        {saveError && (
          <div className="mb-4 flex items-center justify-between gap-2 text-sm text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-4 py-3">
            <span>{saveError}</span>
            <button onClick={() => setSaveError('')} type="button">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            to={backHref}
            className="px-5 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm hover:border-codex-text hover:text-codex-text transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-codex-gold text-codex-bg font-semibold text-sm hover:bg-codex-goldHover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isEdit ? 'Save Changes' : 'Save Encounter'}
          </button>
        </div>
      </form>

      {/* ── Bestiary Picker Modal ── */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowPicker(false) }}
        >
          <div className="relative w-full max-w-lg bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-codex-border shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-codex-gold" />
                <h3 className="text-sm font-semibold text-codex-text">
                  Add from {sysMeta.label} Bestiary
                </h3>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-3 pb-2 shrink-0">
              <input
                type="text"
                value={pickSearch}
                onChange={e => setPickSearch(e.target.value)}
                placeholder="Search monsters…"
                autoFocus
                className={`${INP} w-full`}
              />
            </div>

            {/* Monster list */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {pickLoading ? (
                <div className="text-center text-codex-muted animate-pulse py-8 text-sm">
                  Loading bestiary…
                </div>
              ) : filteredPick.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-codex-subtext">
                    {pickSearch
                      ? 'No monsters match your search.'
                      : `Your ${sysMeta.label} bestiary is empty.`}
                  </p>
                  <a
                    href={`/bestiary/${system}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-codex-gold hover:text-codex-goldHover mt-3 transition-colors"
                  >
                    <ExternalLink size={11} /> Create monsters in the bestiary →
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredPick.map(m => {
                    const talents = m.stat_data?.talents?.filter(t => t.name) ?? []
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMonster(m)}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-codex-surface border border-transparent hover:border-codex-gold/30 transition-all text-left group"
                      >
                        <span className="text-sm text-codex-text group-hover:text-codex-gold transition-colors font-medium">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.stat_data?.hitDie && (
                            <span className="text-[10px] text-codex-muted font-mono">
                              {m.stat_data.hitDie}
                            </span>
                          )}
                          {m.challenge && (
                            <span className="text-xs text-codex-muted">LV {m.challenge}</span>
                          )}
                          {talents.length > 0 && (
                            <div
                              className="group/tip relative"
                              onClick={e => e.stopPropagation()}
                            >
                              <span className="text-amber-400/70 text-[11px] font-bold cursor-help select-none">✦</span>
                              <div className="pointer-events-none absolute z-20 bottom-full right-0 mb-2 w-60 hidden group-hover/tip:block bg-codex-card border border-amber-500/30 rounded-xl p-3 shadow-2xl">
                                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-2">Special Talents</p>
                                {talents.map((t, i) => (
                                  <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-codex-border/40' : ''}>
                                    <p className="text-[10px] font-semibold text-codex-text">{t.name}</p>
                                    {t.description && (
                                      <p className="text-[10px] text-codex-subtext leading-relaxed mt-0.5">{t.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {m.tags && (
                            <span className="text-[10px] text-codex-muted border border-codex-border rounded-full px-2 py-0.5 max-w-[80px] truncate">
                              {m.tags}
                            </span>
                          )}
                          <Plus size={13} className="text-codex-muted group-hover:text-codex-gold transition-colors" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer link */}
            <div className="px-5 py-3 border-t border-codex-border shrink-0">
              <a
                href={`/bestiary/${system}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-codex-muted hover:text-codex-subtext transition-colors"
              >
                <ExternalLink size={11} /> Open {sysMeta.label} Bestiary in a new tab to create more monsters
              </a>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ─── Monster Row ──────────────────────────────────────────────────────────────
// Two-row layout:
//   Row 1: [+dup] [Name + badges/talents tooltip] [#] [HP] [AC] [HD] [×]
//   Row 2: [     ] [Notes full-width                                  ] [ ]
function MonsterRow({ row, onChange, onRemove, onDuplicate }) {
  const CELL = `${INP} w-full text-center`
  const talents = row.talents?.filter(t => t.name) ?? []

  return (
    <div className="flex flex-col gap-1">

      {/* ── Main stat row ── */}
      <div className="grid grid-cols-[28px_minmax(120px,260px)_76px_76px_76px_84px_28px] gap-2 items-center">

        {/* + Duplicate (amber circle) */}
        <button
          type="button"
          onClick={onDuplicate}
          title="Add another of this monster"
          className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/35
            hover:bg-amber-500/30 hover:border-amber-500/60
            flex items-center justify-center text-amber-400 shrink-0 transition-all"
        >
          <Plus size={12} />
        </button>

        {/* Name */}
        <div className="relative">
          <input
            type="text"
            value={row.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Monster name…"
            maxLength={100}
            className={`${INP} w-full ${(row.fromBestiary || talents.length > 0) ? 'pr-[72px]' : ''}`}
          />
          {/* Badges overlay */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {row.fromBestiary && (
              <span className="text-[9px] text-codex-gold/60 border border-codex-gold/20 rounded-full px-1.5 py-0.5 pointer-events-none whitespace-nowrap">
                bestiary
              </span>
            )}
            {talents.length > 0 && (
              <div className="group/tip relative cursor-help">
                <span className="text-amber-400/70 text-[11px] font-bold select-none">✦</span>
                <div className="pointer-events-none absolute z-20 bottom-full right-0 mb-2 w-64
                  hidden group-hover/tip:block
                  bg-codex-card border border-amber-500/30 rounded-xl p-3 shadow-2xl">
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-2">
                    Special Talents
                  </p>
                  {talents.map((t, i) => (
                    <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-codex-border/40' : ''}>
                      <p className="text-[10px] font-semibold text-codex-text">{t.name}</p>
                      {t.description && (
                        <p className="text-[10px] text-codex-subtext leading-relaxed mt-0.5">
                          {t.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Count */}
        <input
          type="number"
          min={1} max={99}
          value={row.count}
          onChange={e => onChange('count', e.target.value)}
          title="Number of this monster"
          className={CELL}
        />

        {/* HP */}
        <input
          type="number"
          min={1}
          value={row.hp}
          onChange={e => onChange('hp', e.target.value)}
          placeholder="HP"
          title="Hit Points (per creature)"
          className={CELL}
        />

        {/* AC */}
        <input
          type="number"
          min={0}
          value={row.ac}
          onChange={e => onChange('ac', e.target.value)}
          placeholder="AC"
          title="Armor Class"
          className={CELL}
        />

        {/* Hit Die */}
        <select
          value={row.hitDie}
          onChange={e => onChange('hitDie', e.target.value)}
          title="Hit die type"
          className={`${CELL} cursor-pointer`}
        >
          <option value="">HD</option>
          <option value="d4">d4</option>
          <option value="d6">d6</option>
          <option value="d8">d8</option>
          <option value="d10">d10</option>
          <option value="d12">d12</option>
        </select>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center w-7 h-7 rounded-lg
            text-codex-muted hover:text-red-400 hover:bg-red-400/10
            transition-all border border-transparent hover:border-red-400/20"
          title="Remove monster"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Notes row (full width, offset past the + button) ── */}
      <div className="pl-9">
        <input
          type="text"
          value={row.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="Notes — tactics, variant stats, conditions…"
          maxLength={500}
          className={`${INP} w-full text-xs text-codex-subtext`}
        />
      </div>
    </div>
  )
}
