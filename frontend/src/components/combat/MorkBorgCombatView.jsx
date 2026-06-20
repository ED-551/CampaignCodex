/**
 * MorkBorgCombatView — GM combat tracker for Mörk Borg.
 *
 * Initiative (per rules p.1 reference card):
 *   Group:      Roll d6 — 1–3 Enemies begin, 4–6 Players begin
 *   Individual: Agility + d6 per combatant (optional toggle)
 *
 * Turn model:
 *   The winning group acts first. Within that group, any order.
 *   The second group acts after ALL of the first group are done.
 *   Checkbox per combatant tracks has_gone. Next Round requires everyone.
 *
 * Morale triggers (rules):
 *   • Leader killed
 *   • ≥50% of enemy group eliminated
 *   • Lone enemy at ≤⅓ HP
 *
 * Broken (0 HP) — d4 table (displayed in right panel for reference).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  SkipForward, Plus, BookOpen, X, Skull, Heart,
  Shield, AlertTriangle, Swords, Dice6,
} from 'lucide-react'
import { api } from '../../utils/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

function clone(x) { return JSON.parse(JSON.stringify(x)) }
function d6()     { return Math.floor(Math.random() * 6) + 1 }
function dN(n)    { return Math.floor(Math.random() * n) + 1 }

function hpColor(pct) {
  if (pct > 50) return 'bg-emerald-500'
  if (pct > 25) return 'bg-yellow-400'
  return 'bg-red-500'
}

function newMonster() {
  return {
    id:         crypto.randomUUID(),
    type:       'monster',
    name:       'Creature',
    hp_current: 8,
    hp_max:     8,
    ac:         12,
    morale:     null,
    has_gone:   false,
    is_dead:    false,
    conditions: [],
    notes:      '',
    monsterId:  null,
  }
}

const BTN = 'flex items-center gap-1 px-2.5 py-1 rounded-lg border border-codex-border text-[11px] text-codex-subtext hover:border-codex-gold/50 hover:text-codex-text transition-colors'

// ─── MorkBorgCombatView ───────────────────────────────────────────────────────

export default function MorkBorgCombatView({
  session,
  campaignId,
  isGM,
  onEndCombat,
  socket,
}) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [combatants,      setCombatants]      = useState(session?.combatants ?? [])
  const [round,           setRound]           = useState(session?.round_number ?? 1)
  const [initiativeMode,  setInitiativeMode]  = useState(session?.combat_mode ?? 'mb_pending')
  const [initiativeRoll,  setInitiativeRoll]  = useState(null)   // the raw d6, shown in banner

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [roundError,      setRoundError]      = useState('')
  const [showBestiary,    setShowBestiary]    = useState(false)
  const [bestiaryList,    setBestiaryList]    = useState([])
  const [bestiarySearch,  setBestiarySearch]  = useState('')
  const [bestiaryLoading, setBestiaryLoading] = useState(false)
  const [moraleWarning,   setMoraleWarning]   = useState(false)
  const [moraleDismissed, setMoraleDismissed] = useState(false)
  const [brokenRoll,      setBrokenRoll]      = useState(null)   // { name, result }
  const [useIndivInit,    setUseIndivInit]    = useState(false)  // individual Agility+d6 mode

  const sessionId            = session?.id
  const initialMonsterCount  = useRef(
    (session?.combatants ?? []).filter(c => c.type === 'monster').length
  )

  // ── Sync socket updates ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    function onUpdate({ combatants: c, roundNumber, combatMode: cm, eventType }) {
      if (eventType === 'ended') return
      if (c)  setCombatants(c)
      if (roundNumber) setRound(roundNumber)
      if (cm) setInitiativeMode(cm)
    }
    socket.on('combat_update', onUpdate)
    return () => socket.off('combat_update', onUpdate)
  }, [socket])

  // ── Persist + broadcast ───────────────────────────────────────────────────────
  const pushUpdate = useCallback(async (nextCombatants, nextRound, nextMode) => {
    const c = nextCombatants ?? combatants
    const r = nextRound      ?? round
    const m = nextMode       ?? initiativeMode

    if (sessionId) {
      await api.patch(`/combat/${sessionId}`, {
        combatants:   c,
        round_number: r,
        combat_mode:  m,
      }).catch(err => console.error('[MorkBorgCombat] persist error', err))
    }

    if (socket) {
      socket.emit('push_combat_update', {
        campaignId,
        combatants:  c,
        roundNumber: r,
        combatMode:  m,
        eventType:   'update',
      })
    }
  }, [combatants, round, initiativeMode, sessionId, campaignId, socket])

  // ── Morale auto-detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (moraleDismissed) return
    const monsters = combatants.filter(c => c.type === 'monster' || c.type === 'npc')
    const dead     = monsters.filter(c => c.is_dead).length
    const total    = initialMonsterCount.current
    if (total > 0 && dead >= Math.ceil(total / 2)) setMoraleWarning(true)
    // Lone survivor at ≤⅓ HP
    const alive = monsters.filter(c => !c.is_dead)
    if (alive.length === 1 && alive[0].hp_max > 0 &&
        alive[0].hp_current / alive[0].hp_max <= 1/3) setMoraleWarning(true)
  }, [combatants, moraleDismissed])

  // ── Derived lists ─────────────────────────────────────────────────────────────
  const pcs      = combatants.filter(c => c.type === 'pc')
  const monsters = combatants.filter(c => c.type === 'monster' || c.type === 'npc')

  // Sort by individual initiative if that mode is active
  const sortedPCs = useIndivInit
    ? [...pcs].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
    : [...pcs].sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0))

  const playersFirst  = initiativeMode === 'mb_players'
  const enemiesFirst  = initiativeMode === 'mb_enemies'
  const pending       = initiativeMode === 'mb_pending'

  const firstGroup  = pending ? sortedPCs  : (playersFirst ? sortedPCs : monsters)
  const secondGroup = pending ? monsters   : (playersFirst ? monsters  : sortedPCs)
  const firstLabel  = pending ? 'Players'  : (playersFirst ? 'PLAYERS ACT FIRST' : 'ENEMIES ACT FIRST')
  const secondLabel = pending ? 'Monsters' : (playersFirst ? 'Enemies act after' : 'Players act after')
  const firstIsPC   = pending || playersFirst

  // ── Roll initiative ───────────────────────────────────────────────────────────
  function rollGroupInitiative() {
    const roll   = d6()
    const winner = roll <= 3 ? 'mb_enemies' : 'mb_players'
    setInitiativeRoll(roll)
    setInitiativeMode(winner)

    // If individual mode: also roll Agility + d6 for each combatant
    let next = clone(combatants)
    if (useIndivInit) {
      next = next.map(c => {
        const agl = c.agility ?? 0
        return { ...c, initiative: dN(6) + agl }
      })
    }
    setCombatants(next)
    pushUpdate(next, null, winner)
  }

  // ── Toggle has_gone ───────────────────────────────────────────────────────────
  function toggleHasGone(id) {
    setRoundError('')
    const next = clone(combatants).map(c =>
      c.id === id ? { ...c, has_gone: !c.has_gone } : c
    )
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Next round ────────────────────────────────────────────────────────────────
  function nextRound() {
    const missing = combatants
      .filter(c => !c.is_dead && !c.has_gone)
      .map(c => c.name)

    if (missing.length > 0) {
      setRoundError(`Hasn't acted yet: ${missing.join(', ')}`)
      return
    }

    const next = clone(combatants).map(c => ({ ...c, has_gone: false, initiative: null }))
    const nextR = round + 1
    setCombatants(next)
    setRound(nextR)
    setRoundError('')
    // Keep the same initiative winner for all subsequent rounds
    pushUpdate(next, nextR)
  }

  // ── HP update ────────────────────────────────────────────────────────────────
  async function updateHP(id, cur, max) {
    const curN = Number(cur)
    const maxN = Number(max)
    const next = clone(combatants).map(c =>
      c.id === id ? { ...c, hp_current: curN, hp_max: maxN, is_dead: curN <= 0 } : c
    )
    setCombatants(next)
    const target = combatants.find(c => c.id === id)
    if (target?.characterId) {
      api.patch(`/characters/${target.characterId}/hp`, { hp_current: curN, hp_max: maxN }).catch(() => {})
    }
    pushUpdate(next)
  }

  // ── Toggle dead ───────────────────────────────────────────────────────────────
  function toggleDead(id) {
    const next = clone(combatants).map(c =>
      c.id === id ? { ...c, is_dead: !c.is_dead } : c
    )
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Roll Broken d4 ────────────────────────────────────────────────────────────
  function rollBroken(name) {
    const result = dN(4)
    setBrokenRoll({ name, result })
  }

  // ── Add monster ───────────────────────────────────────────────────────────────
  function addQuickMonster() {
    const m    = newMonster()
    const next = [...combatants, m]
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Remove combatant ─────────────────────────────────────────────────────────
  function removeCombatant(id) {
    const next = combatants.filter(c => c.id !== id)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Bestiary ─────────────────────────────────────────────────────────────────
  async function openBestiary() {
    setShowBestiary(true)
    setBestiaryLoading(true)
    try {
      const { monsters: list } = await api.get('/bestiary?system=morkborg')
      setBestiaryList(list ?? [])
    } catch { setBestiaryList([]) }
    finally { setBestiaryLoading(false) }
  }

  function addFromBestiary(monster) {
    const sd = monster.stat_data ?? {}
    const m  = {
      ...newMonster(),
      name:       monster.name,
      hp_current: sd.hp   ?? 8,
      hp_max:     sd.hp   ?? 8,
      ac:         sd.ac   ?? 12,
      morale:     sd.morale ?? null,
      monsterId:  monster.id,
    }
    const next = [...combatants, m]
    setCombatants(next)
    pushUpdate(next)
    setShowBestiary(false)
  }

  const filteredBestiary = bestiaryList.filter(m =>
    m.name.toLowerCase().includes(bestiarySearch.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden min-h-0">

      {/* LEFT PANEL */}
      <div className="flex flex-col w-[60%] min-w-0 border-r border-codex-border overflow-hidden">

        {/* Morale warning */}
        {moraleWarning && !moraleDismissed && (
          <div className="flex-none bg-red-900/30 border-b border-red-700/30 px-4 py-2 flex items-center gap-2">
            <AlertTriangle size={12} className="text-red-400 shrink-0" />
            <p className="text-[11px] text-red-300 flex-1">
              <strong>MORALE CHECK</strong> — roll 2d6 against creature's Morale. Over = flees (1–3) or surrenders (4–6).
            </p>
            <button onClick={() => setMoraleDismissed(true)} className="text-red-500 hover:text-red-300">
              <X size={12} />
            </button>
          </div>
        )}

        {/* GM Controls */}
        {isGM && (
          <div className="flex-none flex flex-col px-4 py-2 border-b border-codex-border gap-2">
            <div className="flex items-center gap-2 flex-wrap">

              {/* Initiative roll button */}
              <button
                onClick={rollGroupInitiative}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  pending
                    ? 'border-codex-gold/50 bg-codex-gold/10 text-codex-gold hover:bg-codex-gold/20 animate-pulse'
                    : 'border-codex-border text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'
                }`}
                title="Roll d6: 1–3 enemies first, 4–6 players first"
              >
                <Dice6 size={11} />
                {pending ? 'Roll Initiative (d6)' : 'Re-roll Initiative'}
              </button>

              {/* Individual initiative toggle */}
              <button
                onClick={() => setUseIndivInit(p => !p)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  useIndivInit
                    ? 'border-codex-gold/40 bg-codex-gold/10 text-codex-gold'
                    : 'border-codex-border text-codex-muted hover:text-codex-subtext'
                }`}
                title="Individual: roll Agility + d6 for each combatant"
              >
                {useIndivInit ? '◆ Individual Init' : '◇ Individual Init'}
              </button>

              {/* Add monsters */}
              <button onClick={openBestiary} className={BTN}>
                <BookOpen size={9} /> + Bestiary
              </button>
              <button onClick={addQuickMonster} className={BTN}>
                <Plus size={9} /> + Monster
              </button>

              {/* Round + Next Round */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-codex-muted">
                  Round <span className="text-codex-gold font-mono font-semibold">{round}</span>
                </span>
                <button
                  onClick={nextRound}
                  className={`${BTN} border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60`}
                >
                  <SkipForward size={10} /> Next Round
                </button>
              </div>
            </div>

            {/* Validation error */}
            {roundError && (
              <p className="text-[10px] text-red-400 leading-tight">⚠ {roundError}</p>
            )}
          </div>
        )}

        {/* Player view header */}
        {!isGM && (
          <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-codex-border">
            <span className="text-[10px] text-codex-muted uppercase tracking-widest">Round</span>
            <span className="text-sm font-mono font-bold text-codex-gold">{round}</span>
          </div>
        )}

        {/* ── Initiative result banner ── */}
        {initiativeRoll !== null && !pending && (
          <div className={`flex-none flex items-center justify-center gap-3 px-4 py-2 border-b ${
            playersFirst
              ? 'bg-codex-gold/8 border-codex-gold/20'
              : 'bg-red-900/20 border-red-700/20'
          }`}>
            <span className={`font-mono text-xl font-black ${playersFirst ? 'text-codex-gold' : 'text-red-400'}`}>
              {initiativeRoll}
            </span>
            <span className={`text-xs font-bold uppercase tracking-widest ${
              playersFirst ? 'text-codex-gold/80' : 'text-red-400/80'
            }`}>
              {playersFirst ? '— The Wretched act first' : '— The Damned act first'}
            </span>
          </div>
        )}
        {!initiativeRoll && !pending && (
          <div className={`flex-none flex items-center justify-center gap-3 px-4 py-2 border-b ${
            playersFirst
              ? 'bg-codex-gold/8 border-codex-gold/20'
              : 'bg-red-900/20 border-red-700/20'
          }`}>
            <span className={`text-xs font-bold uppercase tracking-widest ${
              playersFirst ? 'text-codex-gold/80' : 'text-red-400/80'
            }`}>
              {playersFirst ? '⚔ Players act first this round' : '💀 Enemies act first this round'}
            </span>
          </div>
        )}

        {/* ── Combatant list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">

          {/* FIRST GROUP */}
          <GroupSection
            label={firstLabel}
            isFirst
            isPC={firstIsPC}
            combatants={firstGroup}
            isGM={isGM}
            useIndivInit={useIndivInit}
            onToggleHasGone={toggleHasGone}
            onToggleDead={toggleDead}
            onRemove={removeCombatant}
            onUpdateHP={updateHP}
            onRollBroken={rollBroken}
          />

          {/* Divider — "then they act" */}
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-codex-border" />
            <span className="text-[9px] text-codex-muted uppercase tracking-widest shrink-0">
              {secondLabel}
            </span>
            <div className="flex-1 h-px bg-codex-border" />
          </div>

          {/* SECOND GROUP */}
          <GroupSection
            label=""
            isFirst={false}
            isPC={!firstIsPC}
            combatants={secondGroup}
            isGM={isGM}
            useIndivInit={useIndivInit}
            onToggleHasGone={toggleHasGone}
            onToggleDead={toggleDead}
            onRemove={removeCombatant}
            onUpdateHP={updateHP}
            onRollBroken={rollBroken}
          />

        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col w-[40%] min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border">
          <span className="text-xs font-semibold text-codex-subtext uppercase tracking-widest">
            Reference
          </span>
          {isGM && (
            <button
              onClick={onEndCombat}
              className="text-[11px] text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 rounded-lg px-2.5 py-1 transition-colors"
            >
              End Combat
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Broken roll result */}
          {brokenRoll && (
            <BrokenResultCard result={brokenRoll} onDismiss={() => setBrokenRoll(null)} />
          )}

          {/* Combat Reference */}
          <ReferenceCard />

          {/* Broken table */}
          <BrokenTable />

          {/* Morale reference */}
          <MoraleCard />

        </div>
      </div>

      {/* ── Bestiary modal ── */}
      {showBestiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-codex-surface border border-codex-border rounded-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border">
              <span className="text-sm font-semibold text-codex-text">Mörk Borg Bestiary</span>
              <button onClick={() => setShowBestiary(false)} className="text-codex-muted hover:text-codex-text">
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-codex-border">
              <input
                autoFocus
                value={bestiarySearch}
                onChange={e => setBestiarySearch(e.target.value)}
                placeholder="Search creatures…"
                className="w-full bg-codex-bg border border-codex-border rounded-lg px-3 py-1.5 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {bestiaryLoading && (
                <p className="text-xs text-codex-muted text-center py-8 animate-pulse">Loading…</p>
              )}
              {!bestiaryLoading && filteredBestiary.length === 0 && (
                <p className="text-xs text-codex-muted text-center py-8 italic">
                  No Mörk Borg creatures in bestiary yet.
                </p>
              )}
              {filteredBestiary.map(m => (
                <button
                  key={m.id}
                  onClick={() => addFromBestiary(m)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-codex-bg border border-transparent hover:border-codex-border transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-codex-text font-medium">{m.name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-codex-muted shrink-0">
                    {m.stat_data?.hp   && <span>HP {m.stat_data.hp}</span>}
                    {m.stat_data?.ac   && <span>AC {m.stat_data.ac}</span>}
                    {m.challenge       && <span>#{m.challenge}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── GroupSection ─────────────────────────────────────────────────────────────

function GroupSection({
  label, isFirst, isPC, combatants,
  isGM, useIndivInit,
  onToggleHasGone, onToggleDead, onRemove, onUpdateHP, onRollBroken,
}) {
  if (combatants.length === 0) return null

  const dotColor = isPC ? 'bg-blue-400' : 'bg-red-400'

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            isFirst
              ? (isPC ? 'text-codex-gold' : 'text-red-400')
              : 'text-codex-muted'
          }`}>
            {label}
          </span>
        </div>
      )}
      {combatants.map(c => (
        <MorkBorgCard
          key={c.id}
          combatant={c}
          isPC={isPC}
          isGM={isGM}
          showInitiative={useIndivInit}
          onToggleHasGone={() => onToggleHasGone(c.id)}
          onToggleDead={() => onToggleDead(c.id)}
          onRemove={!isPC && isGM ? () => onRemove(c.id) : undefined}
          onUpdateHP={(cur, max) => onUpdateHP(c.id, cur, max)}
          onRollBroken={() => onRollBroken(c.name)}
        />
      ))}
    </div>
  )
}

// ─── MorkBorgCard ─────────────────────────────────────────────────────────────

function MorkBorgCard({
  combatant: c, isPC, isGM, showInitiative,
  onToggleHasGone, onToggleDead, onRemove, onUpdateHP, onRollBroken,
}) {
  const [editHP,   setEditHP]   = useState(false)
  const [hpCurVal, setHpCurVal] = useState(c.hp_current)
  const [hpMaxVal, setHpMaxVal] = useState(c.hp_max)

  useEffect(() => {
    if (!editHP) { setHpCurVal(c.hp_current); setHpMaxVal(c.hp_max) }
  }, [c.hp_current, c.hp_max, editHP])

  const hpPct = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0
  const lowHP = hpPct <= 50 && !c.is_dead
  const zero  = c.hp_current <= 0 && !c.is_dead

  const dotColor = isPC ? 'bg-blue-400' : 'bg-red-400'

  const cardBg = c.has_gone
    ? 'bg-codex-card/40 border-codex-border/30 opacity-60'
    : zero
      ? 'bg-red-900/20 border-red-700/40'
      : 'bg-codex-card border-codex-border hover:border-codex-border/80'

  return (
    <div className={`rounded-xl border transition-all ${cardBg} ${c.is_dead ? 'opacity-25' : ''}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">

        {/* Checkbox — GM clicks; players see read-only */}
        {isGM ? (
          <button
            onClick={onToggleHasGone}
            disabled={c.is_dead}
            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              c.has_gone
                ? 'bg-emerald-500 border-emerald-500'
                : isPC
                  ? 'border-blue-400/50 hover:border-emerald-500/60'
                  : 'border-red-400/40 hover:border-emerald-500/60'
            } ${c.is_dead ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {c.has_gone && <span className="text-[9px] text-white font-bold">✓</span>}
          </button>
        ) : (
          <span className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
            c.has_gone ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'border-codex-border/40'
          }`}>
            {c.has_gone && <span className="text-[9px] font-bold">✓</span>}
          </span>
        )}

        {/* Type dot */}
        <span className={`shrink-0 w-2 h-2 rounded-full ${dotColor}`} />

        {/* Individual initiative badge */}
        {showInitiative && c.initiative != null && (
          <span className="shrink-0 text-[10px] font-mono text-codex-gold w-6 text-center">
            {c.initiative}
          </span>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium truncate block ${
            c.is_dead ? 'line-through text-codex-muted' : 'text-codex-text'
          }`}>
            {c.name}
          </span>
          {c.username && isPC && (
            <span className="text-[10px] text-codex-muted">{c.username}</span>
          )}
        </div>

        {/* HP (monsters always show to GM; PCs always show) */}
        {(isGM || isPC) && c.hp_max > 0 && (
          <div className="shrink-0 flex flex-col items-end gap-1 min-w-[90px]">
            {editHP && isGM ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={hpCurVal}
                  onChange={e => setHpCurVal(e.target.value)}
                  onBlur={() => { setEditHP(false); onUpdateHP(hpCurVal, hpMaxVal) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  autoFocus
                  className="w-10 bg-codex-bg border border-codex-gold/50 rounded px-1 text-xs text-center text-codex-text outline-none"
                />
                <span className="text-[10px] text-codex-muted">/</span>
                <input
                  type="number"
                  value={hpMaxVal}
                  onChange={e => setHpMaxVal(e.target.value)}
                  onBlur={() => { setEditHP(false); onUpdateHP(hpCurVal, hpMaxVal) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  className="w-10 bg-codex-bg border border-codex-gold/50 rounded px-1 text-xs text-center text-codex-text outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => isGM && setEditHP(true)}
                className={`text-xs font-mono flex items-center gap-1 ${
                  isGM ? 'cursor-pointer hover:text-codex-gold' : 'cursor-default'
                } ${zero ? 'text-red-400 font-bold' : lowHP ? 'text-yellow-400' : 'text-codex-subtext'}`}
              >
                <Heart size={9} /> {c.hp_current}/{c.hp_max}
              </button>
            )}
            <div className="w-24 h-1 bg-codex-bg rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${hpColor(hpPct)}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Non-GM monster HP label */}
        {!isGM && !isPC && (
          <span className={`shrink-0 text-[10px] font-mono ${
            c.hp_label === 'Dead' || c.hp_label === 'Dying' ? 'text-red-400' :
            c.hp_label === 'Near Death' ? 'text-yellow-400' :
            c.hp_label === 'Bloodied' ? 'text-orange-400' :
            'text-emerald-400'
          }`}>
            {c.hp_label ?? '?'}
          </span>
        )}

        {/* AC */}
        {c.ac != null && (
          <span className="shrink-0 text-[10px] text-codex-muted flex items-center gap-0.5">
            <Shield size={9} /> {c.ac}
          </span>
        )}

        {/* Broken roll button (when HP hits 0) */}
        {isGM && zero && !c.is_dead && (
          <button
            onClick={onRollBroken}
            className="shrink-0 text-[9px] px-1.5 py-0.5 rounded border border-red-500/50 text-red-400 hover:bg-red-900/20 transition-colors animate-pulse"
            title="Roll d4 Broken table"
          >
            BROKEN d4
          </button>
        )}

        {/* GM controls */}
        {isGM && (
          <div className="shrink-0 flex items-center gap-0.5">
            <button
              onClick={onToggleDead}
              className={`p-1 rounded transition-colors ${c.is_dead ? 'text-red-400' : 'text-codex-muted hover:text-red-400'}`}
              title={c.is_dead ? 'Restore' : 'Mark dead'}
            >
              <Skull size={10} />
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 rounded text-codex-muted hover:text-red-400 transition-colors"
                title="Remove"
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── BrokenResultCard ─────────────────────────────────────────────────────────

const BROKEN_TABLE = {
  1: { label: 'Unconscious', desc: 'Falls unconscious for d4 rounds, awakens with d4 HP.' },
  2: { label: 'Broken Limb', desc: 'Roll d6: 1–5 = broken/severed limb; 6 = lost eye. Can\'t act for d4 rounds, then active with d4 HP.' },
  3: { label: 'Haemorrhage', desc: 'Death in d2 hours unless treated. All tests DR16 first hour, DR18 second hour.' },
  4: { label: 'DEAD', desc: 'Gone. Burned. Forgotten.' },
}

function BrokenResultCard({ result, onDismiss }) {
  const { name, result: roll } = result
  const entry = BROKEN_TABLE[roll] ?? BROKEN_TABLE[4]

  return (
    <div className="rounded-xl border border-red-700/40 bg-red-900/15 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] text-red-500/70 uppercase tracking-widest">{name} is BROKEN</p>
          <p className="text-sm font-bold text-red-300">{roll} — {entry.label}</p>
        </div>
        <button onClick={onDismiss} className="text-red-500/60 hover:text-red-400">
          <X size={12} />
        </button>
      </div>
      <p className="text-[11px] text-codex-subtext leading-relaxed">{entry.desc}</p>
    </div>
  )
}

// ─── ReferenceCard ────────────────────────────────────────────────────────────

function ReferenceCard() {
  return (
    <div className="rounded-xl border border-codex-border bg-codex-card p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-codex-muted mb-3">Combat</p>
      {[
        { label: 'Melee',   detail: 'DR12 Strength',  icon: '⚔' },
        { label: 'Ranged',  detail: 'DR12 Presence',  icon: '🎯' },
        { label: 'Defence', detail: 'DR12 Agility',   icon: '🛡' },
      ].map(r => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="shrink-0 text-sm">{r.icon}</span>
          <span className="font-semibold text-codex-text w-16 shrink-0">{r.label}</span>
          <span className="text-codex-muted">{r.detail}</span>
        </div>
      ))}
      <div className="pt-2 border-t border-codex-border/50 space-y-1 text-[10px] text-codex-muted">
        <p><span className="text-codex-gold font-semibold">CRIT 20 (Attack):</span> ×2 damage, armor reduced one tier</p>
        <p><span className="text-codex-gold font-semibold">CRIT 20 (Defence):</span> PC gains a free attack</p>
        <p><span className="text-red-400 font-semibold">FUMBLE 1 (Attack):</span> Weapon breaks or is lost</p>
        <p><span className="text-red-400 font-semibold">FUMBLE 1 (Defence):</span> Double damage, armor reduced</p>
      </div>
    </div>
  )
}

// ─── BrokenTable ─────────────────────────────────────────────────────────────

function BrokenTable() {
  return (
    <div className="rounded-xl border border-codex-border bg-codex-card p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-codex-muted mb-3">
        Broken (0 HP) — Roll d4
      </p>
      {Object.entries(BROKEN_TABLE).map(([k, v]) => (
        <div key={k} className="flex gap-2 text-[11px]">
          <span className={`shrink-0 font-bold font-mono w-4 ${
            k === '4' ? 'text-red-400' : k === '3' ? 'text-orange-400' : 'text-codex-muted'
          }`}>{k}</span>
          <div>
            <span className="font-semibold text-codex-text">{v.label} — </span>
            <span className="text-codex-subtext">{v.desc}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── MoraleCard ──────────────────────────────────────────────────────────────

function MoraleCard() {
  return (
    <div className="rounded-xl border border-codex-border bg-codex-card p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-codex-muted mb-3">Morale — 2d6</p>
      <p className="text-[11px] text-codex-subtext leading-relaxed mb-2">
        Roll 2d6 <strong className="text-codex-text">over</strong> creature's Morale value.
        Success: 1–3 flees, 4–6 surrenders.
      </p>
      <p className="text-[10px] text-codex-muted font-semibold uppercase tracking-wide">Triggers</p>
      {[
        'The leader is killed',
        '≥50% of the group eliminated',
        'Lone survivor at ⅓ HP or less',
      ].map(t => (
        <div key={t} className="flex items-start gap-1.5 text-[11px] text-codex-subtext">
          <span className="text-red-400 shrink-0 mt-px">•</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  )
}
