/**
 * NimbleMonsterForm — Full-page Nimble RPG monster builder
 *
 * Shows a tier-selection screen first, then renders the correct form:
 *   "Bestiary Entry"   — common creatures defined by level, armor, HP,
 *                        flavorful ability chips, attacks, encounters, loot
 *   "Legendary Monster"— named bosses with epithet, named actions, BLUNDER
 *                        mechanic, loot items, and expanded combat stats
 *
 * Emerald-400 theme. BLUNDER section uses amber-500 to signal danger.
 *
 * stat_data (Bestiary Entry):
 *   { monsterTier, category, size, description, level, hp, armor, savedc,
 *     damagePerRound, attacks:[{name,damage,note}], flavorAbilities:[],
 *     customAbility, sampleEncounters, loot }
 *
 * stat_data (Legendary Monster):
 *   { monsterTier, epithet, description, level, hp, armor, savedc,
 *     meleeRange, rangedRange, actions:[{name,description}], blunder,
 *     lootItems:[string] }
 *
 * challenge column = level string (e.g. "1/4", "3", "10")
 */

import { useState, useMemo, useCallback } from 'react'
import { Link }                           from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Plus, Trash2,
  ChevronDown, ChevronUp, Shuffle, Info,
} from 'lucide-react'
import { api } from '../../utils/api'

// ─── uid counter (stable React keys for dynamic rows) ────────────────────────
let _uid = Date.now()
const uid = () => ++_uid

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS = ['1/4','1/3','1/2','1','2','3','4','5','6','7','8','9','10']

const ARMOR_OPTIONS = [
  { value: 'none',   label: 'No Armor',    short: 'None'   },
  { value: 'medium', label: 'Medium Armor', short: 'Medium' },
  { value: 'heavy',  label: 'Heavy Armor',  short: 'Heavy'  },
]

const SIZE_OPTIONS = ['Tiny','Small','Medium','Large','Huge','Gargantuan']

// Stat benchmarks per level / armor tier — derived from game design principles,
// not verbatim table copy. Use as a starting-point guide, not hard rules.
const LEVEL_GUIDE = [
  { lv: '1/4', none: 12, med: 9,   hvy: 7,  dmg: 3,  dc: 9  },
  { lv: '1/3', none: 15, med: 11,  hvy: 8,  dmg: 5,  dc: 9  },
  { lv: '1/2', none: 18, med: 15,  hvy: 11, dmg: 7,  dc: 10 },
  { lv: '1',   none: 26, med: 20,  hvy: 16, dmg: 11, dc: 10 },
  { lv: '2',   none: 34, med: 27,  hvy: 20, dmg: 11, dc: 11 },
  { lv: '3',   none: 41, med: 33,  hvy: 25, dmg: 15, dc: 11 },
  { lv: '4',   none: 49, med: 39,  hvy: 29, dmg: 18, dc: 12 },
  { lv: '5',   none: 58, med: 46,  hvy: 35, dmg: 19, dc: 12 },
  { lv: '6',   none: 68, med: 54,  hvy: 41, dmg: 21, dc: 13 },
  { lv: '7',   none: 79, med: 63,  hvy: 47, dmg: 24, dc: 13 },
  { lv: '8',   none: 91, med: 73,  hvy: 55, dmg: 26, dc: 14 },
  { lv: '9',   none: 104,med: 83,  hvy: 62, dmg: 28, dc: 14 },
  { lv: '10',  none: 118,med: 94,  hvy: 71, dmg: 30, dc: 15 },
]

// Flavorful ability keywords — concepts inspired by Nimble RPG, wording original
const FLAVOR_ABILITIES = [
  'Acid Blood',        'Aggressive',         'Blinding Spit',     'Bloodthirsty',
  'Brute',             'Burning Aura',        'Climbing',          'Controlling',
  'Doom',              'Explosive Death',     'FAST',              'Fearsome',
  'Flying',            'Formation',           'Frenzied',          'Grappler',
  'Gravity Manipulator','Hates the Light',    'Hypnotic Gaze',     'Invulnerable',
  'Mounted',           'Obstinate',           'Pack Tactics',      'Parry',
  'Ranged',            'Retaliate',           'Savage',            'Shifty',
  'Silencer',          'Sneak',               'Spiked',            'Standard Bearer',
  'Sturdy/Undying',    'Summoner',            'Tricky',            'Vicious',
  'Warping Touch',     'Webslinger',
]

// ─── Shared Tailwind tokens ───────────────────────────────────────────────────

const INPUT = [
  'w-full bg-codex-bg border border-codex-border rounded-lg px-3 py-2',
  'text-sm text-codex-text placeholder-codex-muted',
  'focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30',
  'transition-colors disabled:opacity-40',
].join(' ')

const SECTION        = 'rounded-xl border border-emerald-400/20 overflow-hidden'
const SECTION_HEADER = 'px-4 py-3 bg-emerald-500/10 border-b border-emerald-400/15 flex items-center gap-2'
const SECTION_BODY   = 'p-4 flex flex-col gap-3 bg-codex-surface/40'
const LABEL          = 'text-xs font-semibold text-emerald-400 uppercase tracking-wider'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const blankAttack  = () => ({ id: uid(), name: '', damage: '', note: '' })
const blankAction  = () => ({ id: uid(), name: '', description: '' })
const blankLootItem= () => ({ id: uid(), text: '' })

function lookupGuide(level, armor) {
  const row = LEVEL_GUIDE.find(r => r.lv === level)
  if (!row) return null
  const hp = armor === 'heavy' ? row.hvy : armor === 'medium' ? row.med : row.none
  return { hp, dmg: row.dmg, dc: row.dc }
}

// ─── initForm helpers ─────────────────────────────────────────────────────────

function initEntryForm(existing) {
  const sd = existing?.stat_data ?? {}
  return {
    name:             existing?.name               ?? '',
    category:         sd.category                  ?? '',
    size:             sd.size                      ?? 'Medium',
    description:      sd.description               ?? '',
    level:            sd.level                     ?? (existing?.challenge ?? '1'),
    hp:               sd.hp     != null ? String(sd.hp)    : '',
    armor:            sd.armor                     ?? 'none',
    savedc:           sd.savedc != null ? String(sd.savedc): '',
    damagePerRound:   sd.damagePerRound != null ? String(sd.damagePerRound) : '',
    attacks:          sd.attacks?.length
                        ? sd.attacks.map(a => ({ ...a, id: uid() }))
                        : [blankAttack()],
    flavorAbilities:  Array.isArray(sd.flavorAbilities) ? sd.flavorAbilities : [],
    customAbility:    sd.customAbility             ?? '',
    sampleEncounters: sd.sampleEncounters          ?? '',
    loot:             sd.loot                      ?? '',
    tags:             existing?.tags               ?? '',
  }
}

function initLegendaryForm(existing) {
  const sd = existing?.stat_data ?? {}
  return {
    name:        existing?.name              ?? '',
    epithet:     sd.epithet                  ?? '',
    description: sd.description              ?? '',
    level:       sd.level                   ?? (existing?.challenge ?? '5'),
    hp:          sd.hp     != null ? String(sd.hp)    : '',
    armor:       sd.armor                   ?? 'none',
    savedc:      sd.savedc != null ? String(sd.savedc): '',
    meleeRange:  sd.meleeRange              ?? '',
    rangedRange: sd.rangedRange             ?? '',
    actions:     sd.actions?.length
                   ? sd.actions.map(a => ({ ...a, id: uid() }))
                   : [blankAction()],
    blunder:     sd.blunder                 ?? '',
    lootItems:   sd.lootItems?.length
                   ? sd.lootItems.map(t => ({ id: uid(), text: t }))
                   : [blankLootItem()],
    tags:        existing?.tags             ?? '',
  }
}

// ─── Collapsible panel ────────────────────────────────────────────────────────

function Collapsible({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-emerald-400/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3
          bg-emerald-500/10 text-left gap-2 hover:bg-emerald-500/15 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        {open
          ? <ChevronUp   size={14} className="text-emerald-400/60 shrink-0" />
          : <ChevronDown size={14} className="text-emerald-400/60 shrink-0" />}
      </button>
      {open && (
        <div className="p-4 bg-codex-surface/40 border-t border-emerald-400/15">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Tier Selection Screen ────────────────────────────────────────────────────

function TierSelection({ onSelect, onBack }) {
  return (
    <div className="min-h-screen bg-codex-bg">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-emerald-400/20 bg-codex-surface/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
          <span className="text-codex-border">/</span>
          <button
            onClick={onBack}
            className="text-sm text-codex-subtext hover:text-emerald-400 transition-colors"
          >
            Nimble Bestiary
          </button>
          <span className="text-codex-border">/</span>
          <span className="text-sm font-medium text-emerald-400">New Monster</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-16">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext
            hover:text-codex-text transition-colors mb-10"
        >
          <ArrowLeft size={14} /> Back to Bestiary
        </button>

        <div className="text-center mb-10">
          <p className="text-4xl mb-3">🛡️</p>
          <h1 className="text-2xl font-bold text-codex-text mb-2">
            Nimble RPG — Bestiary Builder
          </h1>
          <p className="text-sm text-codex-subtext">
            What kind of creature are you forging?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Bestiary Entry */}
          <button
            type="button"
            onClick={() => onSelect('entry')}
            className="group text-left p-7 rounded-2xl border border-emerald-400/25
              bg-codex-surface hover:border-emerald-400/60 hover:bg-emerald-500/5
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <div className="text-3xl mb-4">⚔️</div>
            <h2 className="text-base font-bold text-codex-text mb-2
              group-hover:text-emerald-400 transition-colors">
              Bestiary Entry
            </h2>
            <p className="text-xs text-codex-subtext leading-relaxed mb-4">
              Standard creatures, monsters, and NPCs the party encounters. Defined by
              level, armor, hit points, and a set of distinctive flavorful abilities.
            </p>
            <span className="text-xs text-emerald-400/70 font-medium">
              Common Encounters →
            </span>
          </button>

          {/* Legendary Monster */}
          <button
            type="button"
            onClick={() => onSelect('legendary')}
            className="group text-left p-7 rounded-2xl border border-emerald-400/25
              bg-codex-surface hover:border-emerald-400/60 hover:bg-emerald-500/5
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <div className="text-3xl mb-4">👑</div>
            <h2 className="text-base font-bold text-codex-text mb-2
              group-hover:text-emerald-400 transition-colors">
              Legendary Monster
            </h2>
            <p className="text-xs text-codex-subtext leading-relaxed mb-4">
              Named bosses and mythic threats with an epithet, unique named actions,
              a BLUNDER mechanic, and expanded combat statistics built for dramatic fights.
            </p>
            <span className="text-xs text-emerald-400/70 font-medium">
              Boss Encounters →
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Level Guide Reference Table ─────────────────────────────────────────────

function LevelGuideTable({ currentLevel, armor }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="text-emerald-400/70">
              <th className="text-left pb-1.5 pr-2 font-semibold">LV</th>
              <th className="pb-1.5 px-1 font-semibold text-center">No Armor</th>
              <th className="pb-1.5 px-1 font-semibold text-center">Medium</th>
              <th className="pb-1.5 px-1 font-semibold text-center">Heavy</th>
              <th className="pb-1.5 px-1 font-semibold text-center">Dmg</th>
              <th className="pb-1.5 pl-1 font-semibold text-center">Save DC</th>
            </tr>
          </thead>
          <tbody>
            {LEVEL_GUIDE.map(row => {
              const active = row.lv === currentLevel
              return (
                <tr
                  key={row.lv}
                  className={active
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-codex-muted even:bg-codex-bg/40'}
                >
                  <td className="py-0.5 pr-2 font-bold">{row.lv}</td>
                  <td className={`py-0.5 px-1 text-center ${active && armor === 'none'   ? 'font-bold text-emerald-300' : ''}`}>{row.none}</td>
                  <td className={`py-0.5 px-1 text-center ${active && armor === 'medium' ? 'font-bold text-emerald-300' : ''}`}>{row.med}</td>
                  <td className={`py-0.5 px-1 text-center ${active && armor === 'heavy'  ? 'font-bold text-emerald-300' : ''}`}>{row.hvy}</td>
                  <td className="py-0.5 px-1 text-center">{row.dmg}</td>
                  <td className="py-0.5 pl-1 text-center">{row.dc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-codex-muted mt-2 italic leading-relaxed">
        HP shown per armor tier. Active row highlighted. These are design
        benchmarks — deviate when the story calls for it.
      </p>
    </>
  )
}

// ─── Live Preview — Bestiary Entry ───────────────────────────────────────────

function EntryPreview({ form }) {
  const guide = lookupGuide(form.level, form.armor)
  const armorShort = ARMOR_OPTIONS.find(a => a.value === form.armor)?.short ?? '—'

  return (
    <div className="font-mono text-xs leading-relaxed space-y-2">
      {/* Name / category */}
      <div>
        <span className="text-emerald-400 font-bold text-sm uppercase tracking-wide">
          {form.name || <span className="opacity-40">CREATURE NAME</span>}
        </span>
        {form.category && (
          <span className="text-codex-subtext ml-2 not-italic text-xs">
            ({form.category})
          </span>
        )}
      </div>
      {form.size && (
        <div className="text-codex-muted">{form.size} creature</div>
      )}

      {/* Core stats */}
      <div className="border-t border-emerald-400/20 pt-2 space-y-0.5">
        <div className="flex flex-wrap gap-x-3">
          <span>
            <span className="font-bold text-codex-text">LV </span>
            <span className="text-codex-subtext">{form.level || '—'}</span>
          </span>
          <span>
            <span className="font-bold text-codex-text">HP </span>
            <span className="text-codex-subtext">{form.hp || (guide ? guide.hp : '—')}</span>
          </span>
          <span>
            <span className="font-bold text-codex-text">Armor </span>
            <span className="text-codex-subtext">{armorShort}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <span>
            <span className="font-bold text-codex-text">Save DC </span>
            <span className="text-codex-subtext">{form.savedc || (guide ? guide.dc : '—')}</span>
          </span>
          <span>
            <span className="font-bold text-codex-text">Dmg/Rd </span>
            <span className="text-codex-subtext">{form.damagePerRound || (guide ? guide.dmg : '—')}</span>
          </span>
        </div>
      </div>

      {/* Attacks */}
      {form.attacks.some(a => a.name.trim()) && (
        <div className="border-t border-emerald-400/20 pt-2">
          <div className="font-bold text-codex-text mb-0.5">Attacks</div>
          {form.attacks.filter(a => a.name.trim()).map(a => (
            <div key={a.id} className="text-codex-subtext">
              {'• '}{a.name}
              {a.damage ? ` (${a.damage})` : ''}
              {a.note   ? ` — ${a.note}`   : ''}
            </div>
          ))}
        </div>
      )}

      {/* Abilities */}
      {(form.flavorAbilities.length > 0 || form.customAbility.trim()) && (
        <div className="border-t border-emerald-400/20 pt-2">
          <div className="font-bold text-codex-text mb-0.5">Abilities</div>
          <div className="text-codex-subtext">
            {[...form.flavorAbilities, form.customAbility.trim()].filter(Boolean).join(', ')}
          </div>
        </div>
      )}

      {/* Description */}
      {form.description.trim() && (
        <div className="border-t border-emerald-400/20 pt-2 text-codex-muted italic">
          {form.description}
        </div>
      )}
    </div>
  )
}

// ─── Live Preview — Legendary Monster ────────────────────────────────────────

function LegendaryPreview({ form }) {
  const guide = lookupGuide(form.level, form.armor)
  const armorShort = ARMOR_OPTIONS.find(a => a.value === form.armor)?.short ?? '—'

  return (
    <div className="font-mono text-xs leading-relaxed space-y-2">
      {/* Name + epithet */}
      <div>
        <span className="text-emerald-400 font-bold text-sm uppercase tracking-wide">
          {form.name || <span className="opacity-40">LEGENDARY NAME</span>}
        </span>
        {form.epithet.trim() && (
          <div className="text-codex-subtext italic text-xs mt-0.5">{form.epithet}</div>
        )}
      </div>

      {/* Core stats */}
      <div className="border-t border-emerald-400/20 pt-2 space-y-0.5">
        <div className="flex flex-wrap gap-x-3">
          <span>
            <span className="font-bold text-codex-text">LV </span>
            <span className="text-codex-subtext">{form.level || '—'}</span>
          </span>
          <span>
            <span className="font-bold text-codex-text">HP </span>
            <span className="text-codex-subtext">{form.hp || (guide ? guide.hp : '—')}</span>
          </span>
          <span>
            <span className="font-bold text-codex-text">Armor </span>
            <span className="text-codex-subtext">{armorShort}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <span>
            <span className="font-bold text-codex-text">Save DC </span>
            <span className="text-codex-subtext">{form.savedc || (guide ? guide.dc : '—')}</span>
          </span>
          {form.meleeRange.trim() && (
            <span>
              <span className="font-bold text-codex-text">Melee </span>
              <span className="text-codex-subtext">{form.meleeRange}</span>
            </span>
          )}
          {form.rangedRange.trim() && (
            <span>
              <span className="font-bold text-codex-text">Ranged </span>
              <span className="text-codex-subtext">{form.rangedRange}</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {form.actions.some(a => a.name.trim()) && (
        <div className="border-t border-emerald-400/20 pt-2">
          <div className="font-bold text-codex-text mb-1">Actions</div>
          {form.actions.filter(a => a.name.trim()).map(a => (
            <div key={a.id} className="mb-1">
              <span className="font-semibold text-codex-text">{a.name}.</span>
              {a.description.trim() && (
                <span className="text-codex-subtext"> {a.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Blunder */}
      {form.blunder.trim() && (
        <div className="border-t border-amber-500/30 pt-2">
          <span className="font-bold text-amber-400">BLUNDER. </span>
          <span className="text-codex-subtext">{form.blunder}</span>
        </div>
      )}

      {/* Loot */}
      {form.lootItems.some(l => l.text.trim()) && (
        <div className="border-t border-emerald-400/20 pt-2">
          <div className="font-bold text-codex-text mb-0.5">Loot</div>
          {form.lootItems.filter(l => l.text.trim()).map(l => (
            <div key={l.id} className="text-codex-subtext">{'• '}{l.text}</div>
          ))}
        </div>
      )}

      {/* Description */}
      {form.description.trim() && (
        <div className="border-t border-emerald-400/20 pt-2 text-codex-muted italic">
          {form.description}
        </div>
      )}
    </div>
  )
}

// ─── Shared nav bar ───────────────────────────────────────────────────────────

function NimbleNav({ onBack, crumb }) {
  return (
    <header className="sticky top-0 z-10 border-b border-emerald-400/20 bg-codex-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
          <BookOpen size={16} />
          <span className="font-display text-sm tracking-wide">CampaignCodex</span>
        </Link>
        <span className="text-codex-border">/</span>
        <button
          onClick={onBack}
          className="text-sm text-codex-subtext hover:text-emerald-400 transition-colors"
        >
          Nimble Bestiary
        </button>
        <span className="text-codex-border">/</span>
        <span className="text-sm font-medium text-emerald-400">{crumb}</span>
      </div>
    </header>
  )
}

// ─── Bestiary Entry Form ──────────────────────────────────────────────────────

function EntryForm({ existing, onBack, onSaved }) {
  const isEdit = Boolean(existing)
  const [form,   setForm]   = useState(() => initEntryForm(existing))
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  const set = useCallback(
    (field, value) => setForm(p => ({ ...p, [field]: value })),
    [],
  )

  // Derive guide values reactively
  const guide = useMemo(
    () => lookupGuide(form.level, form.armor),
    [form.level, form.armor],
  )

  // Auto-fill empty stat fields from guide row
  function fillFromGuide() {
    if (!guide) return
    setForm(p => ({
      ...p,
      hp:            p.hp.trim()            || String(guide.hp),
      savedc:        p.savedc.trim()        || String(guide.dc),
      damagePerRound:p.damagePerRound.trim()|| String(guide.dmg),
    }))
  }

  // Attacks
  const addAttack    = () => setForm(p => ({ ...p, attacks: [...p.attacks, blankAttack()] }))
  const removeAttack = id => setForm(p => ({ ...p, attacks: p.attacks.filter(a => a.id !== id) }))
  const setAttack    = (id, field, value) =>
    setForm(p => ({ ...p, attacks: p.attacks.map(a => a.id === id ? { ...a, [field]: value } : a) }))

  // Flavorful abilities toggle
  function toggleAbility(ability) {
    setForm(p => {
      const has = p.flavorAbilities.includes(ability)
      return {
        ...p,
        flavorAbilities: has
          ? p.flavorAbilities.filter(a => a !== ability)
          : [...p.flavorAbilities, ability],
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Creature name is required.'); return }
    setSaving(true)
    try {
      const statData = {
        monsterTier:      'entry',
        category:         form.category.trim()        || null,
        size:             form.size                   || null,
        description:      form.description.trim()     || null,
        level:            form.level                  || null,
        hp:               form.hp.trim()     ? Number(form.hp)     : null,
        armor:            form.armor                  || null,
        savedc:           form.savedc.trim() ? Number(form.savedc) : null,
        damagePerRound:   form.damagePerRound.trim()
                            ? Number(form.damagePerRound) : null,
        attacks:          form.attacks
                            .filter(a => a.name.trim())
                            .map(({ id: _id, ...rest }) => ({
                              name:   rest.name.trim(),
                              damage: rest.damage.trim() || null,
                              note:   rest.note.trim()   || null,
                            })),
        flavorAbilities:  form.flavorAbilities,
        customAbility:    form.customAbility.trim()   || null,
        sampleEncounters: form.sampleEncounters.trim()|| null,
        loot:             form.loot.trim()            || null,
      }
      const payload = {
        name:      form.name.trim(),
        challenge: form.level || null,
        tags:      form.tags.trim() || null,
        statData,
      }
      const res = isEdit
        ? await api.patch(`/bestiary/${existing.id}`, payload)
        : await api.post('/bestiary', { ...payload, gameSystem: 'nimble' })
      onSaved(res.monster)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-codex-bg">
      <NimbleNav
        onBack={onBack}
        crumb={isEdit ? `Editing — ${existing.name}` : 'New Bestiary Entry'}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext
            hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Bestiary
        </button>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

            {/* ── LEFT PANEL ── */}
            <div className="flex flex-col gap-5">

              {/* Identity */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>⚔️</span>
                  <span className={LABEL}>Identity</span>
                </div>
                <div className={SECTION_BODY}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-codex-text">
                        Creature Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text" value={form.name}
                        onChange={e => set('name', e.target.value)}
                        placeholder="e.g. Stone-Backed Brute, Fungal Creeper"
                        maxLength={100} disabled={saving} autoFocus className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Category / Type</label>
                      <input
                        type="text" value={form.category}
                        onChange={e => set('category', e.target.value)}
                        placeholder="e.g. Beast, Undead, Construct"
                        maxLength={60} disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Size</label>
                      <select
                        value={form.size} onChange={e => set('size', e.target.value)}
                        disabled={saving} className={INPUT}
                      >
                        {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-codex-text">Description / Lore</label>
                      <textarea
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="Describe this creature's appearance, behavior, or lore…"
                        rows={3} maxLength={800} disabled={saving}
                        className={`${INPUT} resize-y`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Core Stats */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>📊</span>
                  <span className={LABEL}>Core Stats</span>
                  {guide && (
                    <button
                      type="button" onClick={fillFromGuide}
                      className="ml-auto flex items-center gap-1 text-[10px] font-medium
                        text-emerald-400/70 hover:text-emerald-400 transition-colors"
                    >
                      <Shuffle size={10} /> Auto-fill from guide
                    </button>
                  )}
                </div>
                <div className={SECTION_BODY}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Level</label>
                      <select
                        value={form.level} onChange={e => set('level', e.target.value)}
                        disabled={saving} className={INPUT}
                      >
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Armor</label>
                      <select
                        value={form.armor} onChange={e => set('armor', e.target.value)}
                        disabled={saving} className={INPUT}
                      >
                        {ARMOR_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">
                        Hit Points
                        {guide && (
                          <span className="ml-1 font-normal text-codex-muted">
                            (guide: {guide.hp})
                          </span>
                        )}
                      </label>
                      <input
                        type="number" min="1" value={form.hp}
                        onChange={e => set('hp', e.target.value)}
                        placeholder={guide ? String(guide.hp) : 'HP'}
                        disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">
                        Save DC
                        {guide && (
                          <span className="ml-1 font-normal text-codex-muted">
                            (guide: {guide.dc})
                          </span>
                        )}
                      </label>
                      <input
                        type="number" min="1" value={form.savedc}
                        onChange={e => set('savedc', e.target.value)}
                        placeholder={guide ? String(guide.dc) : 'DC'}
                        disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">
                        Avg Damage / Round
                        {guide && (
                          <span className="ml-1 font-normal text-codex-muted">
                            (guide: {guide.dmg})
                          </span>
                        )}
                      </label>
                      <input
                        type="number" min="0" value={form.damagePerRound}
                        onChange={e => set('damagePerRound', e.target.value)}
                        placeholder={guide ? String(guide.dmg) : 'avg dmg'}
                        disabled={saving} className={INPUT}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attacks */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>🗡️</span>
                  <span className={LABEL}>Attacks</span>
                  <button
                    type="button" onClick={addAttack}
                    className="ml-auto flex items-center gap-1 text-[10px] font-medium
                      text-emerald-400/70 hover:text-emerald-400 transition-colors"
                  >
                    <Plus size={10} /> Add Attack
                  </button>
                </div>
                <div className={SECTION_BODY}>
                  {form.attacks.map(atk => (
                    <div key={atk.id} className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text" value={atk.name}
                          onChange={e => setAttack(atk.id, 'name', e.target.value)}
                          placeholder="Attack name"
                          maxLength={60} disabled={saving} className={INPUT}
                        />
                        <input
                          type="text" value={atk.damage}
                          onChange={e => setAttack(atk.id, 'damage', e.target.value)}
                          placeholder="Damage (e.g. 2d6+3)"
                          maxLength={30} disabled={saving} className={INPUT}
                        />
                        <input
                          type="text" value={atk.note}
                          onChange={e => setAttack(atk.id, 'note', e.target.value)}
                          placeholder="Note (optional)"
                          maxLength={80} disabled={saving} className={INPUT}
                        />
                      </div>
                      {form.attacks.length > 1 && (
                        <button
                          type="button" onClick={() => removeAttack(atk.id)}
                          className="mt-2 p-1.5 text-codex-muted hover:text-red-400 transition-colors"
                          aria-label="Remove attack"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Flavorful Abilities */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>✨</span>
                  <span className={LABEL}>Flavorful Abilities</span>
                  {form.flavorAbilities.length > 0 && (
                    <span className="ml-auto text-[10px] text-emerald-400/70">
                      {form.flavorAbilities.length} selected
                    </span>
                  )}
                </div>
                <div className={`${SECTION_BODY} gap-2`}>
                  <p className="text-[10px] text-codex-muted leading-relaxed">
                    Select keywords that define how this creature fights and behaves.
                    2–3 abilities create a focused, memorable encounter.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FLAVOR_ABILITIES.map(ability => {
                      const active = form.flavorAbilities.includes(ability)
                      return (
                        <button
                          key={ability}
                          type="button"
                          onClick={() => toggleAbility(ability)}
                          disabled={saving}
                          className={[
                            'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border',
                            active
                              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                              : 'bg-codex-bg border-codex-border text-codex-muted hover:border-emerald-400/40 hover:text-codex-text',
                          ].join(' ')}
                        >
                          {ability}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="text-xs font-medium text-codex-text">
                      Custom Ability
                      <span className="ml-1 font-normal text-codex-muted">(optional)</span>
                    </label>
                    <input
                      type="text" value={form.customAbility}
                      onChange={e => set('customAbility', e.target.value)}
                      placeholder="Describe a unique ability not covered above…"
                      maxLength={200} disabled={saving} className={INPUT}
                    />
                  </div>
                </div>
              </div>

              {/* Encounters + Loot */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>🎲</span>
                  <span className={LABEL}>Encounters & Loot</span>
                </div>
                <div className={SECTION_BODY}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-codex-text">Sample Encounters</label>
                    <textarea
                      value={form.sampleEncounters}
                      onChange={e => set('sampleEncounters', e.target.value)}
                      placeholder="Describe where and how this creature is typically found…"
                      rows={3} maxLength={600} disabled={saving}
                      className={`${INPUT} resize-y`}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-codex-text">Loot</label>
                    <textarea
                      value={form.loot}
                      onChange={e => set('loot', e.target.value)}
                      placeholder="What does this creature carry or leave behind?"
                      rows={2} maxLength={400} disabled={saving}
                      className={`${INPUT} resize-y`}
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>🏷️</span>
                  <span className={LABEL}>Tags</span>
                </div>
                <div className={SECTION_BODY}>
                  <input
                    type="text" value={form.tags}
                    onChange={e => set('tags', e.target.value)}
                    placeholder="e.g. Beast, Subterranean, Poisonous (comma-separated)"
                    maxLength={200} disabled={saving} className={INPUT}
                  />
                </div>
              </div>

              {/* Error + Submit */}
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400
                  text-white font-bold text-sm tracking-wide transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : isEdit ? '💾 Save Entry' : '📖 Seal This Entry'}
              </button>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-20">
              {/* Live Preview */}
              <div className="rounded-xl border border-emerald-400/20 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-400/15">
                  <span className={LABEL}>Live Preview</span>
                </div>
                <div className="p-4 bg-codex-surface/40 min-h-[120px]">
                  <EntryPreview form={form} />
                </div>
              </div>

              <Collapsible title="Monster Builder Guide" icon="📐" defaultOpen>
                <LevelGuideTable currentLevel={form.level} armor={form.armor} />
              </Collapsible>

              <Collapsible title="Design Tips" icon="💡">
                <div className="space-y-3 text-[11px] text-codex-subtext leading-relaxed">
                  <p>
                    <span className="font-semibold text-emerald-400">Level sets the baseline.</span>{' '}
                    Keep HP, Save DC, and damage within the guide's range for a balanced encounter.
                    Deviate when the creature has a strong situational weakness or resistance.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">Armor shapes the arc.</span>{' '}
                    Heavy armor means more hits to bring down — offset with lower damage output
                    for a grinding fight, or keep it high for a dangerous bruiser.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">2–3 abilities is the sweet spot.</span>{' '}
                    More than three flavorful keywords can overwhelm a scene. Pick the ones that
                    define the creature's personality and let everything else be implied.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">Named attacks add stakes.</span>{' '}
                    "Venomous Bite" lands harder narratively than "Attack 1". Give each attack an
                    evocative name even if the mechanics are simple.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">Encounters seed the world.</span>{' '}
                    1–2 encounter seeds showing where this creature lives saves real GM prep time at the table.
                  </p>
                </div>
              </Collapsible>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Legendary Monster Form ───────────────────────────────────────────────────

function LegendaryForm({ existing, onBack, onSaved }) {
  const isEdit = Boolean(existing)
  const [form,   setForm]   = useState(() => initLegendaryForm(existing))
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  const set = useCallback(
    (field, value) => setForm(p => ({ ...p, [field]: value })),
    [],
  )

  const guide = useMemo(
    () => lookupGuide(form.level, form.armor),
    [form.level, form.armor],
  )

  // Actions
  const addAction    = () => setForm(p => ({ ...p, actions: [...p.actions, blankAction()] }))
  const removeAction = id => setForm(p => ({ ...p, actions: p.actions.filter(a => a.id !== id) }))
  const setAction    = (id, field, value) =>
    setForm(p => ({ ...p, actions: p.actions.map(a => a.id === id ? { ...a, [field]: value } : a) }))

  // Loot items
  const addLoot    = () => setForm(p => ({ ...p, lootItems: [...p.lootItems, blankLootItem()] }))
  const removeLoot = id => setForm(p => ({ ...p, lootItems: p.lootItems.filter(l => l.id !== id) }))
  const setLoot    = (id, value) =>
    setForm(p => ({ ...p, lootItems: p.lootItems.map(l => l.id === id ? { ...l, text: value } : l) }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Legendary name is required.'); return }
    setSaving(true)
    try {
      const statData = {
        monsterTier:  'legendary',
        epithet:      form.epithet.trim()      || null,
        description:  form.description.trim()  || null,
        level:        form.level               || null,
        hp:           form.hp.trim()     ? Number(form.hp)     : null,
        armor:        form.armor               || null,
        savedc:       form.savedc.trim() ? Number(form.savedc) : null,
        meleeRange:   form.meleeRange.trim()   || null,
        rangedRange:  form.rangedRange.trim()  || null,
        actions:      form.actions
                        .filter(a => a.name.trim())
                        .map(({ id: _id, ...rest }) => ({
                          name:        rest.name.trim(),
                          description: rest.description.trim() || null,
                        })),
        blunder:      form.blunder.trim()      || null,
        lootItems:    form.lootItems.map(l => l.text.trim()).filter(Boolean),
      }
      const payload = {
        name:      form.name.trim(),
        challenge: form.level || null,
        tags:      form.tags.trim() || null,
        statData,
      }
      const res = isEdit
        ? await api.patch(`/bestiary/${existing.id}`, payload)
        : await api.post('/bestiary', { ...payload, gameSystem: 'nimble' })
      onSaved(res.monster)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-codex-bg">
      <NimbleNav
        onBack={onBack}
        crumb={isEdit ? `Editing — ${existing.name}` : 'New Legendary Monster'}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext
            hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Bestiary
        </button>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

            {/* ── LEFT PANEL ── */}
            <div className="flex flex-col gap-5">

              {/* Identity */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>👑</span>
                  <span className={LABEL}>Identity</span>
                </div>
                <div className={SECTION_BODY}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">
                        Legendary Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text" value={form.name}
                        onChange={e => set('name', e.target.value)}
                        placeholder="e.g. The Hollowed Warden"
                        maxLength={100} disabled={saving} autoFocus className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Epithet</label>
                      <input
                        type="text" value={form.epithet}
                        onChange={e => set('epithet', e.target.value)}
                        placeholder="e.g. Devourer of the Deep Halls"
                        maxLength={120} disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-codex-text">Description / Lore</label>
                      <textarea
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="Describe this legendary creature's history, appearance, and role in the world…"
                        rows={3} maxLength={1000} disabled={saving}
                        className={`${INPUT} resize-y`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Combat Statistics */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>📊</span>
                  <span className={LABEL}>Combat Statistics</span>
                </div>
                <div className={SECTION_BODY}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Level</label>
                      <select
                        value={form.level} onChange={e => set('level', e.target.value)}
                        disabled={saving} className={INPUT}
                      >
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Armor</label>
                      <select
                        value={form.armor} onChange={e => set('armor', e.target.value)}
                        disabled={saving} className={INPUT}
                      >
                        {ARMOR_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">
                        Hit Points
                        {guide && (
                          <span className="ml-1 font-normal text-codex-muted">(guide: {guide.hp})</span>
                        )}
                      </label>
                      <input
                        type="number" min="1" value={form.hp}
                        onChange={e => set('hp', e.target.value)}
                        placeholder={guide ? String(guide.hp) : 'HP'}
                        disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">
                        Save DC
                        {guide && (
                          <span className="ml-1 font-normal text-codex-muted">(guide: {guide.dc})</span>
                        )}
                      </label>
                      <input
                        type="number" min="1" value={form.savedc}
                        onChange={e => set('savedc', e.target.value)}
                        placeholder={guide ? String(guide.dc) : 'DC'}
                        disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Melee Range</label>
                      <input
                        type="text" value={form.meleeRange}
                        onChange={e => set('meleeRange', e.target.value)}
                        placeholder="e.g. 5 ft., Reach"
                        maxLength={40} disabled={saving} className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-codex-text">Ranged Range</label>
                      <input
                        type="text" value={form.rangedRange}
                        onChange={e => set('rangedRange', e.target.value)}
                        placeholder="e.g. 60 ft., Line of sight"
                        maxLength={40} disabled={saving} className={INPUT}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>⚡</span>
                  <span className={LABEL}>Actions</span>
                  <button
                    type="button" onClick={addAction}
                    className="ml-auto flex items-center gap-1 text-[10px] font-medium
                      text-emerald-400/70 hover:text-emerald-400 transition-colors"
                  >
                    <Plus size={10} /> Add Action
                  </button>
                </div>
                <div className={SECTION_BODY}>
                  <p className="text-[10px] text-codex-muted leading-relaxed">
                    Each named action defines a key moment in the boss fight.
                    Aim for one damage action, one repositioning or control action,
                    and one dramatic or environmental action.
                  </p>
                  {form.actions.map((action, i) => (
                    <div
                      key={action.id}
                      className="flex items-start gap-2 p-3 rounded-lg
                        border border-codex-border bg-codex-bg/40"
                    >
                      <div className="flex-1 flex flex-col gap-2">
                        <input
                          type="text" value={action.name}
                          onChange={e => setAction(action.id, 'name', e.target.value)}
                          placeholder={`Action ${i + 1} name (e.g. Crushing Slam, Void Screech)`}
                          maxLength={80} disabled={saving} className={INPUT}
                        />
                        <textarea
                          value={action.description}
                          onChange={e => setAction(action.id, 'description', e.target.value)}
                          placeholder="Describe what this action does, its effects, and any Save DC…"
                          rows={2} maxLength={400} disabled={saving}
                          className={`${INPUT} resize-none`}
                        />
                      </div>
                      {form.actions.length > 1 && (
                        <button
                          type="button" onClick={() => removeAction(action.id)}
                          className="mt-2 p-1.5 text-codex-muted hover:text-red-400 transition-colors"
                          aria-label="Remove action"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* BLUNDER — amber warning section */}
              <div className="rounded-xl border border-amber-500/30 overflow-hidden">
                <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20
                  flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    BLUNDER
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Info size={10} className="text-amber-400/50" />
                    <span className="text-[9px] text-amber-400/50">
                      Triggered when the monster rolls a 1
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-amber-500/5">
                  <textarea
                    value={form.blunder}
                    onChange={e => set('blunder', e.target.value)}
                    placeholder="Describe what happens when this legendary creature catastrophically fails — its BLUNDER result. This could expose a weak point, grant the party a window of opportunity, or cause unintended collateral chaos…"
                    rows={3} maxLength={500} disabled={saving}
                    className={[
                      INPUT,
                      'border-amber-500/30 focus:border-amber-400 focus:ring-amber-400/30 resize-y',
                    ].join(' ')}
                  />
                </div>
              </div>

              {/* Loot Items */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>💎</span>
                  <span className={LABEL}>Loot Items</span>
                  <button
                    type="button" onClick={addLoot}
                    className="ml-auto flex items-center gap-1 text-[10px] font-medium
                      text-emerald-400/70 hover:text-emerald-400 transition-colors"
                  >
                    <Plus size={10} /> Add Item
                  </button>
                </div>
                <div className={SECTION_BODY}>
                  {form.lootItems.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text" value={item.text}
                        onChange={e => setLoot(item.id, e.target.value)}
                        placeholder={`Loot item ${i + 1} (e.g. Shattered Crown of Dominion)`}
                        maxLength={120} disabled={saving} className={INPUT}
                      />
                      {form.lootItems.length > 1 && (
                        <button
                          type="button" onClick={() => removeLoot(item.id)}
                          className="p-1.5 text-codex-muted hover:text-red-400 transition-colors"
                          aria-label="Remove loot item"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className={SECTION}>
                <div className={SECTION_HEADER}>
                  <span>🏷️</span>
                  <span className={LABEL}>Tags</span>
                </div>
                <div className={SECTION_BODY}>
                  <input
                    type="text" value={form.tags}
                    onChange={e => set('tags', e.target.value)}
                    placeholder="e.g. Boss, Ancient, Undead (comma-separated)"
                    maxLength={200} disabled={saving} className={INPUT}
                  />
                </div>
              </div>

              {/* Error + Submit */}
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400
                  text-white font-bold text-sm tracking-wide transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : isEdit ? '💾 Save Legend' : '👑 Forge This Legend'}
              </button>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-20">
              {/* Live Preview */}
              <div className="rounded-xl border border-emerald-400/20 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-400/15">
                  <span className={LABEL}>Live Preview</span>
                </div>
                <div className="p-4 bg-codex-surface/40 min-h-[140px]">
                  <LegendaryPreview form={form} />
                </div>
              </div>

              <Collapsible title="Monster Builder Guide" icon="📐" defaultOpen>
                <LevelGuideTable currentLevel={form.level} armor={form.armor} />
              </Collapsible>

              <Collapsible title="Design Tips" icon="💡">
                <div className="space-y-3 text-[11px] text-codex-subtext leading-relaxed">
                  <p>
                    <span className="font-semibold text-emerald-400">Named actions define identity.</span>{' '}
                    Each should feel distinct — one for raw damage, one for control or
                    repositioning, and one with a dramatic or environmental effect.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">Legendary HP runs high.</span>{' '}
                    Bosses need to survive a few rounds to create a dramatic arc.
                    Don't be afraid to go above the table baseline — the guide is a floor, not a ceiling.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">The BLUNDER is a gift to players.</span>{' '}
                    Design it to genuinely shift momentum — a stumble that exposes a weak core,
                    a shattered ward that lets a spell through, not just a missed swing.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">Epithets set the scene.</span>{' '}
                    A great epithet ("The One Who Waits Beneath") tells the party this creature
                    has a history before they arrived. Use it in your read-aloud text.
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-400">Loot should feel earned.</span>{' '}
                    At least one drop with a name and a story attached. Generic "gold" is a missed
                    opportunity after a legendary fight.
                  </p>
                </div>
              </Collapsible>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function NimbleMonsterForm({ existing, onBack, onSaved }) {
  // On edit, detect the existing tier to skip tier selection
  const existingTier = existing?.stat_data?.monsterTier ?? null
  const [tier, setTier] = useState(existingTier)

  if (tier === null) {
    return <TierSelection onSelect={setTier} onBack={onBack} />
  }

  const formProps = { existing, onBack, onSaved }
  if (tier === 'entry')     return <EntryForm     {...formProps} />
  if (tier === 'legendary') return <LegendaryForm {...formProps} />
  return null
}
