import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────

// Canonical d10 weapon table
const MB_WEAPONS = [
  { name: 'Femur',      damage: 'd4',  notes: '' },
  { name: 'Staff',      damage: 'd4',  notes: '' },
  { name: 'Shortsword', damage: 'd4',  notes: '' },
  { name: 'Knife',      damage: 'd4',  notes: '' },
  { name: 'Warhammer',  damage: 'd6',  notes: '' },
  { name: 'Sword',      damage: 'd6',  notes: '' },
  { name: 'Bow',        damage: 'd6',  notes: 'Presence+10 arrows' },
  { name: 'Flail',      damage: 'd8',  notes: '' },
  { name: 'Crossbow',   damage: 'd8',  notes: 'Presence+10 bolts' },
  { name: 'Zweihänder', damage: 'd10', notes: 'Two-handed' },
]

// Armor tiers with canonical example names
const ARMOR_OPTIONS = [
  { value: 0, label: 'None',   detail: '—',       examples: [] },
  { value: 1, label: 'Light',  detail: '-d2 DR',  examples: ['Fur', 'Padded cloth', 'Leather'] },
  { value: 2, label: 'Medium', detail: '-d4 DR',  examples: ['Scale mail', 'Chain mail'] },
  { value: 3, label: 'Heavy',  detail: '-d6 DR',  examples: ['Splint', 'Plate mail'] },
]

// Common items quick-add menu
const MB_QUICK_ITEMS = [
  'Rope (30 feet)',
  'Torches (Presence+4)',
  'Lantern with oil',
  'Sharp needle',
  'Magnesium strip',
  'Life elixir (d4 doses)',
  'Medicine chest',
  'Metal file and lockpicks',
  'Bear trap',
  'Bomb',
  'Red poison (d4 doses)',
  'Silver crucifix',
  'Backpack (holds 7 items)',
  'Sack (holds 10 items)',
  'Crowbar (d4 damage)',
  'Shield (-1 damage)',
  'Grappling hook',
  'Heavy chain (15 feet)',
  'Waterskin',
  'Food rations (d4)',
  'Bandages',
  'Flint and steel',
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(val, min, max) {
  const n = Number(val)
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

function fmtAbility(val) {
  const n = Number(val)
  if (n > 0) return `+${n}`
  return `${n}`
}

const DEFAULT_POWER  = { name: '', description: '' }
const DEFAULT_WEAPON = { name: '', damage: '', notes: '' }

function buildDefaults(sheet_data) {
  // Migrate legacy weapon1/weapon2 → weapons array
  let weapons = sheet_data.weapons ?? null
  if (!weapons) {
    const w1 = sheet_data.weapon1
    const w2 = sheet_data.weapon2
    weapons = [
      ...(w1?.name ? [w1] : []),
      ...(w2?.name ? [w2] : []),
    ]
  }

  return {
    name:        sheet_data.name        ?? '',
    description: sheet_data.description ?? '',
    class_name:  sheet_data.class_name  ?? '',
    abilities: {
      strength:  sheet_data.abilities?.strength  ?? 0,
      agility:   sheet_data.abilities?.agility   ?? 0,
      presence:  sheet_data.abilities?.presence  ?? 0,
      toughness: sheet_data.abilities?.toughness ?? 0,
    },
    hp_max:        sheet_data.hp_max     ?? 6,
    hp_current:    sheet_data.hp_current ?? 6,
    powers_list:   sheet_data.powers_list    ?? [],
    powers_per_day: sheet_data.powers_per_day ?? null,
    omens:         sheet_data.omens     ?? 3,
    silver:        sheet_data.silver    ?? 0,
    weapons,
    armor_tier:    sheet_data.armor_tier ?? 0,
    armor_name:    sheet_data.armor_name ?? '',
    equipment:     sheet_data.equipment  ?? [],
    miseries:      sheet_data.miseries   ?? [false, false, false, false, false, false],
    notes:         sheet_data.notes      ?? '',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300 border-b border-yellow-300/20 pb-1">
        {children}
      </h2>
    </div>
  )
}

function GrimInput({ value, onChange, placeholder, disabled, className = '' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`
        bg-black border border-yellow-300/20 rounded
        px-2 py-1.5 text-sm text-yellow-100
        placeholder-yellow-300/20 font-mono
        focus:outline-none focus:border-yellow-300/60 focus:ring-1 focus:ring-yellow-300/10
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors
        ${className}
      `}
    />
  )
}

function GrimTextarea({ value, onChange, placeholder, disabled, rows = 3, className = '' }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={`
        w-full bg-black border border-yellow-300/20 rounded
        px-2 py-1.5 text-sm text-yellow-100
        placeholder-yellow-300/20 font-mono
        focus:outline-none focus:border-yellow-300/60 focus:ring-1 focus:ring-yellow-300/10
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors resize-y
        ${className}
      `}
    />
  )
}

function AbilityBox({ label, value, onChange, disabled }) {
  const n = Number(value)
  const display = fmtAbility(n)
  const color = n > 0 ? 'text-yellow-300' : n < 0 ? 'text-red-400' : 'text-yellow-100/60'

  return (
    <div className="flex flex-col items-center bg-black border border-yellow-300/20 rounded p-3 gap-1">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-300/60">
        {label}
      </span>
      <div className={`text-4xl font-black font-mono leading-none ${color}`}>
        {display}
      </div>
      <input
        type="number"
        min={-3}
        max={3}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="
          w-10 text-center text-xs font-mono text-yellow-300/40 bg-transparent
          border-t border-yellow-300/10 pt-1 mt-1
          focus:outline-none focus:text-yellow-300/80
          disabled:opacity-40 disabled:cursor-not-allowed
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
        "
      />
    </div>
  )
}

function OmenPip({ filled, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-8 h-8 rounded-full border-2 transition-all duration-150
        ${filled
          ? 'bg-yellow-300 border-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.5)]'
          : 'bg-transparent border-yellow-300/40 hover:border-yellow-300/80'
        }
        ${disabled ? 'cursor-default' : 'cursor-pointer'}
        flex-shrink-0
      `}
      title={filled ? 'Omen used' : 'Omen available'}
    />
  )
}

function MiseryCircle({ index, filled, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-9 h-9 rounded-full border-2 transition-all duration-150
        flex items-center justify-center
        ${filled
          ? 'bg-red-700 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
          : 'bg-transparent border-red-500/30 hover:border-red-500/70'
        }
        ${disabled ? 'cursor-default' : 'cursor-pointer'}
        flex-shrink-0
      `}
      title={`Misery ${index + 1}`}
    >
      <span className={`text-xs font-black ${filled ? 'text-red-100' : 'text-red-500/40'}`}>
        {index + 1}
      </span>
    </button>
  )
}

// ─── Quick-Pick Sub-Components ───────────────────────────────────────────────

function WeaponQuickPick({ onAdd }) {
  const [pick, setPick] = useState('')
  function handleAdd() {
    const w = MB_WEAPONS.find(x => x.name === pick)
    if (!w) return
    onAdd({ ...w })
    setPick('')
  }
  return (
    <div className="flex gap-2 flex-1 min-w-0">
      <select
        value={pick}
        onChange={e => setPick(e.target.value)}
        className="flex-1 bg-black border border-yellow-300/20 rounded px-2 py-1 text-xs text-yellow-100 font-mono focus:outline-none focus:border-yellow-300/40"
      >
        <option value="">— quick-add weapon —</option>
        {MB_WEAPONS.map(w => (
          <option key={w.name} value={w.name}>
            {w.name} ({w.damage}){w.notes ? ' · ' + w.notes : ''}
          </option>
        ))}
      </select>
      <button
        onClick={handleAdd}
        disabled={!pick}
        className="text-xs text-yellow-300/60 border border-yellow-300/20 rounded px-3 py-1 hover:bg-yellow-300/5 hover:border-yellow-300/40 transition-colors disabled:opacity-30"
      >
        Add
      </button>
    </div>
  )
}

function EquipmentQuickAdd({ onAdd }) {
  const [pick, setPick] = useState('')
  function handleAdd() {
    if (!pick) return
    onAdd(pick)
    setPick('')
  }
  return (
    <div className="flex gap-2 flex-1 min-w-0">
      <select
        value={pick}
        onChange={e => setPick(e.target.value)}
        className="flex-1 bg-black border border-yellow-300/20 rounded px-2 py-1 text-xs text-yellow-100 font-mono focus:outline-none focus:border-yellow-300/40"
      >
        <option value="">— quick-add item —</option>
        {MB_QUICK_ITEMS.map(item => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <button
        onClick={handleAdd}
        disabled={!pick}
        className="text-xs text-yellow-300/60 border border-yellow-300/20 rounded px-3 py-1 hover:bg-yellow-300/5 hover:border-yellow-300/40 transition-colors disabled:opacity-30"
      >
        Add
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MorkborgSheet({ character, onSave, readOnly = false }) {
  const [data, setData]             = useState(() => buildDefaults(character.sheet_data || {}))
  const [saveStatus, setSaveStatus] = useState('idle')
  const debounceTimer               = useRef(null)
  const isFirstRender               = useRef(true)

  // Sync if character prop changes externally
  useEffect(() => {
    setData(buildDefaults(character.sheet_data || {}))
  }, [character.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSave = useCallback((nextData) => {
    if (readOnly) return
    setSaveStatus('saving')
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        await onSave(nextData)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
  }, [readOnly, onSave])

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    triggerSave(data)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Powers per day local roll state (not persisted to DB, just rolled display)
  const [rollingPPD, setRollingPPD] = useState(false)

  // Field helpers
  const set = (field, value) => setData(prev => ({ ...prev, [field]: value }))
  const setAbility = (key, value) => setData(prev => ({
    ...prev,
    abilities: { ...prev.abilities, [key]: clamp(value, -3, 3) },
  }))

  function listAdd(field, template) {
    setData(prev => ({ ...prev, [field]: [...prev[field], { ...template }] }))
  }
  function listRemove(field, idx) {
    setData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }))
  }
  function listSet(field, idx, key, value) {
    setData(prev => ({
      ...prev,
      [field]: prev[field].map((row, i) => i === idx ? { ...row, [key]: value } : row),
    }))
  }

  function rollPowersPerDay() {
    if (rollingPPD || readOnly) return
    setRollingPPD(true)
    const d4 = Math.floor(Math.random() * 4) + 1
    const total = Math.max(0, (Number(data.abilities.presence) || 0) + d4)
    // Animate briefly
    let count = 0
    const interval = setInterval(() => {
      count++
      if (count >= 6) {
        clearInterval(interval)
        set('powers_per_day', total)
        setRollingPPD(false)
      } else {
        const rand = Math.max(0, (Number(data.abilities.presence) || 0) + Math.floor(Math.random() * 4) + 1)
        set('powers_per_day', rand)
      }
    }, 70)
  }

  function toggleMisery(idx) {
    if (readOnly) return
    const next = [...data.miseries]
    next[idx] = !next[idx]
    set('miseries', next)
  }

  function toggleOmen(idx) {
    if (readOnly) return
    // clicking a filled pip unfills it (and all after); clicking empty fills up to it
    const filled = data.omens
    const newOmens = idx < filled ? idx : idx + 1
    set('omens', clamp(newOmens, 0, 6))
  }

  const equipMax   = (Number(data.abilities.strength) || 0) + 8
  const equipCount = data.equipment.length

  const presenceMod = fmtAbility(Number(data.abilities.presence) || 0)

  return (
    <div className="relative bg-black min-h-screen font-mono">
      {/* Save indicator */}
      {!readOnly && saveStatus !== 'idle' && (
        <div className={`
          fixed top-4 right-4 z-50 px-3 py-1.5 rounded text-xs font-black uppercase tracking-widest shadow-lg
          transition-all duration-300
          ${saveStatus === 'saving' ? 'bg-zinc-900 border border-yellow-300/20 text-yellow-300/50' : ''}
          ${saveStatus === 'saved'  ? 'bg-yellow-300/10 border border-yellow-300/40 text-yellow-300' : ''}
          ${saveStatus === 'error'  ? 'bg-red-900/40 border border-red-500/40 text-red-400' : ''}
        `}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved'  && 'Saved ✓'}
          {saveStatus === 'error'  && 'Save failed'}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-5">

        {/* Sheet Title */}
        <div className="text-center pt-3 pb-1 border-b border-yellow-300/10">
          <h1 className="text-3xl font-black uppercase tracking-[0.15em] text-yellow-300">
            MÖRK BORG
          </h1>
          <p className="text-yellow-300/40 text-[10px] tracking-[0.3em] uppercase mt-1">Character Sheet</p>
          {readOnly && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-widest text-yellow-300/30 border border-yellow-300/20 rounded px-2 py-0.5">
              View Only
            </span>
          )}
        </div>

        {/* ── Identity ─────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Identity</SectionHeader>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[9px] uppercase tracking-widest text-yellow-300/50 font-black">Name</label>
                <GrimInput
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Your doomed name"
                  disabled={readOnly}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-1 w-40">
                <label className="text-[9px] uppercase tracking-widest text-yellow-300/50 font-black">Class</label>
                <GrimInput
                  value={data.class_name}
                  onChange={e => set('class_name', e.target.value)}
                  placeholder="Classless / ..."
                  disabled={readOnly}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest text-yellow-300/50 font-black">Description</label>
              <GrimTextarea
                value={data.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Gaunt. Hollow-eyed. Reeks of failure."
                disabled={readOnly}
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* ── Abilities ────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Abilities</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'strength',  label: 'STRENGTH'  },
              { key: 'agility',   label: 'AGILITY'   },
              { key: 'presence',  label: 'PRESENCE'  },
              { key: 'toughness', label: 'TOUGHNESS' },
            ].map(({ key, label }) => (
              <AbilityBox
                key={key}
                label={label}
                value={data.abilities[key]}
                onChange={e => setAbility(key, e.target.value)}
                disabled={readOnly}
              />
            ))}
          </div>
        </section>

        {/* ── Hit Points ───────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Hit Points</SectionHeader>
          <div className="flex items-baseline gap-3">
            <div className="flex flex-col items-center">
              <input
                type="number"
                value={data.hp_current}
                onChange={e => set('hp_current', Number(e.target.value))}
                disabled={readOnly}
                className="
                  w-24 text-center text-5xl font-black text-yellow-300 bg-transparent
                  border-b-2 border-yellow-300/40
                  focus:outline-none focus:border-yellow-300
                  disabled:opacity-40 disabled:cursor-not-allowed
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                "
              />
              <span className="text-[9px] uppercase tracking-widest text-yellow-300/40 mt-1">Current</span>
            </div>
            <span className="text-3xl font-black text-yellow-300/20 pb-4">/</span>
            <div className="flex flex-col items-center">
              <input
                type="number"
                value={data.hp_max}
                onChange={e => set('hp_max', Number(e.target.value))}
                disabled={readOnly}
                className="
                  w-16 text-center text-3xl font-black text-yellow-100/60 bg-transparent
                  border-b border-yellow-300/20
                  focus:outline-none focus:border-yellow-300/60
                  disabled:opacity-40 disabled:cursor-not-allowed
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                "
              />
              <span className="text-[9px] uppercase tracking-widest text-yellow-300/30 mt-1">Max</span>
            </div>
          </div>
        </section>

        {/* ── Omens & Silver ───────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <div className="flex flex-wrap gap-6">
            {/* Omens */}
            <div className="flex-1 min-w-0">
              <SectionHeader>Omens</SectionHeader>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <OmenPip
                    key={i}
                    filled={i < data.omens}
                    onClick={() => toggleOmen(i)}
                    disabled={readOnly}
                  />
                ))}
              </div>
              <p className="text-[9px] text-yellow-300/30 mt-2 uppercase tracking-wide">
                {data.omens} remaining — reroll to regain
              </p>
            </div>

            {/* Silver */}
            <div className="flex flex-col gap-1 w-32">
              <label className="text-[9px] font-black uppercase tracking-widest text-yellow-300/50">Silver</label>
              <input
                type="number"
                value={data.silver}
                onChange={e => set('silver', Math.max(0, Number(e.target.value)))}
                disabled={readOnly}
                min={0}
                className="
                  w-full text-center text-2xl font-black text-yellow-100 bg-black
                  border border-yellow-300/20 rounded px-2 py-2
                  focus:outline-none focus:border-yellow-300/60
                  disabled:opacity-40 disabled:cursor-not-allowed
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                "
              />
              <span className="text-[9px] uppercase tracking-widest text-yellow-300/30 text-center">silver pieces</span>
            </div>
          </div>
        </section>

        {/* ── Powers ───────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Powers</SectionHeader>
          {/* Powers per day roll */}
          <div className="flex items-center gap-4 mb-4 bg-black border border-yellow-300/20 rounded px-4 py-3">
            <div className="flex-1">
              <p className="text-[9px] uppercase tracking-widest text-yellow-300/50 font-black mb-1">Powers per Day</p>
              <p className="text-[10px] text-yellow-300/30 italic">
                Presence {presenceMod} + d4 — roll each morning
              </p>
            </div>
            <div className="flex items-center gap-3">
              {data.powers_per_day !== null && (
                <span className={`text-4xl font-black font-mono text-yellow-300 ${rollingPPD ? 'animate-pulse' : ''}`}>
                  {data.powers_per_day}
                </span>
              )}
              {!readOnly && (
                <button
                  onClick={rollPowersPerDay}
                  disabled={rollingPPD}
                  className="text-[9px] font-mono uppercase tracking-widest border border-yellow-300/30 rounded px-3 py-1.5 text-yellow-300/60 hover:text-yellow-300 hover:border-yellow-300/60 hover:bg-yellow-300/5 transition-all disabled:opacity-40"
                >
                  {rollingPPD ? '...' : 'ROLL'}
                </button>
              )}
            </div>
          </div>

          <p className="text-[10px] text-yellow-300/40 mb-3 italic">
            Roll Presence DR12 to activate a power. On fail: lose d2 HP and next hour all powers fail catastrophically.
          </p>
          <div className="space-y-2">
            {data.powers_list.length === 0 && (
              <p className="text-yellow-300/20 text-xs italic">No powers. The void is silent.</p>
            )}
            {data.powers_list.map((pw, i) => (
              <div key={i} className="flex items-start gap-2 group">
                <div className="flex-1 flex gap-2">
                  <GrimInput
                    value={pw.name}
                    onChange={e => listSet('powers_list', i, 'name', e.target.value)}
                    placeholder="Power name"
                    disabled={readOnly}
                    className="w-36 flex-shrink-0"
                  />
                  <GrimInput
                    value={pw.description}
                    onChange={e => listSet('powers_list', i, 'description', e.target.value)}
                    placeholder="Effect"
                    disabled={readOnly}
                    className="flex-1"
                  />
                </div>
                {!readOnly && (
                  <button
                    onClick={() => listRemove('powers_list', i)}
                    className="mt-1.5 w-6 h-6 rounded text-yellow-300/20 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center text-base leading-none transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                onClick={() => listAdd('powers_list', DEFAULT_POWER)}
                className="mt-1 text-xs text-yellow-300/60 border border-yellow-300/20 rounded px-3 py-1 hover:bg-yellow-300/5 hover:border-yellow-300/40 transition-colors flex items-center gap-1"
              >
                <span className="text-base leading-none">+</span> Add Power
              </button>
            )}
          </div>
        </section>

        {/* ── Weapons ──────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Weapons</SectionHeader>
          <div className="space-y-2">
            {(data.weapons ?? []).length === 0 && (
              <p className="text-yellow-300/20 text-xs italic">No weapons. Fists are free.</p>
            )}
            {(data.weapons ?? []).map((w, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center group">
                <span className="text-[9px] text-yellow-300/20 font-black w-5 text-right flex-shrink-0">{i + 1}</span>
                <GrimInput
                  value={w.name}
                  onChange={e => listSet('weapons', i, 'name', e.target.value)}
                  placeholder="Weapon name"
                  disabled={readOnly}
                  className="flex-1 min-w-[110px]"
                />
                <GrimInput
                  value={w.damage}
                  onChange={e => listSet('weapons', i, 'damage', e.target.value)}
                  placeholder="d6"
                  disabled={readOnly}
                  className="w-16"
                />
                <GrimInput
                  value={w.notes}
                  onChange={e => listSet('weapons', i, 'notes', e.target.value)}
                  placeholder="Notes"
                  disabled={readOnly}
                  className="flex-1 min-w-[90px]"
                />
                {!readOnly && (
                  <button
                    onClick={() => listRemove('weapons', i)}
                    className="w-6 h-6 rounded text-yellow-300/20 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center text-base leading-none transition-colors opacity-0 group-hover:opacity-100"
                  >×</button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <WeaponQuickPick onAdd={w => listAdd('weapons', w)} />
              <button
                onClick={() => listAdd('weapons', { ...DEFAULT_WEAPON })}
                className="text-xs text-yellow-300/60 border border-yellow-300/20 rounded px-3 py-1 hover:bg-yellow-300/5 hover:border-yellow-300/40 transition-colors flex items-center gap-1"
              >
                <span className="text-base leading-none">+</span> Custom
              </button>
            </div>
          )}
        </section>

        {/* ── Armor ────────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Armor</SectionHeader>
          <div className="flex flex-wrap gap-3 mb-3">
            {ARMOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => !readOnly && set('armor_tier', opt.value)}
                disabled={readOnly}
                className={`
                  flex flex-col items-center px-4 py-2 rounded border transition-all text-xs font-black uppercase tracking-wider
                  ${data.armor_tier === opt.value
                    ? 'bg-yellow-300/15 border-yellow-300/60 text-yellow-300'
                    : 'bg-transparent border-yellow-300/15 text-yellow-300/30 hover:border-yellow-300/40 hover:text-yellow-300/60'
                  }
                  ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                <span>{opt.label}</span>
                <span className="font-mono text-[10px] font-normal mt-0.5 opacity-70">{opt.detail}</span>
              </button>
            ))}
          </div>
          {data.armor_tier > 0 && ARMOR_OPTIONS[data.armor_tier]?.examples?.length > 0 && !readOnly && (
            <div className="flex gap-2 flex-wrap mb-2">
              {ARMOR_OPTIONS[data.armor_tier].examples.map(name => (
                <button
                  key={name}
                  onClick={() => set('armor_name', name)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                    data.armor_name === name
                      ? 'border-yellow-300/60 bg-yellow-300/10 text-yellow-300'
                      : 'border-yellow-300/20 text-yellow-300/40 hover:border-yellow-300/40 hover:text-yellow-300/70'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {(data.armor_tier > 0 || !readOnly) && (
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-widest text-yellow-300/40 font-black">Armor name</label>
              <GrimInput
                value={data.armor_name}
                onChange={e => set('armor_name', e.target.value)}
                placeholder={data.armor_tier > 0 ? (ARMOR_OPTIONS[data.armor_tier]?.examples[0] ?? 'Armor description') : 'No armor'}
                disabled={readOnly}
                className="w-full max-w-xs"
              />
            </div>
          )}
        </section>

        {/* ── Equipment ────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Equipment</SectionHeader>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] text-yellow-300/40 uppercase tracking-wide">
              Capacity: <span className="text-yellow-300/70 font-bold">{equipMax} items</span>
              <span className="text-yellow-300/20 ml-1">(STR + 8)</span>
            </span>
            <span className={`text-xs font-black ${equipCount > equipMax ? 'text-red-400' : 'text-yellow-300/60'}`}>
              {equipCount} / {equipMax}
            </span>
          </div>
          <div className="space-y-1.5">
            {data.equipment.length === 0 && (
              <p className="text-yellow-300/20 text-xs italic">Nothing. You own nothing.</p>
            )}
            {data.equipment.map((eq, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="text-[9px] text-yellow-300/20 font-black w-5 text-right flex-shrink-0">{i + 1}</span>
                <GrimInput
                  value={eq.item}
                  onChange={e => listSet('equipment', i, 'item', e.target.value)}
                  placeholder="Item"
                  disabled={readOnly}
                  className="flex-1"
                />
                {!readOnly && (
                  <button
                    onClick={() => listRemove('equipment', i)}
                    className="w-6 h-6 rounded text-yellow-300/20 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center text-base leading-none transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <div className="mt-2 flex flex-wrap gap-2">
                <EquipmentQuickAdd onAdd={item => listAdd('equipment', { item })} />
                <button
                  onClick={() => listAdd('equipment', { item: '' })}
                  className="text-xs text-yellow-300/60 border border-yellow-300/20 rounded px-3 py-1 hover:bg-yellow-300/5 hover:border-yellow-300/40 transition-colors flex items-center gap-1"
                >
                  <span className="text-base leading-none">+</span> Custom
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Miseries ─────────────────────────────────────────────── */}
        <section className="border border-red-500/20 rounded p-4 bg-red-950/10">
          <SectionHeader>Miseries</SectionHeader>
          <p className="text-[9px] uppercase tracking-widest text-red-400/50 mb-3">
            Fill all six — the world ends. You end.
          </p>
          <div className="flex gap-3 flex-wrap">
            {data.miseries.map((filled, i) => (
              <MiseryCircle
                key={i}
                index={i}
                filled={filled}
                onClick={() => toggleMisery(i)}
                disabled={readOnly}
              />
            ))}
          </div>
          {data.miseries.some(Boolean) && (
            <p className="text-[10px] text-red-400/60 mt-3 italic">
              {data.miseries.filter(Boolean).length === 6
                ? 'THE BASILISK CALENDARS END. ALL IS RUIN.'
                : `${data.miseries.filter(Boolean).length} miseries afflict you.`}
            </p>
          )}
        </section>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <section className="border border-yellow-300/15 rounded p-4 bg-zinc-950/50">
          <SectionHeader>Notes</SectionHeader>
          <GrimTextarea
            value={data.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Grievances. Debts. Omens. Names of the dead."
            disabled={readOnly}
            rows={5}
          />
        </section>

        <div className="h-6" />
      </div>
    </div>
  )
}
