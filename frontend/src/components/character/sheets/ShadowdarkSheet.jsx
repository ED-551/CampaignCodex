import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import {
  gearToAttacks, SD_WEAPONS, SD_ARMOR,
  weaponToAttack, detectWeapon, detectArmor, computeAC,
  SD_SPELLS, SD_SPELLS_BY_CLASS, SD_SPELLS_KNOWN,
} from '../../../utils/shadowdark'

// ─── Helpers ────────────────────────────────────────────────────────────────

function statMod(score) {
  const mod = Math.floor((Number(score) - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function clamp(val, min, max) {
  const n = Number(val)
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

const DEFAULT_ATTACK      = { weapon: '', bonus: '', damage: '', notes: '' }
const DEFAULT_TALENT      = { name: '', description: '' }
const DEFAULT_SPELL       = { name: '', tier: 1, failed: false, custom: false, duration: '', range: '', description: '' }
const DEFAULT_GEAR        = { item: '', slots: 1, equipped: false, type: 'gear',   notes: '' }
const DEFAULT_WEAPON_GEAR = { item: '', slots: 1, equipped: false, type: 'weapon', notes: '' }
const DEFAULT_ARMOR_GEAR  = { item: '', slots: 1, equipped: false, type: 'armor',  notes: '' }

function buildDefaults(sheet_data) {
  return {
    name:        sheet_data.name        ?? '',
    ancestry:    sheet_data.ancestry    ?? '',
    class_name:  sheet_data.class_name  ?? '',
    level:       sheet_data.level       ?? 1,
    xp:          sheet_data.xp          ?? 0,
    background:  sheet_data.background  ?? '',
    alignment:   sheet_data.alignment   ?? 'Neutral',
    deity:       sheet_data.deity       ?? '',
    title:       sheet_data.title       ?? '',
    stats: {
      str: sheet_data.stats?.str ?? 10,
      dex: sheet_data.stats?.dex ?? 10,
      con: sheet_data.stats?.con ?? 10,
      int: sheet_data.stats?.int ?? 10,
      wis: sheet_data.stats?.wis ?? 10,
      cha: sheet_data.stats?.cha ?? 10,
    },
    hp_max:     sheet_data.hp_max     ?? 4,
    hp_current: sheet_data.hp_current ?? 4,
    ac:         sheet_data.ac         ?? 10,
    gold:       sheet_data.gold       ?? 0,
    arrows:     Math.min(20, Math.max(0, sheet_data.arrows ?? 0)),
    bolts:      Math.min(20, Math.max(0, sheet_data.bolts  ?? 0)),
    attacks:    sheet_data.attacks    ?? [{ ...DEFAULT_ATTACK }],
    talents:    sheet_data.talents    ?? [],
    spells:     (sheet_data.spells ?? []).map(s => {
      // Migrate old format { name, tier, description } → new format
      if (s.failed !== undefined) return s
      const canonical = SD_SPELLS[s.name]
      return {
        name:        s.name        ?? '',
        tier:        s.tier        ?? canonical?.tier ?? 1,
        failed:      false,
        custom:      !canonical,
        duration:    s.duration    ?? canonical?.duration ?? '',
        range:       s.range       ?? canonical?.range    ?? '',
        description: s.description ?? canonical?.description ?? '',
      }
    }),
    gear: (sheet_data.gear ?? []).map(g => {
      // Already typed (new schema) — backfill any missing fields
      if (g.type) return { notes: '', equipped: false, ...g }
      // Auto-detect type from item name for legacy gear items
      if (detectWeapon(g.item ?? ''))  return { notes: '', ...g, type: 'weapon', equipped: false }
      if (detectArmor(g.item ?? ''))   return { notes: '', ...g, type: 'armor',  equipped: false }
      return { notes: '', ...g, type: 'gear', equipped: false }
    }),
    notes:      sheet_data.notes      ?? '',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-1 h-5 bg-sd-gold rounded-full flex-shrink-0" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-sd-gold">
        {children}
      </h2>
      <div className="flex-1 h-px bg-sd-gold/20" />
    </div>
  )
}

function FieldInput({ label, value, onChange, type = 'text', min, max, disabled, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-[10px] uppercase tracking-wider text-sd-subtext font-semibold">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        disabled={disabled}
        className="
          bg-sd-surface border border-sd-border rounded
          px-2 py-1.5 text-sm text-sd-text
          focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors w-full
        "
      />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options, disabled, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-[10px] uppercase tracking-wider text-sd-subtext font-semibold">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="
          bg-sd-surface border border-sd-border rounded
          px-2 py-1.5 text-sm text-sd-text
          focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors w-full
        "
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function StatBox({ label, value, onChange, disabled }) {
  const mod = statMod(value)
  return (
    <div className="flex flex-col items-center bg-sd-card border border-sd-border rounded-lg py-2 px-1 gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-sd-gold">
        {label}
      </span>
      <input
        type="number"
        min={3}
        max={18}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="
          w-12 text-center text-xl font-bold text-sd-text
          bg-transparent border-b border-sd-border
          focus:outline-none focus:border-sd-gold
          disabled:opacity-50 disabled:cursor-not-allowed
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
        "
      />
      <span className={`text-sm font-semibold ${Number(value) >= 10 ? 'text-sd-gold' : 'text-red-400'}`}>
        {mod}
      </span>
    </div>
  )
}

function AddRemoveRow({ children, onRemove, disabled }) {
  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 min-w-0 flex flex-wrap gap-2">{children}</div>
      {!disabled && (
        <button
          onClick={onRemove}
          className="mt-1.5 flex-shrink-0 w-6 h-6 rounded text-sd-muted hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center text-base leading-none transition-colors opacity-0 group-hover:opacity-100"
          title="Remove row"
        >
          ×
        </button>
      )}
    </div>
  )
}

function AddButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="
        mt-1 text-xs text-sd-gold border border-sd-gold/30 rounded
        px-3 py-1 hover:bg-sd-gold/10 hover:border-sd-gold/60
        transition-colors flex items-center gap-1
      "
    >
      <span className="text-base leading-none">+</span> {children}
    </button>
  )
}

// ─── Gear Item Selectors ─────────────────────────────────────────────────────
// Used inside gear rows when a row has type 'weapon' or 'armor'.

const GEAR_INPUT_CLS = `
  flex-1 min-w-0 bg-sd-surface border border-sd-border rounded px-2 py-1.5
  text-sm text-sd-text placeholder-sd-muted
  focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
  disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer
`

const NOTES_INPUT_CLS = `
  w-full bg-sd-surface border border-sd-border rounded px-2 py-1
  text-xs text-sd-muted placeholder-sd-muted/50
  focus:outline-none focus:border-sd-gold/60 focus:ring-1 focus:ring-sd-gold/10
  disabled:opacity-50 disabled:cursor-not-allowed transition-colors
`

const BACK_BTN_CLS = `
  flex-shrink-0 px-2 border border-sd-border rounded
  text-sd-muted hover:text-sd-gold hover:border-sd-gold/40
  text-xs transition-colors
`

// Weapon picker for gear rows. "Other / Custom…" drops into a text input
// with a free-form notes field (damage type, range, etc.) that carries over
// to the attack row when the weapon is equipped.
function GearWeaponSelect({ value, notes, onChange, onNotesChange, disabled }) {
  const detected    = detectWeapon(value ?? '')
  const selectedKey = detected?.key ?? ''
  // Custom = item name exists but doesn't match any known weapon key
  const [custom, setCustom] = useState(!selectedKey && (value ?? '').length > 0)

  useEffect(() => { if (selectedKey) setCustom(false) }, [selectedKey])

  const sorted = Object.entries(SD_WEAPONS).sort((a, b) => a[0].localeCompare(b[0]))

  function pick(key) {
    if (key === '__custom__') { setCustom(true); onChange({ item: '', slots: 1 }); return }
    if (!key)                 { setCustom(false); onChange({ item: '', slots: 1 }); return }
    const w     = SD_WEAPONS[key]
    const label = key.replace(/\b\w/g, c => c.toUpperCase())
    setCustom(false)
    onChange({ item: label, slots: w.slots ?? 1 })
  }

  if (custom) {
    return (
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex gap-1 min-w-0">
          <input
            type="text"
            value={value}
            onChange={e => onChange({ item: e.target.value })}
            disabled={disabled}
            placeholder="Weapon name — e.g. Fire Sword"
            autoFocus
            className={GEAR_INPUT_CLS}
          />
          {!disabled && (
            <button type="button" title="Back to list"
              onClick={() => { setCustom(false); onChange({ item: '', slots: 1 }) }}
              className={BACK_BTN_CLS}
            >▾</button>
          )}
        </div>
        <input
          type="text"
          value={notes ?? ''}
          onChange={e => onNotesChange(e.target.value)}
          disabled={disabled}
          placeholder="Notes — e.g. 1d6 fire damage, Thrown"
          className={NOTES_INPUT_CLS}
        />
      </div>
    )
  }

  return (
    <select value={selectedKey} onChange={e => pick(e.target.value)} disabled={disabled} className={GEAR_INPUT_CLS}>
      <option value="">— choose weapon —</option>
      {sorted.map(([k, w]) => (
        <option key={k} value={k}>
          {k.replace(/\b\w/g, c => c.toUpperCase())} · {w.damage}
        </option>
      ))}
      <option value="__custom__">✏ Other / Custom…</option>
    </select>
  )
}

// Armor picker for gear rows. "Other / Custom…" drops into a text input.
// A properties/notes field is always shown so players can note resistances,
// enchantments, etc. on both standard and custom armor.
function GearArmorSelect({ value, notes, onChange, onNotesChange, disabled }) {
  const selectedKey = Object.keys(SD_ARMOR).find(
    k => SD_ARMOR[k].label.toLowerCase() === (value ?? '').toLowerCase()
  ) ?? ''
  const [custom, setCustom] = useState(!selectedKey && (value ?? '').length > 0)

  useEffect(() => { if (selectedKey) setCustom(false) }, [selectedKey])

  function pick(key) {
    if (key === '__custom__') { setCustom(true); onChange({ item: '', slots: 1 }); return }
    if (!key)                 { setCustom(false); onChange({ item: '', slots: 1 }); return }
    const a = SD_ARMOR[key]
    setCustom(false)
    onChange({ item: a.label, slots: a.slots })
  }

  const notesField = (
    <input
      type="text"
      value={notes ?? ''}
      onChange={e => onNotesChange(e.target.value)}
      disabled={disabled}
      placeholder="Properties — e.g. Fire resistance, +1 magic, cursed"
      className={NOTES_INPUT_CLS}
    />
  )

  if (custom) {
    return (
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex gap-1 min-w-0">
          <input
            type="text"
            value={value}
            onChange={e => onChange({ item: e.target.value })}
            disabled={disabled}
            placeholder="Armor name — e.g. Dragon Scale Mail"
            autoFocus
            className={GEAR_INPUT_CLS}
          />
          {!disabled && (
            <button type="button" title="Back to list"
              onClick={() => { setCustom(false); onChange({ item: '', slots: 1 }) }}
              className={BACK_BTN_CLS}
            >▾</button>
          )}
        </div>
        {notesField}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      <select value={selectedKey} onChange={e => pick(e.target.value)} disabled={disabled} className={GEAR_INPUT_CLS}>
        <option value="">— choose armor —</option>
        {Object.entries(SD_ARMOR).map(([k, a]) => (
          <option key={k} value={k}>
            {a.label} · AC {a.isShield ? `+${a.ac}` : a.dexBonus ? `${a.ac}+DEX` : a.ac}
          </option>
        ))}
        <option value="__custom__">✏ Other / Custom…</option>
      </select>
      {notesField}
    </div>
  )
}

// ─── Weapon Selector Cell ────────────────────────────────────────────────────
// Renders a <select> of all Shadowdark weapons that auto-fills damage/bonus/notes.
// Falls back to a plain text <input> when "Custom weapon…" is chosen.

const SORTED_WEAPONS = Object.entries(SD_WEAPONS)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([key, w]) => ({
    key,
    label: key.replace(/\b\w/g, c => c.toUpperCase()),
    damage: w.damage,
    stat: w.stat,
    notes: w.notes,
  }))

const cellCls = `
  min-w-0 w-full bg-sd-surface border border-sd-border rounded px-2 py-1.5
  text-sm text-sd-text
  focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
  disabled:opacity-50 disabled:cursor-not-allowed transition-colors
`

function AttackWeaponCell({ value, stats, onChange, disabled }) {
  const key     = String(value ?? '').toLowerCase()
  const isKnown = key !== '' && key in SD_WEAPONS

  // 'custom' mode = user clicked "Custom weapon…" or has a name not in our table
  const [custom, setCustom] = useState(!isKnown && value !== '')

  // If a known weapon is set externally (e.g. "⚔ From gear"), exit custom mode
  useEffect(() => { if (isKnown) setCustom(false) }, [isKnown])

  function pick(selected) {
    if (selected === '__custom__') {
      setCustom(true)
      onChange({ weapon: '' })
      return
    }
    setCustom(false)
    if (!selected) {
      onChange({ weapon: '', damage: '', bonus: '', notes: '' })
      return
    }
    const w = SD_WEAPONS[selected]
    if (!w) return
    onChange(weaponToAttack({ key: selected, ...w }, stats))
  }

  // ── Custom text input ──────────────────────────────────────────
  if (custom) {
    return (
      <div className="flex gap-1 min-w-0">
        <input
          type="text"
          value={value}
          onChange={e => onChange({ weapon: e.target.value })}
          disabled={disabled}
          placeholder="Weapon name"
          autoFocus
          className={cellCls}
        />
        {!disabled && (
          <button
            type="button"
            title="Back to weapon list"
            onClick={() => { setCustom(false); onChange({ weapon: '' }) }}
            className="flex-shrink-0 px-2 border border-sd-border rounded
              text-sd-muted hover:text-sd-gold hover:border-sd-gold/40
              text-xs transition-colors"
          >▾</button>
        )}
      </div>
    )
  }

  // ── Known weapon select ────────────────────────────────────────
  return (
    <select
      value={isKnown ? key : ''}
      onChange={e => pick(e.target.value)}
      disabled={disabled}
      className={`${cellCls} cursor-pointer`}
    >
      <option value="">— choose weapon —</option>
      {SORTED_WEAPONS.map(w => (
        <option key={w.key} value={w.key}>
          {w.label} · {w.damage}
        </option>
      ))}
      <option value="__custom__">✏ Custom weapon…</option>
    </select>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ShadowdarkSheet({ character, onSave, readOnly = false }) {
  const [data, setData]             = useState(() => buildDefaults(character.sheet_data || {}))
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [expandedSpells, setExpandedSpells] = useState({})
  const [spellPickerTier, setSpellPickerTier] = useState(1)
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

  // Auto-save on data change (skip first mount)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    triggerSave(data)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Field updater helpers
  const set = (field, value) => setData(prev => ({ ...prev, [field]: value }))
  const setStat = (stat, value) => setData(prev => ({
    ...prev,
    stats: { ...prev.stats, [stat]: clamp(value, 3, 18) },
  }))

  // Dynamic list helpers
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

  // Apply a multi-field patch to one attack row (used by AttackWeaponCell)
  function setAttack(idx, patch) {
    setData(prev => ({
      ...prev,
      attacks: prev.attacks.map((row, i) => i === idx ? { ...row, ...patch } : row),
    }))
  }

  // Apply a multi-field patch to one gear row
  function setGearItem(idx, patch) {
    setData(prev => ({
      ...prev,
      gear: prev.gear.map((row, i) => i === idx ? { ...row, ...patch } : row),
    }))
  }

  // Toggle equipped state for any gear item — routes to weapon/armor logic
  function toggleEquip(idx, equip) {
    const g = data.gear[idx]
    if (g.type === 'weapon') toggleEquipWeapon(idx, equip)
    else if (g.type === 'armor') toggleEquipArmor(idx, equip)
    else setGearItem(idx, { equipped: equip })
  }

  // Equip/unequip a weapon gear row — syncs attacks list
  // Handles both library weapons (auto-fills stats) and custom weapons (blank row, notes transfer)
  function toggleEquipWeapon(idx, equip) {
    setData(prev => {
      const g       = prev.gear[idx]
      const newGear = prev.gear.map((item, i) => i === idx ? { ...item, equipped: equip } : item)
      const w       = detectWeapon(g.item ?? '')
      // Canonical display name: from library key or raw item string
      const weaponName = w
        ? w.key.replace(/\b\w/g, c => c.toUpperCase())
        : (g.item ?? '').trim() || 'Custom Weapon'

      if (equip) {
        const atk = w
          ? weaponToAttack(w, prev.stats)
          // Custom weapon: name only; player fills damage/bonus in attack row
          : { weapon: weaponName, bonus: '', damage: '', notes: g.notes ?? '' }
        const already = prev.attacks.some(
          a => (a.weapon ?? '').toLowerCase() === atk.weapon.toLowerCase()
        )
        if (already) return { ...prev, gear: newGear }
        const kept = prev.attacks.filter(a => a.weapon || a.bonus || a.damage || a.notes)
        return { ...prev, gear: newGear, attacks: [...kept, atk] }
      } else {
        const newAtks = prev.attacks.filter(
          a => (a.weapon ?? '').toLowerCase() !== weaponName.toLowerCase()
        )
        return {
          ...prev,
          gear:    newGear,
          attacks: newAtks.length > 0 ? newAtks : [{ ...DEFAULT_ATTACK }],
        }
      }
    })
  }

  // Equip/unequip an armor gear row.
  // Standard armor → enforces one-per-category + auto-updates AC.
  // Custom armor   → enforces one-per-category but leaves AC for manual edit.
  function toggleEquipArmor(idx, equip) {
    setData(prev => {
      const armorItem = prev.gear[idx]
      const armorKey  = Object.keys(SD_ARMOR).find(
        k => SD_ARMOR[k].label.toLowerCase() === (armorItem.item ?? '').toLowerCase()
      )
      const isShield      = armorKey ? SD_ARMOR[armorKey].isShield : false
      const isStandardArmor = !!armorKey

      const newGear = prev.gear.map((item, i) => {
        if (i === idx) return { ...item, equipped: equip }
        if (!equip || item.type !== 'armor') return item
        // Unequip other same-category armor (body vs shield) when this one is equipped
        const iKey        = Object.keys(SD_ARMOR).find(k =>
          SD_ARMOR[k].label.toLowerCase() === (item.item ?? '').toLowerCase()
        )
        const itemIsShield = iKey ? SD_ARMOR[iKey].isShield : false
        return isShield === itemIsShield ? { ...item, equipped: false } : item
      })

      // Only recompute AC for standard (library) armor; custom armor keeps manual AC
      if (!isStandardArmor) return { ...prev, gear: newGear }
      const newAC = computeAC(newGear, prev.stats.dex)
      return { ...prev, gear: newGear, ac: newAC }
    })
  }

  // Scan gear for weapons and add any not already in the attacks list
  function importWeaponsFromGear() {
    setData(prev => {
      const newAtks = gearToAttacks(prev.gear, prev.stats, prev.attacks)
      if (newAtks.length === 0) return prev
      // Drop the lone blank placeholder row if it's the only entry and still empty
      const existing = prev.attacks.filter(a => a.weapon || a.bonus || a.damage || a.notes)
      return { ...prev, attacks: [...existing, ...newAtks] }
    })
  }

  const CASTER_CLASSES = ['Wizard', 'Priest', 'Necromancer', 'Bard']
  const showSpells = CASTER_CLASSES.some(c => c.toLowerCase() === (data.class_name ?? '').toLowerCase()) ||
    data.spells.length > 0

  // Spells the character already has (by name, lowercase) for dedup
  const spellsHeld = new Set(data.spells.map(s => s.name.toLowerCase()))

  // Available spells for picker — class-filtered, excluding already-held
  const pickerSpells = SD_SPELLS_BY_CLASS[data.class_name]?.[spellPickerTier]
    ?.filter(name => !spellsHeld.has(name.toLowerCase())) ?? []

  // Spells-known guidance for current class + level
  const spellsKnownRow = SD_SPELLS_KNOWN[data.class_name]?.[Math.max(1, Math.min(10, Number(data.level) || 1))]

  function addSpellFromLibrary(name) {
    const s = SD_SPELLS[name]
    if (!s) return
    listAdd('spells', {
      name, tier: s.tier, failed: false, custom: false,
      duration: s.duration, range: s.range, description: s.description,
    })
  }

  function addCustomSpell() {
    listAdd('spells', { ...DEFAULT_SPELL, tier: spellPickerTier, custom: true })
  }

  function toggleSpellFailed(i) {
    listSet('spells', i, 'failed', !data.spells[i].failed)
  }

  function toggleSpellExpanded(i) {
    setExpandedSpells(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const carryLimit  = Math.max(10, Number(data.stats.str) || 10)
  const ammoSlots   = (data.arrows > 0 ? 1 : 0) + (data.bolts > 0 ? 1 : 0)
  const slotsUsed   = data.gear.reduce((sum, g) => sum + (Number(g.slots) || 0), 0) + ammoSlots

  const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const STAT_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

  return (
    <div className="relative bg-sd-bg min-h-screen font-body">
      {/* Save indicator */}
      {!readOnly && saveStatus !== 'idle' && (
        <div className={`
          fixed top-4 right-4 z-50 px-3 py-1.5 rounded text-xs font-semibold shadow-lg
          transition-all duration-300
          ${saveStatus === 'saving' ? 'bg-sd-surface border border-sd-border text-sd-subtext' : ''}
          ${saveStatus === 'saved'  ? 'bg-sd-gold/10 border border-sd-gold/40 text-sd-gold' : ''}
          ${saveStatus === 'error'  ? 'bg-red-900/30 border border-red-500/40 text-red-400' : ''}
        `}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved'  && 'Saved ✓'}
          {saveStatus === 'error'  && 'Save failed'}
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 space-y-6">

        {/* Sheet Title */}
        <div className="text-center pt-2 pb-1">
          <h1 className="font-display text-2xl text-sd-gold tracking-wide">Shadowdark</h1>
          <p className="text-sd-subtext text-xs mt-0.5 tracking-wider uppercase">Character Sheet</p>
          {readOnly && (
            <span className="inline-block mt-1 text-[10px] uppercase tracking-widest text-sd-muted border border-sd-border rounded px-2 py-0.5">
              View Only
            </span>
          )}
        </div>

        {/* ── Identity ─────────────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Identity</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FieldInput label="Name"       value={data.name}       onChange={e => set('name', e.target.value)}       disabled={readOnly} className="sm:col-span-2" />
            <FieldSelect label="Alignment" value={data.alignment}  onChange={e => set('alignment', e.target.value)}  disabled={readOnly}
              options={['Lawful', 'Neutral', 'Chaotic']} />
            <FieldInput label="Ancestry"   value={data.ancestry}   onChange={e => set('ancestry', e.target.value)}   disabled={readOnly} />
            <FieldInput label="Class"      value={data.class_name} onChange={e => set('class_name', e.target.value)} disabled={readOnly} />
            <FieldInput label="Title"      value={data.title}      onChange={e => set('title', e.target.value)}      disabled={readOnly} />
            <FieldInput label="Level"      value={data.level}      onChange={e => set('level', clamp(e.target.value, 0, 10))} type="number" min={0} max={10} disabled={readOnly} />
            <FieldInput label="XP"         value={data.xp}         onChange={e => set('xp', Math.max(0, Number(e.target.value)))} type="number" min={0} disabled={readOnly} />
            <FieldInput label="Background" value={data.background} onChange={e => set('background', e.target.value)} disabled={readOnly} />
            <FieldInput label="Deity"      value={data.deity}      onChange={e => set('deity', e.target.value)}      disabled={readOnly} />
          </div>
        </section>

        {/* ── Ability Scores ───────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Ability Scores</SectionHeader>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {STATS.map(s => (
              <StatBox
                key={s}
                label={STAT_LABELS[s]}
                value={data.stats[s]}
                onChange={e => setStat(s, e.target.value)}
                disabled={readOnly}
              />
            ))}
          </div>
        </section>

        {/* ── Combat ───────────────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Combat</SectionHeader>
          <div className="flex flex-wrap items-end gap-4">
            {/* HP — large display */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sd-subtext">Hit Points</span>
              <div className="flex items-baseline gap-2 bg-sd-surface border border-sd-border rounded-lg px-4 py-2">
                <input
                  type="number"
                  value={data.hp_current}
                  onChange={e => set('hp_current', Number(e.target.value))}
                  disabled={readOnly}
                  className="
                    w-16 text-center text-4xl font-bold text-sd-gold bg-transparent
                    border-none focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                  "
                />
                <span className="text-sd-subtext text-lg">/</span>
                <input
                  type="number"
                  value={data.hp_max}
                  onChange={e => set('hp_max', Number(e.target.value))}
                  disabled={readOnly}
                  className="
                    w-12 text-center text-xl font-semibold text-sd-text bg-transparent
                    border-none focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                  "
                />
              </div>
              <div className="flex justify-between px-1 text-[10px] text-sd-muted">
                <span>current</span>
                <span>max</span>
              </div>
            </div>

            {/* AC */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sd-subtext">Armor Class</span>
              <div className="flex items-center justify-center bg-sd-surface border border-sd-border rounded-lg px-4 py-2 w-20 h-[68px]">
                <input
                  type="number"
                  value={data.ac}
                  onChange={e => set('ac', Number(e.target.value))}
                  disabled={readOnly}
                  className="
                    w-full text-center text-3xl font-bold text-sd-text bg-transparent
                    border-none focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                  "
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Attacks ──────────────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Attacks</SectionHeader>

          {/* ── Mobile: card-per-attack (hidden on sm+) ──────────── */}
          <div className="flex flex-col gap-2 sm:hidden">
            {data.attacks.map((atk, i) => (
              <div key={i}
                className="relative bg-sd-surface border border-sd-border rounded-lg p-3 flex flex-col gap-2">
                {!readOnly && (
                  <button
                    onClick={() => listRemove('attacks', i)}
                    className="absolute top-2 right-2 w-7 h-7 rounded text-sd-muted
                      hover:text-red-400 hover:bg-red-400/10
                      flex items-center justify-center text-base leading-none transition-colors"
                    title="Remove attack"
                  >×</button>
                )}
                <AttackWeaponCell
                  value={atk.weapon}
                  stats={data.stats}
                  onChange={patch => setAttack(i, patch)}
                  disabled={readOnly}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-wider text-sd-muted font-semibold">Bonus</span>
                    <input
                      type="text"
                      value={atk.bonus}
                      onChange={e => listSet('attacks', i, 'bonus', e.target.value)}
                      disabled={readOnly}
                      placeholder="+0"
                      className="w-full bg-sd-bg border border-sd-border rounded px-3 py-2.5
                        text-sm text-sd-text placeholder-sd-muted
                        focus:outline-none focus:border-sd-gold transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-wider text-sd-muted font-semibold">Damage</span>
                    <input
                      type="text"
                      value={atk.damage}
                      onChange={e => listSet('attacks', i, 'damage', e.target.value)}
                      disabled={readOnly}
                      placeholder="1d6"
                      className="w-full bg-sd-bg border border-sd-border rounded px-3 py-2.5
                        text-sm text-sd-text placeholder-sd-muted
                        focus:outline-none focus:border-sd-gold transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={atk.notes}
                  onChange={e => listSet('attacks', i, 'notes', e.target.value)}
                  disabled={readOnly}
                  placeholder="Notes (optional)"
                  className="w-full bg-sd-bg border border-sd-border rounded px-3 py-2.5
                    text-sm text-sd-text placeholder-sd-muted
                    focus:outline-none focus:border-sd-gold transition-colors disabled:opacity-50"
                />
              </div>
            ))}
            {!readOnly && (
              <div className="flex items-center gap-2 flex-wrap">
                {data.attacks.length < 6 && (
                  <AddButton onClick={() => listAdd('attacks', DEFAULT_ATTACK)}>Add Attack</AddButton>
                )}
                {data.gear.some(g => g.item) && (
                  <button
                    onClick={importWeaponsFromGear}
                    className="text-xs text-sd-muted border border-sd-border rounded
                      px-3 py-1 hover:text-sd-gold hover:border-sd-gold/40
                      transition-colors flex items-center gap-1"
                    title="Add weapons from gear that aren't already in this list"
                  >
                    ⚔ From gear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Desktop: shared grid (hidden on mobile) ───────────── */}
          <div className="hidden sm:flex flex-col gap-2">
            {/*
              All headers + all input rows are direct children of one CSS Grid
              so column widths are shared and guaranteed to align.
            */}
            <div className={`grid gap-2 items-center ${
              readOnly
                ? 'grid-cols-[2fr_1fr_1fr_2fr]'
                : 'grid-cols-[2fr_1fr_1fr_2fr_1.5rem]'
            }`}>
              {['Weapon', 'Bonus', 'Damage', 'Notes'].map(h => (
                <span key={h} className="text-[10px] uppercase tracking-wider text-sd-subtext font-semibold px-1">
                  {h}
                </span>
              ))}
              {!readOnly && <span />}

              {data.attacks.map((atk, i) => (
                <Fragment key={i}>
                  {/* Weapon — dropdown with auto-fill */}
                  <AttackWeaponCell
                    value={atk.weapon}
                    stats={data.stats}
                    onChange={patch => setAttack(i, patch)}
                    disabled={readOnly}
                  />
                  {/* Bonus / Damage / Notes — plain inputs */}
                  {['bonus', 'damage', 'notes'].map(field => (
                    <input
                      key={field}
                      type="text"
                      value={atk[field]}
                      onChange={e => listSet('attacks', i, field, e.target.value)}
                      disabled={readOnly}
                      placeholder={field === 'bonus' ? '+0' : field === 'damage' ? '1d6' : ''}
                      className="
                        min-w-0 bg-sd-surface border border-sd-border rounded px-2 py-1.5
                        text-sm text-sd-text placeholder-sd-muted
                        focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
                        disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                      "
                    />
                  ))}
                  {!readOnly && (
                    <button
                      onClick={() => listRemove('attacks', i)}
                      className="justify-self-center w-6 h-6 rounded text-sd-muted
                        hover:text-red-400 hover:bg-red-400/10
                        flex items-center justify-center text-base leading-none transition-colors"
                      title="Remove attack"
                    >×</button>
                  )}
                </Fragment>
              ))}
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2 flex-wrap">
                {data.attacks.length < 6 && (
                  <AddButton onClick={() => listAdd('attacks', DEFAULT_ATTACK)}>Add Attack</AddButton>
                )}
                {data.gear.some(g => g.item) && (
                  <button
                    onClick={importWeaponsFromGear}
                    className="text-xs text-sd-muted border border-sd-border rounded
                      px-3 py-1 hover:text-sd-gold hover:border-sd-gold/40
                      transition-colors flex items-center gap-1"
                    title="Add weapons from gear that aren't already in this list"
                  >
                    ⚔ From gear
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Talents ──────────────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Talents</SectionHeader>
          <div className="space-y-2">
            {data.talents.length === 0 && (
              <p className="text-sd-muted text-xs italic">No talents yet.</p>
            )}
            {data.talents.map((talent, i) => (
              <AddRemoveRow key={i} onRemove={() => listRemove('talents', i)} disabled={readOnly}>
                <input
                  type="text"
                  value={talent.name}
                  onChange={e => listSet('talents', i, 'name', e.target.value)}
                  disabled={readOnly}
                  placeholder="Talent name"
                  className="
                    flex-shrink-0 w-36 bg-sd-surface border border-sd-border rounded px-2 py-1.5
                    text-sm text-sd-text placeholder-sd-muted font-semibold
                    focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                  "
                />
                <input
                  type="text"
                  value={talent.description}
                  onChange={e => listSet('talents', i, 'description', e.target.value)}
                  disabled={readOnly}
                  placeholder="Description"
                  className="
                    flex-1 bg-sd-surface border border-sd-border rounded px-2 py-1.5
                    text-sm text-sd-text placeholder-sd-muted
                    focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                  "
                />
              </AddRemoveRow>
            ))}
            {!readOnly && (
              <AddButton onClick={() => listAdd('talents', DEFAULT_TALENT)}>Add Talent</AddButton>
            )}
          </div>
        </section>

        {/* ── Spells ───────────────────────────────────────────────── */}
        {(showSpells || !readOnly) && (
          <section className="bg-sd-card border border-sd-border rounded-xl p-4">
            <SectionHeader>Spells</SectionHeader>

            {/* Spells-known guidance */}
            {showSpells && spellsKnownRow && (
              <div className="flex gap-2 mb-3 flex-wrap">
                <span className="text-xs text-sd-subtext">Spells known at level {data.level}:</span>
                {spellsKnownRow.map((count, ti) => count > 0 && (
                  <span key={ti} className="text-xs bg-sd-surface border border-sd-border rounded px-1.5 py-0.5 text-sd-gold font-semibold">
                    T{ti + 1}: {count}
                  </span>
                ))}
              </div>
            )}

            {!showSpells && !readOnly && (
              <p className="text-sd-muted text-xs italic mb-2">
                Set class to Wizard, Priest, Necromancer, or Bard to track spells.
              </p>
            )}

            {/* Spell rows — grouped by tier, sorted T1→T5 */}
            {(() => {
              // Build tier groups while preserving original array indices (needed for all mutations)
              const groups = [1,2,3,4,5]
                .map(tier => ({
                  tier,
                  entries: data.spells
                    .map((spell, i) => ({ spell, i }))
                    .filter(({ spell }) => (Number(spell.tier) || 1) === tier),
                }))
                .filter(g => g.entries.length > 0)

              if (groups.length === 0 && showSpells) {
                return <p className="text-sd-muted text-xs italic mb-3">No spells yet — add from the library below.</p>
              }

              return (
                <div className="space-y-3 mb-3">
                  {groups.map(({ tier, entries }) => (
                    <div key={tier}>
                      {/* Tier group header */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-sd-gold">Tier {tier}</span>
                        <div className="flex-1 h-px bg-sd-gold/20" />
                      </div>

                      {/* Spell cards in this tier */}
                      <div className="space-y-1.5">
                        {entries.map(({ spell, i }) => {
                          const isExpanded = !!expandedSpells[i]
                          return (
                            <div
                              key={i}
                              className={`
                                rounded-lg border transition-colors
                                ${spell.failed
                                  ? 'border-red-700/60 bg-red-950/20'
                                  : 'border-sd-border bg-sd-surface'}
                              `}
                            >
                              {/* Collapsed header row */}
                              <div className="flex items-center gap-2 px-2.5 py-1.5">
                                {/* Name */}
                                {spell.custom ? (
                                  <input
                                    type="text"
                                    value={spell.name}
                                    onChange={e => listSet('spells', i, 'name', e.target.value)}
                                    disabled={readOnly}
                                    placeholder="Spell name"
                                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-sd-text placeholder-sd-muted focus:outline-none disabled:opacity-50"
                                  />
                                ) : (
                                  <span className="flex-1 min-w-0 text-sm font-semibold text-sd-text truncate">
                                    {spell.name}
                                  </span>
                                )}

                                {/* Duration + Range pills (collapsed) */}
                                {!isExpanded && spell.duration && (
                                  <span className="hidden sm:inline-flex text-[10px] text-sd-subtext border border-sd-border rounded px-1.5 py-0.5 whitespace-nowrap">
                                    {spell.duration}
                                  </span>
                                )}
                                {!isExpanded && spell.range && (
                                  <span className="hidden sm:inline-flex text-[10px] text-sd-subtext border border-sd-border rounded px-1.5 py-0.5 whitespace-nowrap">
                                    {spell.range}
                                  </span>
                                )}

                                {/* Failed toggle */}
                                <button
                                  onClick={() => !readOnly && toggleSpellFailed(i)}
                                  disabled={readOnly}
                                  title={spell.failed ? 'Spell failed — locked until rest. Click to restore.' : 'Mark as failed'}
                                  className={`
                                    flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors
                                    ${spell.failed
                                      ? 'bg-red-700/30 border-red-600/60 text-red-400'
                                      : 'bg-transparent border-sd-border/60 text-sd-muted hover:border-red-600/60 hover:text-red-400'}
                                    disabled:cursor-not-allowed
                                  `}
                                >
                                  {spell.failed ? '✗ FAIL' : 'FAIL'}
                                </button>

                                {/* Expand toggle */}
                                <button
                                  onClick={() => toggleSpellExpanded(i)}
                                  className="flex-shrink-0 text-sd-subtext hover:text-sd-gold transition-colors p-0.5"
                                  title={isExpanded ? 'Collapse' : 'Expand details'}
                                >
                                  <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {/* Remove */}
                                {!readOnly && (
                                  <button
                                    onClick={() => {
                                      listRemove('spells', i)
                                      setExpandedSpells(prev => {
                                        const n = {}
                                        Object.entries(prev).forEach(([k, v]) => {
                                          const ki = Number(k)
                                          if (ki < i) n[ki] = v
                                          else if (ki > i) n[ki - 1] = v
                                        })
                                        return n
                                      })
                                    }}
                                    className="flex-shrink-0 text-sd-muted hover:text-red-400 transition-colors p-0.5"
                                    title="Remove spell"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {/* Expanded detail panel */}
                              {isExpanded && (
                                <div className="border-t border-sd-border/50 px-3 py-2.5 space-y-2">
                                  {spell.custom ? (
                                    <>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] uppercase tracking-wider text-sd-subtext block mb-1">Duration</label>
                                          <input type="text" value={spell.duration} onChange={e => listSet('spells', i, 'duration', e.target.value)} disabled={readOnly} placeholder="e.g. 5 rounds" className="w-full bg-sd-bg border border-sd-border rounded px-2 py-1 text-xs text-sd-text focus:outline-none focus:border-sd-gold disabled:opacity-50" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] uppercase tracking-wider text-sd-subtext block mb-1">Range</label>
                                          <input type="text" value={spell.range} onChange={e => listSet('spells', i, 'range', e.target.value)} disabled={readOnly} placeholder="e.g. Near" className="w-full bg-sd-bg border border-sd-border rounded px-2 py-1 text-xs text-sd-text focus:outline-none focus:border-sd-gold disabled:opacity-50" />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-[10px] uppercase tracking-wider text-sd-subtext block mb-1">Description</label>
                                        <textarea value={spell.description} onChange={e => listSet('spells', i, 'description', e.target.value)} disabled={readOnly} placeholder="Spell effect…" rows={3} className="w-full bg-sd-bg border border-sd-border rounded px-2 py-1 text-xs text-sd-text focus:outline-none focus:border-sd-gold disabled:opacity-50 resize-none" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] uppercase tracking-wider text-sd-subtext block mb-1">Tier</label>
                                        <select value={spell.tier} onChange={e => listSet('spells', i, 'tier', Number(e.target.value))} disabled={readOnly} className="bg-sd-bg border border-sd-border rounded px-2 py-1 text-xs text-sd-text focus:outline-none focus:border-sd-gold disabled:opacity-50">
                                          {[1,2,3,4,5].map(t => <option key={t} value={t}>Tier {t}</option>)}
                                        </select>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex gap-3 text-xs text-sd-subtext">
                                        {spell.duration && <span><span className="text-sd-gold font-semibold">Duration:</span> {spell.duration}</span>}
                                        {spell.range    && <span><span className="text-sd-gold font-semibold">Range:</span> {spell.range}</span>}
                                      </div>
                                      <p className="text-xs text-sd-text leading-relaxed">{spell.description}</p>
                                    </>
                                  )}
                                  {spell.failed && (
                                    <p className="text-[10px] text-red-400 italic">This spell failed its casting check — it is locked until rest.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Add spell UI */}
            {!readOnly && (
              <div className="border-t border-sd-border/50 pt-3 space-y-2">
                {/* Tier selector tabs */}
                {showSpells && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-sd-subtext mr-1">Tier:</span>
                    {[1,2,3,4,5].map(t => (
                      <button
                        key={t}
                        onClick={() => setSpellPickerTier(t)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${spellPickerTier === t ? 'bg-sd-gold/20 border-sd-gold text-sd-gold' : 'border-sd-border text-sd-subtext hover:border-sd-gold/50 hover:text-sd-gold'}`}
                      >T{t}</button>
                    ))}
                  </div>
                )}

                {showSpells && pickerSpells.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      id="spell-picker-select"
                      defaultValue=""
                      className="flex-1 bg-sd-surface border border-sd-border rounded px-2 py-1.5 text-sm text-sd-text focus:outline-none focus:border-sd-gold"
                    >
                      <option value="" disabled>— pick a spell to add —</option>
                      {pickerSpells.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const sel = document.getElementById('spell-picker-select')
                        if (sel?.value) { addSpellFromLibrary(sel.value); sel.value = '' }
                      }}
                      className="px-3 py-1.5 bg-sd-gold/10 border border-sd-gold/40 rounded text-sd-gold text-sm font-semibold hover:bg-sd-gold/20 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                ) : showSpells ? (
                  <p className="text-sd-muted text-xs italic">All Tier {spellPickerTier} spells for {data.class_name} already added.</p>
                ) : null}

                <button
                  onClick={addCustomSpell}
                  className="flex items-center gap-1.5 text-xs text-sd-subtext hover:text-sd-gold border border-sd-border hover:border-sd-gold/40 rounded px-2.5 py-1.5 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Add custom spell
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Gear ─────────────────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Gear</SectionHeader>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-sd-subtext">
              Carry capacity: <span className="text-sd-text font-semibold">{carryLimit} slots</span>
            </span>
            <span className={`text-xs font-semibold ${slotsUsed > carryLimit ? 'text-red-400' : 'text-sd-gold'}`}>
              {slotsUsed} / {carryLimit} used
            </span>
          </div>

          {/* Column headers (visible on sm+) */}
          <div className="hidden sm:grid grid-cols-[1.25rem_1fr_auto] gap-2 mb-1 px-1">
            <span className="text-[9px] uppercase tracking-wider text-sd-muted text-center" title="Equipped">Eq</span>
            <span className="text-[9px] uppercase tracking-wider text-sd-muted">Item</span>
            <span className="text-[9px] uppercase tracking-wider text-sd-muted text-center w-14">Slots</span>
          </div>

          <div className="space-y-2">
            {data.gear.length === 0 && (
              <p className="text-sd-muted text-xs italic">No gear yet.</p>
            )}
            {data.gear.map((g, i) => (
              <AddRemoveRow key={i} onRemove={() => listRemove('gear', i)} disabled={readOnly}>
                {/* ── Equipped checkbox ── */}
                <label
                  className="flex-shrink-0 flex items-center justify-center w-5 cursor-pointer"
                  title={g.equipped ? 'Equipped — click to unequip' : 'Click to equip'}
                >
                  <input
                    type="checkbox"
                    checked={!!g.equipped}
                    onChange={e => toggleEquip(i, e.target.checked)}
                    disabled={readOnly || (!g.item && g.type !== 'gear')}
                    className="w-3.5 h-3.5 rounded cursor-pointer accent-sd-gold
                      disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </label>

                {/* ── Item name — adapts to row type ── */}
                {g.type === 'weapon' ? (
                  <GearWeaponSelect
                    value={g.item}
                    notes={g.notes}
                    onChange={patch => setGearItem(i, patch)}
                    onNotesChange={val => setGearItem(i, { notes: val })}
                    disabled={readOnly}
                  />
                ) : g.type === 'armor' ? (
                  <GearArmorSelect
                    value={g.item}
                    notes={g.notes}
                    onChange={patch => setGearItem(i, patch)}
                    onNotesChange={val => setGearItem(i, { notes: val })}
                    disabled={readOnly}
                  />
                ) : (
                  <input
                    type="text"
                    value={g.item}
                    onChange={e => listSet('gear', i, 'item', e.target.value)}
                    disabled={readOnly}
                    placeholder="Item name"
                    className="
                      flex-1 bg-sd-surface border border-sd-border rounded px-2 py-1.5
                      text-sm text-sd-text placeholder-sd-muted
                      focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                    "
                  />
                )}

                {/* ── Slots ── */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    value={g.slots}
                    onChange={e => listSet('gear', i, 'slots', Math.max(0, Number(e.target.value)))}
                    disabled={readOnly}
                    min={0}
                    className="
                      w-14 bg-sd-surface border border-sd-border rounded px-2 py-1.5
                      text-sm text-sd-text text-center
                      focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                    "
                  />
                  <span className="text-[10px] text-sd-muted uppercase tracking-wide sm:hidden">sl</span>
                </div>
              </AddRemoveRow>
            ))}

            {/* ── Ammunition counters ── */}
            {(data.arrows > 0 || data.bolts > 0 || !readOnly) && (
              <div className="flex flex-col gap-1.5 pt-1">
                {(data.arrows > 0 || !readOnly) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-sd-muted w-5 text-center flex-shrink-0">🏹</span>
                    <span className="flex-1 text-sm text-sd-text">Arrows</span>
                    {readOnly ? (
                      <span className="text-sm font-bold text-sd-text font-mono">{data.arrows} / 20</span>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => set('arrows', Math.max(0, data.arrows - 1))}
                          disabled={data.arrows <= 0}
                          className="w-7 h-7 rounded border border-sd-border text-sd-muted hover:text-sd-text hover:border-sd-gold/40 flex items-center justify-center text-base leading-none transition-colors disabled:opacity-30"
                        >−</button>
                        <span className="w-12 text-center text-sm font-bold font-mono text-sd-text">
                          {data.arrows} / 20
                        </span>
                        <button
                          onClick={() => set('arrows', Math.min(20, data.arrows + 1))}
                          disabled={data.arrows >= 20}
                          className="w-7 h-7 rounded border border-sd-border text-sd-muted hover:text-sd-text hover:border-sd-gold/40 flex items-center justify-center text-base leading-none transition-colors disabled:opacity-30"
                        >+</button>
                      </div>
                    )}
                  </div>
                )}
                {(data.bolts > 0 || !readOnly) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-sd-muted w-5 text-center flex-shrink-0">🎯</span>
                    <span className="flex-1 text-sm text-sd-text">Crossbow Bolts</span>
                    {readOnly ? (
                      <span className="text-sm font-bold text-sd-text font-mono">{data.bolts} / 20</span>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => set('bolts', Math.max(0, data.bolts - 1))}
                          disabled={data.bolts <= 0}
                          className="w-7 h-7 rounded border border-sd-border text-sd-muted hover:text-sd-text hover:border-sd-gold/40 flex items-center justify-center text-base leading-none transition-colors disabled:opacity-30"
                        >−</button>
                        <span className="w-12 text-center text-sm font-bold font-mono text-sd-text">
                          {data.bolts} / 20
                        </span>
                        <button
                          onClick={() => set('bolts', Math.min(20, data.bolts + 1))}
                          disabled={data.bolts >= 20}
                          className="w-7 h-7 rounded border border-sd-border text-sd-muted hover:text-sd-text hover:border-sd-gold/40 flex items-center justify-center text-base leading-none transition-colors disabled:opacity-30"
                        >+</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <AddButton onClick={() => listAdd('gear', DEFAULT_WEAPON_GEAR)}>⚔ Add Weapon</AddButton>
                <AddButton onClick={() => listAdd('gear', DEFAULT_ARMOR_GEAR)}>🛡 Add Armor</AddButton>
                <AddButton onClick={() => listAdd('gear', DEFAULT_GEAR)}>Add Item</AddButton>
              </div>
            )}
          </div>
        </section>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <section className="bg-sd-card border border-sd-border rounded-xl p-4">
          <SectionHeader>Notes</SectionHeader>
          <textarea
            value={data.notes}
            onChange={e => set('notes', e.target.value)}
            disabled={readOnly}
            rows={5}
            placeholder="Session notes, NPC names, quest hooks…"
            className="
              w-full bg-sd-surface border border-sd-border rounded-lg
              px-3 py-2.5 text-sm text-sd-text placeholder-sd-muted
              focus:outline-none focus:border-sd-gold focus:ring-1 focus:ring-sd-gold/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors resize-y
            "
          />
        </section>

        <div className="h-6" />
      </div>
    </div>
  )
}
