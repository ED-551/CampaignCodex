/**
 * ShadowdarkMonsterForm — full-page stat block builder for Shadowdark RPG
 *
 * Two-panel layout:
 *   Left  (~60%): form sections — identity, core stats, attributes, alignment,
 *                 attacks (dynamic), talents (dynamic), tags
 *   Right (~40%): sticky live stat block preview + design tips + random tables
 *
 * Stat block structure stored in JSONB stat_data:
 *   { description, combatRole, level, ac, hp, movement,
 *     stats: {str,dex,con,int,wis,cha}, alignment,
 *     attacks: [{count, weapon, range, bonus, damage, connector}],
 *     talents: [{name, description}] }
 *
 * Goblin used as gray placeholder text throughout.
 * Weapon names intentionally altered from rulebook examples.
 */

import { useState, useMemo } from 'react'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'

// ─── Shared styles ────────────────────────────────────────────────────────────

const INP = `w-full bg-codex-surface border border-codex-border rounded-lg px-3 py-2
  text-codex-text placeholder-codex-muted text-sm
  focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20
  transition-colors disabled:opacity-40`

const TINY = `w-full bg-codex-surface border border-codex-border rounded-lg px-2 py-1.5
  text-codex-text placeholder-codex-muted text-xs text-center
  focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20
  transition-colors disabled:opacity-40`

// ─── Static data ──────────────────────────────────────────────────────────────

const COMBAT_ROLES = [
  { id: 'mook',       label: 'Mook',       hint: 'Fodder. Works in groups. Low everything.' },
  { id: 'soldier',    label: 'Soldier',    hint: 'Backbone. Balanced stats.' },
  { id: 'striker',    label: 'Striker',    hint: 'Glass cannon. High damage, low defense.' },
  { id: 'tank',       label: 'Tank',       hint: 'The wall. High HP and AC.' },
  { id: 'controller', label: 'Controller', hint: 'Disrupts. Debuffs, repositions.' },
  { id: 'legendary',  label: 'Legendary',  hint: 'Boss tier. All stats high.' },
]

const GENERATOR_TABLE = [
  { quality: 'Beastlike',    strength: '+1 attack bonus',       weakness: 'Cold' },
  { quality: 'Avian',        strength: 'Absorbs magic',          weakness: 'Greed' },
  { quality: 'Amphibious',   strength: 'Swarm tactics',          weakness: 'Bright light' },
  { quality: 'Demonic',      strength: 'Extra damage die',       weakness: 'Salt' },
  { quality: 'Arachnid',     strength: 'Poison sting',           weakness: 'Vanity' },
  { quality: 'Ooze-like',    strength: 'Confusing gaze',         weakness: 'Mirrors' },
  { quality: 'Insectoid',    strength: 'Corrodes metal',         weakness: 'Electricity' },
  { quality: 'Draconic',     strength: 'Ranged attacks',         weakness: 'Fragile underbelly' },
  { quality: 'Plantlike',    strength: 'Highly intelligent',     weakness: 'Sunlight' },
  { quality: 'Pachyderm',    strength: 'Crushing grip',          weakness: 'Silver' },
  { quality: 'Undead',       strength: 'Psychic assault',        weakness: 'Fire' },
  { quality: 'Crystalline',  strength: 'Naturally stealthy',     weakness: 'Food or bait' },
  { quality: 'Humanoid',     strength: 'Petrifying stare',       weakness: 'Acid' },
  { quality: 'Angelic',      strength: 'Massive damage die',     weakness: 'Garlic' },
  { quality: 'Spectral',     strength: 'Impersonation',          weakness: 'Cold iron' },
  { quality: 'Stoneborn',    strength: 'Blinding aura',          weakness: 'Water' },
  { quality: 'Serpentine',   strength: 'Turns invisible',        weakness: 'Its true name' },
  { quality: 'Elemental',    strength: 'Multi-die damage',       weakness: 'Loud sounds' },
  { quality: 'Piscine',      strength: 'Swallows prey whole',    weakness: 'Holy water' },
  { quality: 'Reptilian',    strength: '+2 attack actions',      weakness: 'Music' },
]

const MUTATION_TABLE = [
  { m1: 'Shapechanger',        m2: 'Double damage',           m3: 'Speaks Common' },
  { m1: 'Fins and gills',      m2: 'Breathes fire',           m3: 'Knows spells' },
  { m1: 'Thick insulating fur',m2: 'Rapid regeneration',      m3: 'Telepathic' },
  { m1: 'Iron-like scales',    m2: '+1 to all attacks',       m3: 'Toxic spore cloud' },
  { m1: 'Extra limbs',         m2: '+2 to AC',                m3: 'Sonic blasts' },
  { m1: 'Grasping tentacles',  m2: '+2 effective levels',     m3: 'Teleports in bursts' },
  { m1: 'Boneless body',       m2: 'Bigger damage die',       m3: 'Paralytic touch' },
  { m1: 'Gigantic form',       m2: 'Drains life on hit',      m3: 'Genius-level intellect' },
  { m1: 'Hurls spines',        m2: 'Preternaturally fast',    m3: 'Antimagic field' },
  { m1: 'Two heads',           m2: 'Reflects spells',         m3: 'Blood-draining bite' },
  { m1: 'Burrows underground', m2: 'Electrified body',        m3: 'Carrier of plague' },
  { m1: 'Winged',              m2: 'Acidic saliva',           m3: 'Blessed by a dark power' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = Date.now()
const uid = () => ++_uid

function fmt(val) {
  const n = parseInt(val, 10)
  return isNaN(n) ? '—' : n >= 0 ? `+${n}` : String(n)
}

function blankAttack() {
  return { id: uid(), count: '1', weapon: '', range: '', bonus: '0', damage: '', connector: 'or' }
}

function blankTalent() {
  return { id: uid(), name: '', description: '' }
}

function initForm(existing) {
  const sd = existing?.stat_data ?? {}
  return {
    name:        existing?.name        ?? '',
    description: sd.description        ?? '',
    combatRole:  sd.combatRole         ?? '',
    level:       sd.level != null ? String(sd.level) : (existing?.challenge ?? ''),
    ac:          sd.ac    != null ? String(sd.ac)    : '',
    hp:          sd.hp    != null ? String(sd.hp)    : '',
    movement:    sd.movement           ?? '',
    str: sd.stats?.str != null ? String(sd.stats.str) : '',
    dex: sd.stats?.dex != null ? String(sd.stats.dex) : '',
    con: sd.stats?.con != null ? String(sd.stats.con) : '',
    int: sd.stats?.int != null ? String(sd.stats.int) : '',
    wis: sd.stats?.wis != null ? String(sd.stats.wis) : '',
    cha: sd.stats?.cha != null ? String(sd.stats.cha) : '',
    alignment: sd.alignment ?? 'N',
    attacks: sd.attacks?.length
      ? sd.attacks.map((a, i) => ({ ...a, id: uid(), connector: i > 0 ? (a.connector ?? 'or') : 'or' }))
      : [blankAttack()],
    talents: sd.talents?.length
      ? sd.talents.map(t => ({ ...t, id: uid() }))
      : [],
    tags: existing?.tags ?? '',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShadowdarkMonsterForm({ existing, onBack, onSaved }) {
  const isEdit = Boolean(existing)

  const [form,    setForm]    = useState(() => initForm(existing))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [genRoll, setGenRoll] = useState(null)
  const [mutRoll, setMutRoll] = useState(null)

  // ── Form helpers ────────────────────────────────────────────────────────────

  function update(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  function addAttack() {
    setForm(prev => ({ ...prev, attacks: [...prev.attacks, blankAttack()] }))
  }
  function updateAttack(id, field, val) {
    setForm(prev => ({
      ...prev,
      attacks: prev.attacks.map(a => a.id === id ? { ...a, [field]: val } : a),
    }))
  }
  function removeAttack(id) {
    setForm(prev => ({ ...prev, attacks: prev.attacks.filter(a => a.id !== id) }))
  }

  function addTalent() {
    setForm(prev => ({ ...prev, talents: [...prev.talents, blankTalent()] }))
  }
  function updateTalent(id, field, val) {
    setForm(prev => ({
      ...prev,
      talents: prev.talents.map(t => t.id === id ? { ...t, [field]: val } : t),
    }))
  }
  function removeTalent(id) {
    setForm(prev => ({ ...prev, talents: prev.talents.filter(t => t.id !== id) }))
  }

  // ── Live preview ─────────────────────────────────────────────────────────────

  const preview = useMemo(() => {
    const filledAttacks = form.attacks.filter(a => a.weapon.trim())
    const atkStr = filledAttacks.map((a, i) => {
      const rangeStr = a.range.trim() ? ` (${a.range.trim()})` : ''
      const bonusN   = parseInt(a.bonus, 10)
      const bonusStr = isNaN(bonusN) ? '' : bonusN >= 0 ? ` +${bonusN}` : ` ${bonusN}`
      const dmgStr   = a.damage.trim() ? ` (${a.damage.trim()})` : ''
      const atk = `${a.count || 1} ${a.weapon.trim()}${rangeStr}${bonusStr}${dmgStr}`
      return i === 0 ? atk : ` ${a.connector || 'or'} ${atk}`
    }).join('')

    const parts = [
      form.ac       && `AC ${form.ac}`,
      form.hp       && `HP ${form.hp}`,
      atkStr        && `ATK ${atkStr}`,
      form.movement && `MV ${form.movement}`,
      `S ${fmt(form.str)}`,
      `D ${fmt(form.dex)}`,
      `C ${fmt(form.con)}`,
      `I ${fmt(form.int)}`,
      `W ${fmt(form.wis)}`,
      `Ch ${fmt(form.cha)}`,
      form.alignment && `AL ${form.alignment}`,
      form.level     && `LV ${form.level}`,
    ].filter(Boolean)

    return { statLine: parts.join(', '), hasStats: parts.length > 0 }
  }, [form])

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Monster name is required.'); return }

    const payload = {
      name:       form.name.trim(),
      gameSystem: 'shadowdark',
      challenge:  form.level || null,
      tags:       form.tags.trim() || null,
      statData: {
        description: form.description.trim(),
        combatRole:  form.combatRole,
        level:       parseInt(form.level, 10) || 0,
        ac:          parseInt(form.ac,    10) || 0,
        hp:          parseInt(form.hp,    10) || 0,
        movement:    form.movement.trim(),
        stats: {
          str: parseInt(form.str, 10) || 0,
          dex: parseInt(form.dex, 10) || 0,
          con: parseInt(form.con, 10) || 0,
          int: parseInt(form.int, 10) || 0,
          wis: parseInt(form.wis, 10) || 0,
          cha: parseInt(form.cha, 10) || 0,
        },
        alignment: form.alignment,
        attacks: form.attacks
          .map(({ id, ...a }) => ({
            count:     parseInt(a.count, 10) || 1,
            weapon:    a.weapon.trim(),
            range:     a.range.trim(),
            bonus:     parseInt(a.bonus, 10) || 0,
            damage:    a.damage.trim(),
            connector: a.connector || 'or',
          }))
          .filter(a => a.weapon),
        talents: form.talents
          .map(({ id, ...t }) => ({ name: t.name.trim(), description: t.description.trim() }))
          .filter(t => t.name),
      },
    }

    setLoading(true)
    try {
      let monster
      if (isEdit) {
        const res = await api.patch(`/bestiary/${existing.id}`, payload)
        monster = res.monster
      } else {
        const res = await api.post('/bestiary', payload)
        monster = res.monster
      }
      onSaved(monster)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-codex-bg">

      {/* ── Sticky nav bar ── */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            disabled={loading}
            className="flex items-center gap-2 text-codex-subtext hover:text-codex-text
              transition-colors disabled:opacity-40"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back to Bestiary</span>
          </button>
          <span className="text-codex-border">·</span>
          <span className="text-sm font-medium text-amber-500">
            🗡️ {isEdit ? `Editing: ${existing.name}` : 'New Shadowdark Monster'}
          </span>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* ══════════════ LEFT PANEL — FORM ══════════════ */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">

              {/* ── 1. Identity ── */}
              <FormSection title="Identity">
                <div className="flex flex-col gap-4">

                  <Field label="Monster Name" required>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder="e.g. Hollow Knight, Ash Warden, Voidborn Crawler"
                      maxLength={100}
                      disabled={loading}
                      autoFocus
                      className={INP}
                    />
                  </Field>

                  <Field
                    label="Appearance & Behavior"
                    hint="1–2 vivid sentences. What does it look like? What does it want?"
                  >
                    <textarea
                      value={form.description}
                      onChange={e => update('description', e.target.value)}
                      placeholder="e.g. A hunched, green-skinned creature with too many teeth and restless, darting eyes."
                      rows={2}
                      maxLength={500}
                      disabled={loading}
                      className={`${INP} resize-none`}
                    />
                  </Field>

                  <Field label="Combat Role" hint="Pick the archetype that best describes how this creature fights">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COMBAT_ROLES.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => update('combatRole', form.combatRole === r.id ? '' : r.id)}
                          disabled={loading}
                          className={`text-left p-2.5 rounded-lg border text-xs transition-all
                            ${form.combatRole === r.id
                              ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                              : 'border-codex-border text-codex-subtext hover:border-codex-text/40 hover:text-codex-text'
                            } disabled:opacity-40`}
                        >
                          <div className="font-semibold">{r.label}</div>
                          <div className="text-[10px] leading-tight mt-0.5 opacity-70">{r.hint}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </FormSection>

              {/* ── 2. Core Stats ── */}
              <FormSection title="Core Stats">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="LV"  placeholder="1"    value={form.level}    onChange={v => update('level',    v)} disabled={loading} hint="Level" />
                  <StatBox label="AC"  placeholder="11"   value={form.ac}       onChange={v => update('ac',       v)} disabled={loading} hint="Armor class" />
                  <StatBox label="HP"  placeholder="5"    value={form.hp}       onChange={v => update('hp',       v)} disabled={loading} hint="Hit points" />
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-[10px] text-codex-muted uppercase tracking-widest">MV</label>
                    <input
                      type="text"
                      value={form.movement}
                      onChange={e => update('movement', e.target.value)}
                      placeholder="near"
                      disabled={loading}
                      className={TINY}
                    />
                    <span className="text-[9px] text-codex-muted">Movement</span>
                  </div>
                </div>
                <p className="text-[10px] text-codex-muted mt-2 leading-relaxed">
                  Movement values: <span className="text-codex-subtext">near · far · close · near (fly) · near (swim) · near (burrow) · double near</span>
                </p>
              </FormSection>

              {/* ── 3. Attribute Modifiers ── */}
              <FormSection title="Attribute Modifiers">
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { key: 'str', label: 'S',  full: 'STR', ph: '0'  },
                    { key: 'dex', label: 'D',  full: 'DEX', ph: '+1' },
                    { key: 'con', label: 'C',  full: 'CON', ph: '+1' },
                    { key: 'int', label: 'I',  full: 'INT', ph: '-1' },
                    { key: 'wis', label: 'W',  full: 'WIS', ph: '-1' },
                    { key: 'cha', label: 'Ch', full: 'CHA', ph: '-2' },
                  ].map(({ key, label, full, ph }) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-codex-muted uppercase tracking-widest">{label}</span>
                      <input
                        type="text"
                        value={form[key]}
                        onChange={e => update(key, e.target.value)}
                        placeholder={ph}
                        disabled={loading}
                        className={TINY}
                      />
                      <span className="text-[9px] text-codex-muted">{full}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-codex-muted mt-2">
                  Enter signed modifiers: <span className="text-codex-subtext">+1 · 0 · -2</span>.
                  Typical range is −5 to +5, though high-level monsters can go higher.
                  Compare with well-known creatures when calibrating.
                </p>
              </FormSection>

              {/* ── 4. Alignment ── */}
              <FormSection title="Alignment">
                <div className="flex gap-3">
                  {[
                    { val: 'L', label: 'Lawful',  abbr: 'L', hint: 'Code, order, hierarchy' },
                    { val: 'N', label: 'Neutral',  abbr: 'N', hint: 'Instinct, nature, survival' },
                    { val: 'C', label: 'Chaotic',  abbr: 'C', hint: 'Appetite, impulse, destruction' },
                  ].map(({ val, abbr, label, hint }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => update('alignment', val)}
                      disabled={loading}
                      className={`flex-1 py-3 px-3 rounded-lg border text-xs transition-all
                        ${form.alignment === val
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                          : 'border-codex-border text-codex-subtext hover:border-codex-text/40 hover:text-codex-text'
                        } disabled:opacity-40`}
                    >
                      <div className="font-bold text-base">{abbr}</div>
                      <div className="font-semibold text-[11px] mt-0.5">{label}</div>
                      <div className="text-[9px] mt-0.5 opacity-70 leading-tight">{hint}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-codex-muted mt-2">
                  Individual monsters may differ from the typical alignment of their species.
                </p>
              </FormSection>

              {/* ── 5. Attacks ── */}
              <FormSection title="Attacks">
                <div className="flex flex-col gap-3">
                  {form.attacks.map((atk, idx) => (
                    <div key={atk.id} className="flex flex-col gap-2">

                      {/* Connector row (between attacks) */}
                      {idx > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 border-t border-codex-border/40" />
                          <select
                            value={atk.connector}
                            onChange={e => updateAttack(atk.id, 'connector', e.target.value)}
                            disabled={loading}
                            className="text-[10px] bg-codex-surface border border-codex-border
                              rounded px-2 py-1 text-codex-muted
                              focus:outline-none focus:border-amber-500/60"
                          >
                            <option value="or">or</option>
                            <option value="and">and</option>
                          </select>
                          <div className="flex-1 border-t border-codex-border/40" />
                        </div>
                      )}

                      {/* Attack row */}
                      <div className="bg-codex-surface/50 border border-codex-border/70 rounded-xl p-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-2">
                            <label className="block text-[10px] text-codex-muted mb-1">#</label>
                            <input type="text" value={atk.count}
                              onChange={e => updateAttack(atk.id, 'count', e.target.value)}
                              placeholder="1" disabled={loading} className={TINY} />
                          </div>
                          <div className="col-span-4">
                            <label className="block text-[10px] text-codex-muted mb-1">Weapon / Attack</label>
                            <input type="text" value={atk.weapon}
                              onChange={e => updateAttack(atk.id, 'weapon', e.target.value)}
                              placeholder="rusty knife" disabled={loading}
                              className={`${TINY} text-left`} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-codex-muted mb-1">Range</label>
                            <input type="text" value={atk.range}
                              onChange={e => updateAttack(atk.id, 'range', e.target.value)}
                              placeholder="far" disabled={loading} className={TINY} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-codex-muted mb-1">Bonus</label>
                            <input type="text" value={atk.bonus}
                              onChange={e => updateAttack(atk.id, 'bonus', e.target.value)}
                              placeholder="+0" disabled={loading} className={TINY} />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[10px] text-codex-muted mb-1">Dmg</label>
                            <input type="text" value={atk.damage}
                              onChange={e => updateAttack(atk.id, 'damage', e.target.value)}
                              placeholder="1d4" disabled={loading} className={TINY} />
                          </div>
                          <div className="col-span-1 flex justify-end pb-0.5">
                            {form.attacks.length > 1 && (
                              <button type="button" onClick={() => removeAttack(atk.id)}
                                disabled={loading}
                                className="p-1.5 text-codex-muted hover:text-red-400
                                  transition-colors disabled:opacity-40">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[9px] text-codex-muted mt-2 leading-relaxed">
                          Range only for ranged/special attacks (far, close/near, near, etc.).
                          Damage uses standard dice notation: 1d6, 2d8+1, etc.
                        </p>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addAttack}
                    disabled={loading || form.attacks.length >= 6}
                    className="flex items-center justify-center gap-1.5 py-2.5 text-xs
                      text-codex-muted hover:text-amber-400 transition-colors rounded-lg
                      border border-dashed border-codex-border/60 hover:border-amber-500/40
                      disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} /> Add Attack
                  </button>
                </div>
              </FormSection>

              {/* ── 6. Special Talents ── */}
              <FormSection title="Special Talents">
                <p className="text-[10px] text-codex-muted mb-3 leading-relaxed">
                  1–3 abilities that make this creature memorable beyond raw numbers.
                  Name each talent, then describe what it does mechanically.
                </p>
                <div className="flex flex-col gap-3">
                  {form.talents.map(t => (
                    <div key={t.id}
                      className="bg-codex-surface/50 border border-codex-border/70 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={t.name}
                          onChange={e => updateTalent(t.id, 'name', e.target.value)}
                          placeholder="Keen Senses"
                          disabled={loading}
                          className={`${INP} font-semibold`}
                        />
                        <button type="button" onClick={() => removeTalent(t.id)}
                          disabled={loading}
                          className="shrink-0 p-2 text-codex-muted hover:text-red-400
                            transition-colors disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <textarea
                        value={t.description}
                        onChange={e => updateTalent(t.id, 'description', e.target.value)}
                        placeholder="Cannot be caught off-guard. Always acts in the first round of combat."
                        rows={2}
                        disabled={loading}
                        className={`${INP} resize-none text-xs`}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addTalent}
                    disabled={loading || form.talents.length >= 5}
                    className="flex items-center justify-center gap-1.5 py-2.5 text-xs
                      text-codex-muted hover:text-amber-400 transition-colors rounded-lg
                      border border-dashed border-codex-border/60 hover:border-amber-500/40
                      disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} /> Add Talent
                  </button>
                </div>
              </FormSection>

              {/* ── 7. Tags ── */}
              <FormSection title="Type Tags">
                <Field label="Tags" hint="Comma-separated creature types for filtering">
                  <input
                    type="text"
                    value={form.tags}
                    onChange={e => update('tags', e.target.value)}
                    placeholder="e.g. Humanoid, Goblinoid, Undead, Beast, Construct, Elemental"
                    maxLength={200}
                    disabled={loading}
                    className={INP}
                  />
                </Field>
              </FormSection>

              {/* ── Submit ── */}
              {error && (
                <div className="px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pb-8">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border border-codex-border text-codex-subtext text-sm
                    hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-codex-gold hover:bg-codex-goldHover
                    text-codex-bg font-semibold text-sm transition-all
                    disabled:opacity-30 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin" />
                    : isEdit ? 'Save Changes' : 'Create Monster'
                  }
                </button>
              </div>
            </div>

            {/* ══════════════ RIGHT PANEL — PREVIEW + TOOLS ══════════════ */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 lg:sticky lg:top-20 order-first lg:order-last">

              {/* ── Live Stat Block Preview ── */}
              <div className="bg-codex-card border border-amber-500/20 rounded-xl overflow-hidden">
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
                    Live Preview
                  </span>
                </div>
                <div className="p-4">
                  {/* Name banner */}
                  <div className="bg-codex-surface border border-codex-border/60 rounded-lg px-3 py-2 mb-3 text-center">
                    <span className="text-sm font-bold text-codex-text uppercase tracking-wide">
                      {form.name || <span className="font-normal text-codex-muted italic normal-case tracking-normal">Monster Name</span>}
                    </span>
                  </div>

                  {/* Description */}
                  {form.description
                    ? <p className="text-xs text-codex-subtext italic leading-relaxed mb-3">{form.description}</p>
                    : <p className="text-xs text-codex-muted italic mb-3">Appearance and behavior…</p>
                  }

                  {/* Stat line */}
                  <div className="text-xs leading-relaxed">
                    {preview.hasStats
                      ? <BoldStatLine text={preview.statLine} />
                      : <span className="text-codex-muted italic text-[11px]">Fill in stats above to see the stat block…</span>
                    }
                  </div>

                  {/* Talents */}
                  {form.talents.filter(t => t.name.trim()).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-codex-border/40 flex flex-col gap-2">
                      {form.talents.filter(t => t.name.trim()).map(t => (
                        <div key={t.id} className="text-xs leading-relaxed">
                          <span className="font-bold text-codex-text">{t.name}.</span>{' '}
                          <span className="text-codex-subtext">{t.description || '…'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Design Tips ── */}
              <Collapsible title="Design Tips">
                <div className="flex flex-col gap-3 text-[11px] text-codex-subtext leading-relaxed">
                  <TipBlock title="Level Tiers">
                    <p><span className="text-amber-400 font-semibold">LV 1–3</span> — Entry threats. Low defense, simple attacks. Great for new parties.</p>
                    <p><span className="text-amber-400 font-semibold">LV 4–6</span> — Seasoned threats. Balanced stats with some tactical depth.</p>
                    <p><span className="text-amber-400 font-semibold">LV 7–9</span> — Dangerous and rare. Experienced adventurers only.</p>
                    <p><span className="text-amber-400 font-semibold">LV 10+</span> — Apex predators. Campaign-defining boss encounters.</p>
                  </TipBlock>
                  <TipBlock title="HP Formula">
                    <p>Roll one d8 per LV and add the CON modifier to each (min 1 HP per die). Quick flat value: <span className="text-codex-text">LV × 4–5</span> for mooks, <span className="text-codex-text">LV × 7–8</span> for tanks.</p>
                  </TipBlock>
                  <TipBlock title="Damage by Tier">
                    <p><span className="text-codex-text font-medium">LV 1–3:</span> d4–d6 per hit, 1–2 attacks</p>
                    <p><span className="text-codex-text font-medium">LV 4–6:</span> d6–d8 per hit, 2–3 attacks</p>
                    <p><span className="text-codex-text font-medium">LV 7–9:</span> d8–d10 per hit, 3–4 attacks</p>
                    <p><span className="text-codex-text font-medium">LV 10+:</span> d12 or multi-die, 4–5 attacks</p>
                  </TipBlock>
                  <TipBlock title="Attack Bonus">
                    <p>Base it on the relevant stat modifier — STR for melee, DEX for finesse or ranged. The total rarely needs to exceed the monster's LV.</p>
                  </TipBlock>
                  <TipBlock title="Darkness & Senses">
                    <p>Non-humanoid monsters can perceive in total darkness, ignoring the penalties that punish torch-dependent adventurers.</p>
                  </TipBlock>
                  <TipBlock title="Encounter Balance">
                    <p>For a 1:1 average-difficulty fight (one monster per character):</p>
                    <p className="font-mono text-[10px] text-codex-text bg-codex-surface rounded px-2 py-1 mt-1">
                      Party LV 1–3 → Monster LV 1<br />
                      Party LV 4–6 → Monster LV 3<br />
                      Party LV 7–9 → Monster LV 5<br />
                      Party LV 10  → Monster LV 7
                    </p>
                    <p className="mt-1">Groups of lower-level monsters can still be lethal — they act every round too.</p>
                  </TipBlock>
                </div>
              </Collapsible>

              {/* ── Random Inspiration ── */}
              <Collapsible title="Random Inspiration">
                <div className="flex flex-col gap-4">

                  {/* Monster Generator */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-widest">
                        Monster Generator (d20)
                      </span>
                      <button
                        type="button"
                        onClick={() => setGenRoll(GENERATOR_TABLE[Math.floor(Math.random() * 20)])}
                        className="flex items-center gap-1 text-[10px] text-codex-muted
                          hover:text-amber-400 transition-colors"
                      >
                        <RefreshCw size={10} /> Roll
                      </button>
                    </div>
                    {genRoll ? (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-[11px] space-y-1">
                        <div><span className="text-codex-muted">Quality: </span><span className="font-medium text-codex-text">{genRoll.quality}</span></div>
                        <div><span className="text-codex-muted">Strength: </span><span className="font-medium text-codex-text">{genRoll.strength}</span></div>
                        <div><span className="text-codex-muted">Weakness: </span><span className="font-medium text-codex-text">{genRoll.weakness}</span></div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-codex-muted italic leading-relaxed">
                        Roll for a random creature archetype, signature strength, and exploitable weakness to spark your design.
                      </p>
                    )}
                  </div>

                  {/* Mutations */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-widest">
                        Mutations (d12)
                      </span>
                      <button
                        type="button"
                        onClick={() => setMutRoll(MUTATION_TABLE[Math.floor(Math.random() * 12)])}
                        className="flex items-center gap-1 text-[10px] text-codex-muted
                          hover:text-amber-400 transition-colors"
                      >
                        <RefreshCw size={10} /> Roll
                      </button>
                    </div>
                    {mutRoll ? (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-[11px] space-y-1">
                        <div><span className="text-codex-muted">Form: </span><span className="font-medium text-codex-text">{mutRoll.m1}</span></div>
                        <div><span className="text-codex-muted">Power: </span><span className="font-medium text-codex-text">{mutRoll.m2}</span></div>
                        <div><span className="text-codex-muted">Quirk: </span><span className="font-medium text-codex-text">{mutRoll.m3}</span></div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-codex-muted italic leading-relaxed">
                        Add up to 3 mutations per creature. A mutated monster is treated as 2 levels higher when determining treasure.
                      </p>
                    )}
                  </div>
                </div>
              </Collapsible>

            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({ title, children }) {
  return (
    <div className="bg-codex-card border border-codex-border rounded-xl overflow-hidden">
      <div className="border-b border-codex-border/60 px-4 py-2.5 bg-codex-surface/40">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-codex-text">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-[10px] font-normal text-codex-muted">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function StatBox({ label, placeholder, value, onChange, disabled, hint }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-[10px] text-codex-muted uppercase tracking-widest">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={TINY}
      />
      {hint && <span className="text-[9px] text-codex-muted text-center">{hint}</span>}
    </div>
  )
}

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-codex-card border border-codex-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3
          hover:bg-codex-surface/30 transition-colors"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">
          {title}
        </span>
        {open ? <ChevronUp size={14} className="text-codex-muted" /> : <ChevronDown size={14} className="text-codex-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function TipBlock({ title, children }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold text-codex-text uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

// Renders the stat line with bold labels (AC, HP, ATK, etc.)
// Use a Set for O(1) lookup — avoids the stateful lastIndex problem with global regex.
const BOLD_LABEL_RE  = /\b(AC|HP|ATK|MV|AL|LV|Ch)\b/g
const BOLD_LABEL_SET = new Set(['AC', 'HP', 'ATK', 'MV', 'AL', 'LV', 'Ch'])

function BoldStatLine({ text }) {
  const parts = text.split(BOLD_LABEL_RE)
  return (
    <span>
      {parts.map((part, i) =>
        BOLD_LABEL_SET.has(part)
          ? <strong key={i} className="text-codex-text font-bold">{part}</strong>
          : <span key={i} className="text-codex-subtext">{part}</span>
      )}
    </span>
  )
}
