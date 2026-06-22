/**
 * MorkborgMonsterForm — full-page stat block builder for Mörk Borg
 *
 * Mörk Borg monster anatomy (from analyzed examples):
 *   NAME            — large uppercase, often distressed
 *   Creature type   — subtype label (Goblin, Wyvern, Grotesque, etc.)
 *   HP [X]  Morale [X | — | special]
 *   [Armor name] [protection die, e.g. -d2, -d4]
 *   [Attack name] [damage die]   (one or more; NO attack bonus)
 *   Special [freeform text]
 *   [Description / lore]
 *   [Optional random tables — Traits, Values, Speciality, Wields, etc.]
 *   [Optional bounty rewards — dead Xs / captured Xs]
 *
 * Key differences from Shadowdark:
 *   • No level, no AC, no attribute scores, no alignment
 *   • Armor is a damage reduction die on incoming hits (players roll to dodge)
 *   • Attack entries have no to-hit bonus — only name + damage die
 *   • Morale is a 2d6 target, can be "—" (never flees) or "special"
 *
 * Visual theme: near-black background · yellow-300 accent · monospace body
 * Intentionally stark — the apocalypse is here.
 *
 * stat_data JSONB structure:
 *   { creatureType, hp, morale, armor,
 *     attacks: [{name, damage}],
 *     special, description,
 *     tables: [{label, die, entries}],
 *     rewards: {dead, captured} }
 *
 * challenge column = HP (for card display; SYSTEM_META prefixes "HP")
 */

import { useState, useMemo } from 'react'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../utils/api'

// ─── Palette constants ────────────────────────────────────────────────────────

const CARD   = 'bg-[#111118] border border-yellow-300/15 rounded-xl overflow-hidden'
const HDR    = 'border-b border-yellow-300/15 bg-yellow-300/5 px-4 py-2.5'
const BODY   = 'p-4'

const INP = `w-full bg-black/60 border border-yellow-300/30 rounded-lg px-3 py-2
  text-white placeholder-yellow-300/25 text-sm
  focus:outline-none focus:border-yellow-300/60 focus:ring-1 focus:ring-yellow-300/15
  transition-colors disabled:opacity-40`

const TINY = `w-full bg-black/60 border border-yellow-300/30 rounded-lg px-2 py-1.5
  text-white placeholder-yellow-300/25 text-xs text-center
  focus:outline-none focus:border-yellow-300/60
  transition-colors disabled:opacity-40`

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = Date.now()
const uid = () => ++_uid

function blankAttack()  { return { id: uid(), name: '', damage: '' } }
function blankReward()  { return { id: uid(), label: '', amount: '' } }

function blankTable(die = 'd4') {
  const count = parseInt(die.replace('d', ''), 10)
  return { id: uid(), label: '', die, entries: Array(count).fill('') }
}

function initForm(existing) {
  const sd = existing?.stat_data ?? {}
  return {
    name:         existing?.name    ?? '',
    creatureType: sd.creatureType   ?? '',
    hp:           sd.hp != null ? String(sd.hp) : '',
    morale:       sd.morale         ?? '',
    armor:        sd.armor          ?? '',
    attacks: sd.attacks?.length
      ? sd.attacks.map(a => ({ ...a, id: uid() }))
      : [blankAttack()],
    special:     sd.special     ?? '',
    description: sd.description ?? '',
    tables: sd.tables?.length
      ? sd.tables.map(t => ({
          id:      uid(),
          label:   t.label   ?? '',
          die:     t.die     ?? 'd4',
          entries: Array.isArray(t.entries) ? t.entries : [],
        }))
      : [],
    rewards: (() => {
      if (!sd.rewards) return []
      if (Array.isArray(sd.rewards)) return sd.rewards.map(r => ({ ...r, id: uid() }))
      // Legacy {dead, captured} format — migrate gracefully
      const out = []
      if (sd.rewards.dead)     out.push({ id: uid(), label: 'Dead',     amount: sd.rewards.dead })
      if (sd.rewards.captured) out.push({ id: uid(), label: 'Captured', amount: sd.rewards.captured })
      return out
    })(),
    tags:           existing?.tags       ?? '',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MorkborgMonsterForm({ existing, onBack, onSaved }) {
  const isEdit = Boolean(existing)

  const [form,    setForm]    = useState(() => initForm(existing))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // ── Updaters ─────────────────────────────────────────────────────────────────

  function update(field, val) { setForm(p => ({ ...p, [field]: val })) }

  function addAttack() {
    setForm(p => ({ ...p, attacks: [...p.attacks, blankAttack()] }))
  }
  function updateAttack(id, field, val) {
    setForm(p => ({ ...p, attacks: p.attacks.map(a => a.id === id ? { ...a, [field]: val } : a) }))
  }
  function removeAttack(id) {
    setForm(p => ({ ...p, attacks: p.attacks.filter(a => a.id !== id) }))
  }

  function addTable() {
    if (form.tables.length >= 4) return
    setForm(p => ({ ...p, tables: [...p.tables, blankTable()] }))
  }
  function updateTable(id, field, val) {
    setForm(p => ({ ...p, tables: p.tables.map(t => t.id === id ? { ...t, [field]: val } : t) }))
  }
  function changeDie(id, die) {
    const count = parseInt(die.replace('d', ''), 10)
    setForm(p => ({
      ...p,
      tables: p.tables.map(t => {
        if (t.id !== id) return t
        const entries = [...t.entries]
        while (entries.length < count) entries.push('')
        return { ...t, die, entries: entries.slice(0, count) }
      }),
    }))
  }
  function updateTableEntry(tableId, idx, val) {
    setForm(p => ({
      ...p,
      tables: p.tables.map(t => {
        if (t.id !== tableId) return t
        const entries = [...t.entries]
        entries[idx] = val
        return { ...t, entries }
      }),
    }))
  }
  function removeTable(id) {
    setForm(p => ({ ...p, tables: p.tables.filter(t => t.id !== id) }))
  }

  function addReward() {
    setForm(p => ({ ...p, rewards: [...p.rewards, blankReward()] }))
  }
  function updateReward(id, field, val) {
    setForm(p => ({ ...p, rewards: p.rewards.map(r => r.id === id ? { ...r, [field]: val } : r) }))
  }
  function removeReward(id) {
    setForm(p => ({ ...p, rewards: p.rewards.filter(r => r.id !== id) }))
  }

  // ── Live preview ─────────────────────────────────────────────────────────────

  const filledAttacks = useMemo(
    () => form.attacks.filter(a => a.name.trim()),
    [form.attacks]
  )

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Creature name is required.'); return }

    const payload = {
      name:       form.name.trim(),
      gameSystem: 'morkborg',
      challenge:  form.hp || null,       // HP stored as challenge for card list display
      tags:       form.tags.trim() || null,
      statData: {
        creatureType: form.creatureType.trim(),
        hp:           parseInt(form.hp, 10) || 0,
        morale:       form.morale.trim(),
        armor:        form.armor.trim(),
        attacks: form.attacks
          .map(({ id, ...a }) => ({ name: a.name.trim(), damage: a.damage.trim() }))
          .filter(a => a.name),
        special:     form.special.trim(),
        description: form.description.trim(),
        tables: form.tables
          .map(({ id, ...t }) => ({
            label:   t.label.trim(),
            die:     t.die,
            entries: t.entries.map(e => e.trim()).filter(Boolean),
          }))
          .filter(t => t.label),
        rewards: form.rewards
          .map(({ id, ...r }) => ({ label: r.label.trim(), amount: r.amount.trim() }))
          .filter(r => r.label || r.amount),
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0c0c0e]">

      {/* ── Nav ── */}
      <header className="border-b border-yellow-300/20 bg-[#111118]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={onBack} disabled={loading}
            className="flex items-center gap-2 text-yellow-300/50 hover:text-yellow-300
              transition-colors disabled:opacity-40">
            <ArrowLeft size={16} />
            <span className="text-sm">Back to Bestiary</span>
          </button>
          <span className="text-yellow-300/20">·</span>
          <span className="text-sm font-black text-yellow-300 tracking-wide">
            💀 {isEdit ? `Editing: ${existing.name}` : 'New Mörk Borg Creature'}
          </span>
          {existing?.shared_from_username && (
            <span className="text-xs text-yellow-300/40 italic ml-2">
              — shared by <span className="text-yellow-300/70 font-medium">{existing.shared_from_username}</span>
            </span>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* ══════════════ LEFT PANEL ══════════════ */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">

              {/* 1. Identity */}
              <Sect title="Identity">
                <div className="flex flex-col gap-4">
                  <Fld label="Creature Name" required>
                    <input type="text" value={form.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder="e.g. SETH, LADY PORCELAIN, Hollow Deacon"
                      maxLength={100} disabled={loading} autoFocus className={INP} />
                  </Fld>
                  <Fld label="Type / Subtype" hint="What category of abomination is this?">
                    <input type="text" value={form.creatureType}
                      onChange={e => update('creatureType', e.target.value)}
                      placeholder="e.g. Goblin, Wyvern, Grotesque, Undead doll, Berserker"
                      maxLength={80} disabled={loading} className={INP} />
                  </Fld>
                </div>
              </Sect>

              {/* 2. Core Stats */}
              <Sect title="Core Stats">
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="HP">
                    <input type="text" value={form.hp}
                      onChange={e => update('hp', e.target.value)}
                      placeholder="6" disabled={loading} className={INP} />
                  </Fld>
                  <Fld label="Morale" hint="Number · — · special">
                    <input type="text" value={form.morale}
                      onChange={e => update('morale', e.target.value)}
                      placeholder="7" disabled={loading} className={INP} />
                    <div className="flex gap-2 mt-1.5">
                      {['—', 'special'].map(v => (
                        <button key={v} type="button"
                          onClick={() => update('morale', v)}
                          disabled={loading}
                          className="text-[10px] px-2 py-0.5 rounded border border-yellow-300/25
                            text-yellow-300/50 hover:text-yellow-300 hover:border-yellow-300/50
                            transition-colors disabled:opacity-30">
                          {v}
                        </button>
                      ))}
                      <span className="text-[10px] text-yellow-300/25 self-center ml-1">quick-fill</span>
                    </div>
                  </Fld>
                </div>
                <p className="text-[10px] text-yellow-300/30 mt-3 leading-relaxed">
                  Morale is tested with 2d6 when the situation turns against the creature.
                  Roll above the morale number to hold. "—" means it never retreats. "special" means the morale rule is in the text.
                </p>
              </Sect>

              {/* 3. Armor */}
              <Sect title="Armor">
                <Fld label="Name and Protection Die" hint="Reduces incoming damage by rolling the die">
                  <input type="text" value={form.armor}
                    onChange={e => update('armor', e.target.value)}
                    placeholder="e.g. Ropy skin -d2, Leather -d2, Thick hide -d4, No armor"
                    maxLength={80} disabled={loading} className={INP} />
                </Fld>
                {/* Quick-fill suggestions */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {['No armor', 'unarmed d2', 'Leather -d2', 'Hide -d4', 'Chainmail -d4', 'Plate -d6'].map(v => (
                    <button key={v} type="button" onClick={() => update('armor', v)}
                      disabled={loading}
                      className="text-[10px] px-2.5 py-1 rounded border border-yellow-300/20
                        text-yellow-300/45 hover:text-yellow-300 hover:border-yellow-300/50
                        transition-colors disabled:opacity-30">
                      {v}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-yellow-300/30 mt-2">
                  Die sizes: -d2 (minimal) · -d4 (light) · -d6 (moderate) · -d8 (heavy) · -d10/-d12 (exceptional or supernatural)
                </p>
              </Sect>

              {/* 4. Attacks */}
              <Sect title="Attacks">
                <p className="text-[10px] text-yellow-300/35 mb-3 leading-relaxed">
                  Name the attack, set the damage die. No to-hit roll — it connects unless the player dodges.
                  Multiple entries are listed as separate lines.
                </p>
                <div className="flex flex-col gap-2">
                  {form.attacks.map(atk => (
                    <div key={atk.id} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] text-yellow-300/45 mb-1">Attack / Weapon</label>
                        <input type="text" value={atk.name}
                          onChange={e => updateAttack(atk.id, 'name', e.target.value)}
                          placeholder="Knife/shortbow, Claws, Bite/Sting, Fist"
                          disabled={loading}
                          className={`${INP} text-left`} />
                      </div>
                      <div className="w-24 shrink-0">
                        <label className="block text-[10px] text-yellow-300/45 mb-1">Damage</label>
                        <input type="text" value={atk.damage}
                          onChange={e => updateAttack(atk.id, 'damage', e.target.value)}
                          placeholder="d4" disabled={loading} className={TINY} />
                      </div>
                      {form.attacks.length > 1 && (
                        <button type="button" onClick={() => removeAttack(atk.id)}
                          disabled={loading}
                          className="pb-2 text-yellow-300/25 hover:text-red-500
                            transition-colors disabled:opacity-30">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addAttack}
                    disabled={loading || form.attacks.length >= 6}
                    className="mt-1 flex items-center justify-center gap-1.5 py-2.5 text-xs
                      text-yellow-300/35 hover:text-yellow-300/80 transition-colors rounded-lg
                      border border-dashed border-yellow-300/20 hover:border-yellow-300/40
                      disabled:opacity-30 disabled:cursor-not-allowed">
                    <Plus size={12} /> Add Attack
                  </button>
                </div>
              </Sect>

              {/* 5. Special */}
              <Sect title="Special">
                <Fld label="Special Ability" hint="The weird, dangerous, or defining mechanic">
                  <textarea value={form.special}
                    onChange={e => update('special', e.target.value)}
                    placeholder="e.g. Quick — attacks and defence against this creature are DR14. 25% chance wounds become infected."
                    rows={3} disabled={loading}
                    className={`${INP} resize-none font-mono text-xs leading-relaxed`} />
                </Fld>
                <p className="text-[10px] text-yellow-300/30 mt-2">
                  DR ratings: DR10 routine · DR12 standard · DR14 hard · DR16 brutal · DR18 nearly impossible.
                  Players always roll the test — monsters never do.
                </p>
              </Sect>

              {/* 6. Description */}
              <Sect title="Description">
                <Fld label="Lore and Behavior" hint="What is this thing, and what does it do?">
                  <textarea value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder="e.g. Once like you, now trapped in cursed flesh. Their eyes betray a ruined mind watching its body perform terrible deeds."
                    rows={4} disabled={loading}
                    className={`${INP} resize-none text-xs leading-relaxed`} />
                </Fld>
              </Sect>

              {/* 7. Random Tables */}
              <Sect title="Random Tables (Optional)">
                <p className="text-[10px] text-yellow-300/35 mb-3 leading-relaxed">
                  Add d4/d6/d8 tables for Traits, Values, Specialities, or random weapon choices.
                  Up to 4 tables per creature.
                </p>
                <div className="flex flex-col gap-4">
                  {form.tables.map(table => (
                    <TableEditor
                      key={table.id}
                      table={table}
                      loading={loading}
                      onLabel={v => updateTable(table.id, 'label', v)}
                      onDie={die => changeDie(table.id, die)}
                      onEntry={(idx, v) => updateTableEntry(table.id, idx, v)}
                      onRemove={() => removeTable(table.id)}
                    />
                  ))}
                  {form.tables.length < 4 && (
                    <button type="button" onClick={addTable} disabled={loading}
                      className="flex items-center justify-center gap-1.5 py-2.5 text-xs
                        text-yellow-300/35 hover:text-yellow-300/80 transition-colors rounded-lg
                        border border-dashed border-yellow-300/20 hover:border-yellow-300/40
                        disabled:opacity-30 disabled:cursor-not-allowed">
                      <Plus size={12} /> Add Table
                    </button>
                  )}
                </div>
              </Sect>

              {/* 8. Bounty */}
              <Sect title="Bounties & Harvest (Optional)">
                <p className="text-[10px] text-yellow-300/35 mb-3 leading-relaxed">
                  What is this creature worth? Add as many lines as needed — Mörk Borg bounties are
                  creative: Skull, Ectoplasm, Blood per litre, Remains, Horn, Corpse…
                </p>
                <div className="flex flex-col gap-2">
                  {form.rewards.map(r => (
                    <div key={r.id} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] text-yellow-300/45 mb-1">Label</label>
                        <input type="text" value={r.label}
                          onChange={e => updateReward(r.id, 'label', e.target.value)}
                          placeholder="Dead, Captured, Skull, Ectoplasm…"
                          maxLength={50} disabled={loading} className={`${INP} text-left`} />
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="block text-[10px] text-yellow-300/45 mb-1">Amount</label>
                        <input type="text" value={r.amount}
                          onChange={e => updateReward(r.id, 'amount', e.target.value)}
                          placeholder="20s" maxLength={30} disabled={loading} className={TINY} />
                      </div>
                      <button type="button" onClick={() => removeReward(r.id)}
                        disabled={loading}
                        className="pb-2 text-yellow-300/25 hover:text-red-500
                          transition-colors disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {/* Quick-add common Mörk Borg bounty labels */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['Dead','Captured','Head','Skull','Destroyed','Remains','Ectoplasm','Blood per litre','Horn','Corpse'].map(label => (
                      <button key={label} type="button"
                        onClick={() => setForm(p => ({ ...p, rewards: [...p.rewards, { id: uid(), label, amount: '' }] }))}
                        disabled={loading}
                        className="text-[10px] px-2 py-0.5 rounded border border-yellow-300/20
                          text-yellow-300/40 hover:text-yellow-300 hover:border-yellow-300/50
                          transition-colors disabled:opacity-30">
                        + {label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={addReward} disabled={loading}
                    className="mt-1 flex items-center justify-center gap-1.5 py-2.5 text-xs
                      text-yellow-300/35 hover:text-yellow-300/80 transition-colors rounded-lg
                      border border-dashed border-yellow-300/20 hover:border-yellow-300/40
                      disabled:opacity-30 disabled:cursor-not-allowed">
                    <Plus size={12} /> Add Bounty Line
                  </button>
                </div>
              </Sect>

              {/* 9. Tags */}
              <Sect title="Type Tags">
                <Fld label="Tags" hint="Comma-separated, for filtering">
                  <input type="text" value={form.tags}
                    onChange={e => update('tags', e.target.value)}
                    placeholder="e.g. Goblinoid, Undead, Beast, Construct, Spectral, Demon"
                    maxLength={200} disabled={loading} className={INP} />
                </Fld>
              </Sect>

              {/* Submit */}
              {error && (
                <div className="px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pb-8">
                <button type="button" onClick={onBack} disabled={loading}
                  className="flex-1 py-3 rounded-xl border border-yellow-300/20 text-yellow-300/50
                    text-sm hover:border-yellow-300/50 hover:text-yellow-300 transition-colors
                    disabled:opacity-40">
                  Cancel
                </button>
                <button type="submit" disabled={loading || !form.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-yellow-300 hover:bg-yellow-200
                    text-black font-black text-sm tracking-wide transition-all
                    disabled:opacity-30 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2">
                  {loading
                    ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : isEdit ? 'Save Changes' : 'Unleash This Thing'
                  }
                </button>
              </div>
            </div>

            {/* ══════════════ RIGHT PANEL — PREVIEW + NOTES ══════════════ */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 lg:sticky lg:top-20 order-first lg:order-last">

              {/* Live preview */}
              <div className="bg-[#111118] border border-yellow-300/20 rounded-xl overflow-hidden">
                <div className="border-b border-yellow-300/15 bg-yellow-300/5 px-4 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300/65">
                    Live Preview
                  </span>
                </div>
                <div className="p-4 font-mono">

                  {/* Name + type */}
                  <div className="mb-2">
                    <h3 className="text-xl font-black uppercase tracking-wider text-white leading-tight break-words">
                      {form.name
                        ? form.name
                        : <span className="text-yellow-300/25 font-normal normal-case tracking-normal text-sm">Creature name…</span>
                      }
                    </h3>
                    {form.creatureType && (
                      <p className="text-sm font-bold text-white/75 mt-0.5">{form.creatureType}</p>
                    )}
                  </div>

                  {/* HP + Morale */}
                  {(form.hp || form.morale) && (
                    <p className="text-sm text-white">
                      {form.hp && (
                        <><span className="text-yellow-300 font-bold">HP</span> {form.hp}</>
                      )}
                      {form.hp && form.morale && '  '}
                      {form.morale && (
                        <><span className="text-yellow-300 font-bold">Morale</span> {form.morale}</>
                      )}
                    </p>
                  )}

                  {/* Armor */}
                  {form.armor && (
                    <p className="text-sm font-bold text-white mt-0.5">{form.armor}</p>
                  )}

                  {/* Attacks */}
                  {filledAttacks.map((atk, i) => (
                    <p key={i} className="text-sm font-bold text-white">
                      {atk.name}
                      {atk.damage && <span className="font-normal text-white/70"> {atk.damage}</span>}
                    </p>
                  ))}

                  {/* Special */}
                  {form.special && (
                    <p className="text-sm mt-2">
                      <span className="text-yellow-300 font-bold">Special</span>{' '}
                      <span className="text-white/80">{form.special}</span>
                    </p>
                  )}

                  {/* Description */}
                  {form.description && (
                    <p className="text-xs text-white/55 mt-2 leading-relaxed">{form.description}</p>
                  )}

                  {/* Tables preview */}
                  {form.tables.filter(t => t.label.trim()).map(t => (
                    <div key={t.id} className="mt-3 pt-2 border-t border-yellow-300/10">
                      <p className="text-xs font-bold text-white/70">{t.label} ({t.die})</p>
                      {t.entries.filter(Boolean).map((e, i) => (
                        <p key={i} className="text-[10px] text-white/45">{i + 1}. {e}</p>
                      ))}
                    </div>
                  ))}

                  {/* Rewards */}
                  {form.rewards.some(r => r.label || r.amount) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-yellow-300/10 text-xs">
                      {form.rewards.filter(r => r.label || r.amount).map((r, i) => (
                        <span key={i} className="text-white/50">
                          {r.label}{' '}
                          <span className="font-bold text-white">{r.amount}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {!form.name && !form.hp && (
                    <p className="text-yellow-300/20 text-xs italic">The form bleeds into the preview…</p>
                  )}
                </div>
              </div>

              {/* System Notes */}
              <Collapsible title="System Notes">
                <div className="flex flex-col gap-3 text-[11px] text-yellow-300/55 leading-relaxed font-mono">
                  <Note title="HP">
                    Pure numbers. No formula tied to level. Fragile humanoids: 4–8. Dangerous beasts: 10–20. Monstrosities: 20–40+. The world is ending — things die fast.
                  </Note>
                  <Note title="Morale">
                    Tested with 2d6 when the tide turns. Roll above the number to hold ground. Roll under — they break and flee. Use "—" for things that never stop: undead, frenzied beasts, the truly mad. Use "special" when the rule is written in the text.
                  </Note>
                  <Note title="Armor">
                    Roll the protection die and subtract from incoming damage (minimum 0). -d2 = barely anything. -d6 = real protection. Supernatural armor can go higher. "No armor" means full damage lands every time.
                  </Note>
                  <Note title="Attacks">
                    No to-hit roll. Attacks connect. Players roll to dodge (Agility test vs. DR). Combine attack names with slashes for dual options: "Claw/Bite d4" means the creature picks one.
                  </Note>
                  <Note title="Special">
                    Keep it punishing. This is the mechanic that makes players remember the fight. Use DR tests when you need player agency. Describe exactly what happens on a failure.
                  </Note>
                  <Note title="Tables">
                    Roll for variety. d4 = 4 outcomes. d6 = 6. Tables give a single creature type many faces — no two encounters feel the same. Mutate freely.
                  </Note>
                </div>
              </Collapsible>

            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

// ─── Table Editor ─────────────────────────────────────────────────────────────

function TableEditor({ table, loading, onLabel, onDie, onEntry, onRemove }) {
  return (
    <div className="bg-black/40 border border-yellow-300/20 rounded-xl p-3">
      <div className="flex gap-2 items-center mb-3">
        <input type="text" value={table.label} onChange={e => onLabel(e.target.value)}
          placeholder="e.g. Traits, Values, Speciality, Wields"
          disabled={loading}
          className={`${INP} flex-1 font-bold text-yellow-300`}
        />
        <select value={table.die} onChange={e => onDie(e.target.value)}
          disabled={loading}
          className="bg-black/60 border border-yellow-300/30 rounded-lg px-2.5 py-2
            text-yellow-300 text-sm focus:outline-none focus:border-yellow-300/60
            disabled:opacity-40">
          {['d4', 'd6', 'd8', 'd10', 'd12'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button type="button" onClick={onRemove} disabled={loading}
          className="text-yellow-300/25 hover:text-red-500 transition-colors p-1.5
            disabled:opacity-30">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {table.entries.map((entry, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <span className="text-[10px] text-yellow-300/35 w-5 text-right shrink-0">{idx + 1}.</span>
            <input type="text" value={entry} onChange={e => onEntry(idx, e.target.value)}
              placeholder={`Entry ${idx + 1}`} disabled={loading}
              className={`${INP} text-xs`} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sect({ title, children }) {
  return (
    <div className={CARD}>
      <div className={HDR}>
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300/65">{title}</span>
      </div>
      <div className={BODY}>{children}</div>
    </div>
  )
}

function Fld({ label, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-yellow-300/65">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-[10px] font-normal text-yellow-300/35">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Collapsible({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={CARD}>
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3
          hover:bg-yellow-300/5 transition-colors">
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300/65">
          {title}
        </span>
        {open
          ? <ChevronUp size={14} className="text-yellow-300/35" />
          : <ChevronDown size={14} className="text-yellow-300/35" />
        }
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function Note({ title, children }) {
  return (
    <div>
      <p className="text-yellow-300/75 font-black uppercase tracking-wider text-[10px] mb-1">{title}</p>
      <p>{children}</p>
    </div>
  )
}
