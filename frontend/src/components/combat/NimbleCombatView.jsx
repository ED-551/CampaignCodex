/**
 * NimbleCombatView — GM combat tracker for Nimble RPG.
 *
 * Turn model (per core rules p.15):
 *   Standard:  ALL heroes go first (any order), THEN all monsters go as a group.
 *   Legendary: ONE boss — boss reacts after EACH hero takes their turn.
 *              Pattern: [PC₁ → Boss] [PC₂ → Boss] [PC₃ → Boss] → Next Round
 *
 * No initiative order is tracked here (Nimble initiative = starting action count,
 * managed by players on their own sheets). Turn tracking is checkbox-only.
 *
 * Data model additions on each combatant:
 *   has_gone             boolean        Did this combatant take their turn?
 *   is_legendary_boss    boolean        Legendary mode: is this the boss?
 *   legendary_slots_gone boolean[]      Per-player-slot boss turn flags
 *   joinOrder            number         PC display order (set at combat start)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  SkipForward, Sword, Plus, BookOpen, X, Skull,
  Crown, Shield, Heart, AlertTriangle, Swords, UserPlus,
} from 'lucide-react'
import { api } from '../../utils/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

function clone(x) { return JSON.parse(JSON.stringify(x)) }

function newMonster() {
  return {
    id:                   crypto.randomUUID(),
    type:                 'monster',
    name:                 'Monster',
    hp_current:           10,
    hp_max:               10,
    ac:                   12,
    has_gone:             false,
    is_dead:              false,
    is_legendary_boss:    false,
    legendary_slots_gone: [],
    conditions:           [],
    notes:                '',
    monsterId:            null,
  }
}

function hpColor(pct) {
  if (pct > 50) return 'bg-emerald-500'
  if (pct > 25) return 'bg-yellow-400'
  return 'bg-red-500'
}

const TRACKER_BTN = 'flex items-center gap-1 px-2.5 py-1 rounded-lg border border-codex-border text-[11px] text-codex-subtext hover:border-codex-gold/50 hover:text-codex-text transition-colors'

// ─── NimbleCombatView ─────────────────────────────────────────────────────────

export default function NimbleCombatView({
  session,
  campaignId,
  isGM,
  onEndCombat,
  socket,
}) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [combatants, setCombatants] = useState(session?.combatants ?? [])
  const [round,      setRound]      = useState(session?.round_number ?? 1)
  const [combatMode, setCombatMode] = useState(session?.combat_mode ?? 'standard')

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [roundError,    setRoundError]    = useState('')   // validation for Next Round
  const [showBestiary,  setShowBestiary]  = useState(false)
  const [bestiaryList,  setBestiaryList]  = useState([])
  const [bestiarySearch,setBestiarySearch]= useState('')
  const [bestiaryLoading,setBestiaryLoading]=useState(false)
  const [dragId,        setDragId]        = useState(null)
  const [dropId,        setDropId]        = useState(null)
  const [addingGMChar,  setAddingGMChar]  = useState(false)

  const sessionId = session?.id

  // ── Sync incoming socket updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    function onUpdate({ combatants: c, roundNumber, combatMode: cm, eventType }) {
      if (eventType === 'ended') return
      if (c)  setCombatants(c)
      if (roundNumber) setRound(roundNumber)
      if (cm) setCombatMode(cm)
    }
    socket.on('combat_update', onUpdate)
    return () => socket.off('combat_update', onUpdate)
  }, [socket])

  // ── Persist + broadcast ──────────────────────────────────────────────────────
  const pushUpdate = useCallback(async (nextCombatants, nextRound, nextMode) => {
    const c  = nextCombatants ?? combatants
    const r  = nextRound      ?? round
    const m  = nextMode       ?? combatMode

    // Persist to DB
    if (sessionId) {
      await api.patch(`/combat/${sessionId}`, {
        combatants:   c,
        round_number: r,
        combat_mode:  m,
      }).catch(err => console.error('[NimbleCombat] persist error', err))
    }

    // Broadcast to players
    if (socket) {
      socket.emit('push_combat_update', {
        campaignId,
        combatants:  c,
        roundNumber: r,
        combatMode:  m,
        eventType:   'update',
      })
    }
  }, [combatants, round, combatMode, sessionId, campaignId, socket])

  // ── Derived lists ─────────────────────────────────────────────────────────────
  const pcs       = combatants.filter(c => c.type === 'pc')
  const monsters  = combatants.filter(c => c.type === 'monster' || c.type === 'npc')
  const boss      = monsters.find(c => c.is_legendary_boss) ?? null

  // Players sorted by joinOrder for display
  const orderedPCs = [...pcs].sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0))

  // ── Toggle has_gone for PCs and monsters (standard mode) ─────────────────────
  function toggleHasGone(id) {
    setRoundError('')
    const next = clone(combatants).map(c =>
      c.id === id ? { ...c, has_gone: !c.has_gone } : c
    )
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Toggle legendary boss slot (one slot per player position) ────────────────
  function toggleBossSlot(slotIndex) {
    setRoundError('')
    if (!boss) return
    const next = clone(combatants).map(c => {
      if (!c.is_legendary_boss) return c
      const slots = [...(c.legendary_slots_gone ?? [])]
      slots[slotIndex] = !slots[slotIndex]
      return { ...c, legendary_slots_gone: slots }
    })
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Toggle legendary boss designation ────────────────────────────────────────
  function toggleLegendaryBoss(id) {
    const next = clone(combatants).map(c => {
      if (c.type !== 'monster' && c.type !== 'npc') return c
      if (c.id === id) {
        const becomingBoss = !c.is_legendary_boss
        return {
          ...c,
          is_legendary_boss:    becomingBoss,
          legendary_slots_gone: becomingBoss ? new Array(orderedPCs.length).fill(false) : [],
        }
      }
      // Only one boss allowed — clear any other
      return { ...c, is_legendary_boss: false, legendary_slots_gone: [] }
    })
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Switch combat mode ────────────────────────────────────────────────────────
  function switchMode(newMode) {
    // Clear legendary state when switching to standard
    let next = clone(combatants)
    if (newMode === 'standard') {
      next = next.map(c => ({
        ...c,
        is_legendary_boss:    false,
        legendary_slots_gone: [],
      }))
    }
    // When switching to legendary with exactly one monster, auto-designate it
    if (newMode === 'legendary') {
      const mons = next.filter(c => c.type === 'monster' || c.type === 'npc')
      if (mons.length === 1) {
        next = next.map(c =>
          c.id === mons[0].id
            ? { ...c, is_legendary_boss: true, legendary_slots_gone: new Array(orderedPCs.length).fill(false) }
            : c
        )
      }
    }
    setCombatants(next)
    setCombatMode(newMode)
    pushUpdate(next, round, newMode)
  }

  // ── HP update ────────────────────────────────────────────────────────────────
  async function updateHP(id, cur, max) {
    const curN = Number(cur)
    const maxN = Number(max)
    let next   = clone(combatants)

    // For legendary boss: sync HP to ALL boss instances (same combatant id)
    next = next.map(c => {
      if (c.id !== id) return c
      const dead = curN <= 0
      return { ...c, hp_current: curN, hp_max: maxN, is_dead: dead }
    })

    setCombatants(next)

    // Persist character sheet HP for PCs
    const target = combatants.find(c => c.id === id)
    if (target?.characterId) {
      await api.patch(`/characters/${target.characterId}/hp`, {
        hp_current: curN,
        hp_max:     maxN,
      }).catch(() => {})
    }

    pushUpdate(next)
  }

  // ── Remove a combatant ────────────────────────────────────────────────────────
  function removeCombatant(id) {
    const next = combatants.filter(c => c.id !== id)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Toggle dead ──────────────────────────────────────────────────────────────
  function toggleDead(id) {
    const next = clone(combatants).map(c =>
      c.id === id ? { ...c, is_dead: !c.is_dead } : c
    )
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Add quick monster ────────────────────────────────────────────────────────
  function addQuickMonster() {
    const m    = newMonster()
    const next = [...combatants, m]
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Add GM's own character mid-session (fallback if not auto-added at start) ─
  async function addGMCharacter() {
    if (!sessionId || addingGMChar) return
    setAddingGMChar(true)
    try {
      const { session: updated } = await api.post(`/combat/${sessionId}/add-gm-character`, {})
      if (updated?.combatants) {
        setCombatants(updated.combatants)
        if (socket) {
          socket.emit('push_combat_update', {
            campaignId,
            combatants:  updated.combatants,
            roundNumber: round,
            combatMode,
            eventType:   'update',
          })
        }
      }
    } catch (err) {
      console.error('[NimbleCombat] addGMCharacter error', err)
      alert(err?.message ?? 'Could not add GM character. Make sure a character is linked in Campaign Settings.')
    } finally {
      setAddingGMChar(false)
    }
  }

  // ── Bestiary ────────────────────────────────────────────────────────────────
  async function openBestiary() {
    setShowBestiary(true)
    setBestiaryLoading(true)
    try {
      const gameSystem = session?.combat_mode ? 'nimble' : 'nimble'
      const { monsters: list } = await api.get(`/bestiary?system=nimble`)
      setBestiaryList(list ?? [])
    } catch { setBestiaryList([]) }
    finally { setBestiaryLoading(false) }
  }

  function addFromBestiary(monster) {
    const m = {
      ...newMonster(),
      name:       monster.name,
      hp_current: monster.stat_data?.hp ?? 10,
      hp_max:     monster.stat_data?.hp ?? 10,
      ac:         monster.stat_data?.ac ?? 12,
      monsterId:  monster.id,
    }
    const next = [...combatants, m]
    setCombatants(next)
    pushUpdate(next)
    setShowBestiary(false)
  }

  // ── Drag-drop (PC reorder in legendary) ──────────────────────────────────────
  function handleDragStart(id) { setDragId(id) }
  function handleDragOver(e, id) { e.preventDefault(); setDropId(id) }
  function handleDragEnd() { setDragId(null); setDropId(null) }
  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setDropId(null); return }
    const next   = clone(combatants)
    const fromI  = next.findIndex(c => c.id === dragId)
    const toI    = next.findIndex(c => c.id === targetId)
    if (fromI < 0 || toI < 0) { setDragId(null); setDropId(null); return }
    const [moved] = next.splice(fromI, 1)
    next.splice(toI, 0, moved)
    // Re-stamp joinOrder based on new PC positions
    let pcIdx = 0
    next.forEach(c => { if (c.type === 'pc') c.joinOrder = pcIdx++ })
    setCombatants(next)
    pushUpdate(next)
    setDragId(null); setDropId(null)
  }

  // ── Next Round ───────────────────────────────────────────────────────────────
  function nextRound() {
    const missing = []

    if (combatMode === 'standard') {
      combatants.forEach(c => {
        if (!c.is_dead && !c.has_gone) missing.push(c.name)
      })
    } else {
      // Legendary: check each PC and their corresponding boss slot
      orderedPCs.forEach((pc, i) => {
        if (pc.is_dead) return
        if (!pc.has_gone) missing.push(pc.name)
        if (boss && !boss.legendary_slots_gone?.[i]) {
          missing.push(`${boss.name} (after ${pc.name})`)
        }
      })
    }

    if (missing.length > 0) {
      setRoundError(`Hasn't gone yet: ${missing.join(', ')}`)
      return
    }

    // Reset all has_gone; advance round
    const next = clone(combatants).map(c => ({
      ...c,
      has_gone:             false,
      legendary_slots_gone: c.is_legendary_boss
        ? new Array(orderedPCs.length).fill(false)
        : c.legendary_slots_gone,
    }))
    const nextRound = round + 1
    setCombatants(next)
    setRound(nextRound)
    setRoundError('')
    pushUpdate(next, nextRound)
  }

  // ── Bestiary filter ──────────────────────────────────────────────────────────
  const filteredBestiary = bestiaryList.filter(m =>
    m.name.toLowerCase().includes(bestiarySearch.toLowerCase())
  )

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden min-h-0">

      {/* ── Left panel ── */}
      <div className="flex flex-col w-[60%] min-w-0 border-r border-codex-border overflow-hidden">

        {/* GM Controls */}
        {isGM && (
          <div className="flex-none flex flex-col px-4 py-2 border-b border-codex-border gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mode toggle */}
              <div className="flex items-center rounded-lg border border-codex-border overflow-hidden text-[11px]">
                <button
                  onClick={() => switchMode('standard')}
                  className={`px-3 py-1 transition-colors ${
                    combatMode === 'standard'
                      ? 'bg-codex-gold/20 text-codex-gold border-r border-codex-border'
                      : 'text-codex-subtext hover:text-codex-text border-r border-codex-border'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => switchMode('legendary')}
                  className={`px-3 py-1 transition-colors ${
                    combatMode === 'legendary'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-codex-subtext hover:text-codex-text'
                  }`}
                >
                  ⚔ Legendary
                </button>
              </div>

              {/* Add GM character (fallback — only shown when not already present) */}
              {!combatants.some(c => c.isGMCharacter) && (
                <button
                  onClick={addGMCharacter}
                  disabled={addingGMChar}
                  title="Add your linked character to this combat as a Hero"
                  className={`${TRACKER_BTN} border-codex-gold/30 text-codex-gold/70 hover:border-codex-gold/60 hover:text-codex-gold disabled:opacity-40`}
                >
                  <UserPlus size={9} /> {addingGMChar ? 'Adding…' : '+ My Character'}
                </button>
              )}

              {/* Add monsters */}
              <button onClick={openBestiary} className={TRACKER_BTN}>
                <BookOpen size={9} /> + Bestiary
              </button>
              <button onClick={addQuickMonster} className={TRACKER_BTN}>
                <Plus size={9} /> + Monster
              </button>

              {/* Round + Next Round */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-codex-muted">
                  Round <span className="text-codex-gold font-mono font-semibold">{round}</span>
                </span>
                <button
                  onClick={nextRound}
                  className={`${TRACKER_BTN} border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60`}
                >
                  <SkipForward size={10} /> Next Round
                </button>
              </div>
            </div>

            {/* Validation error */}
            {roundError && (
              <p className="text-[10px] text-red-400 leading-tight">
                ⚠ {roundError}
              </p>
            )}
          </div>
        )}

        {/* Round badge — player view */}
        {!isGM && (
          <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-codex-border">
            <span className="text-[10px] text-codex-muted uppercase tracking-widest">Round</span>
            <span className="text-sm font-mono font-bold text-codex-gold">{round}</span>
            <span className="ml-2 text-[10px] text-codex-muted capitalize">{combatMode} battle</span>
          </div>
        )}

        {/* ── Combatant list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">

          {combatMode === 'standard' ? (
            <StandardLayout
              pcs={orderedPCs}
              monsters={monsters}
              isGM={isGM}
              dragId={dragId}
              dropId={dropId}
              onToggleHasGone={toggleHasGone}
              onToggleDead={toggleDead}
              onRemove={removeCombatant}
              onUpdateHP={updateHP}
              onToggleLegendaryBoss={toggleLegendaryBoss}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ) : (
            <LegendaryLayout
              orderedPCs={orderedPCs}
              boss={boss}
              allMonsters={monsters}
              isGM={isGM}
              dragId={dragId}
              dropId={dropId}
              onToggleHasGone={toggleHasGone}
              onToggleBossSlot={toggleBossSlot}
              onToggleDead={toggleDead}
              onRemove={removeCombatant}
              onUpdateHP={updateHP}
              onToggleLegendaryBoss={toggleLegendaryBoss}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          )}

        </div>
      </div>

      {/* ── Right panel (stat lookup placeholder) ── */}
      <div className="flex flex-col w-[40%] min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border">
          <span className="text-xs font-semibold text-codex-subtext uppercase tracking-widest">
            {combatMode === 'legendary' ? '⚔ Legendary Battle' : 'Standard Battle'}
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {combatMode === 'legendary' && boss && (
            <LegendaryBossPanel boss={boss} />
          )}
          {combatMode === 'legendary' && !boss && isGM && (
            <p className="text-xs text-codex-muted italic text-center mt-8">
              Add a monster and click the ⚔ icon on its card to designate it as the legendary boss.
            </p>
          )}
        </div>
      </div>

      {/* ── Bestiary modal ── */}
      {showBestiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-codex-surface border border-codex-border rounded-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border">
              <span className="text-sm font-semibold text-codex-text">Nimble Bestiary</span>
              <button onClick={() => setShowBestiary(false)} className="text-codex-muted hover:text-codex-text">
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-codex-border">
              <input
                autoFocus
                value={bestiarySearch}
                onChange={e => setBestiarySearch(e.target.value)}
                placeholder="Search monsters…"
                className="w-full bg-codex-bg border border-codex-border rounded-lg px-3 py-1.5 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {bestiaryLoading && (
                <p className="text-xs text-codex-muted text-center py-8 animate-pulse">Loading…</p>
              )}
              {!bestiaryLoading && filteredBestiary.length === 0 && (
                <p className="text-xs text-codex-muted text-center py-8 italic">No Nimble monsters in bestiary yet.</p>
              )}
              {filteredBestiary.map(m => (
                <button
                  key={m.id}
                  onClick={() => addFromBestiary(m)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-codex-bg border border-transparent hover:border-codex-border transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-codex-text font-medium">{m.name}</span>
                  <span className="text-[10px] text-codex-muted shrink-0">
                    HP {m.stat_data?.hp ?? '?'} · AC {m.stat_data?.ac ?? '?'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── StandardLayout ───────────────────────────────────────────────────────────
// Heroes section then Monsters section, separated by a divider.

function StandardLayout({
  pcs, monsters, isGM,
  dragId, dropId,
  onToggleHasGone, onToggleDead, onRemove, onUpdateHP,
  onToggleLegendaryBoss,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  return (
    <>
      {/* Heroes */}
      <SectionHeader label="Heroes" count={pcs.length} />
      {pcs.length === 0 && (
        <p className="text-[11px] text-codex-muted italic px-1">No players in combat.</p>
      )}
      {pcs.map(c => (
        <NimbleCard
          key={c.id}
          combatant={c}
          isGM={isGM}
          isDragTarget={c.id === dropId}
          showBossToggle={false}
          onToggleHasGone={() => onToggleHasGone(c.id)}
          onToggleDead={() => onToggleDead(c.id)}
          onRemove={undefined}
          onUpdateHP={(cur, max) => onUpdateHP(c.id, cur, max)}
          onDragStart={() => onDragStart(c.id)}
          onDragOver={e => onDragOver(e, c.id)}
          onDrop={() => onDrop(c.id)}
          onDragEnd={onDragEnd}
        />
      ))}

      {/* Divider */}
      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 h-px bg-codex-border" />
        <span className="text-[9px] text-codex-muted uppercase tracking-widest">Monsters act</span>
        <div className="flex-1 h-px bg-codex-border" />
      </div>

      {/* Monsters */}
      <SectionHeader label="Monsters" count={monsters.length} />
      {monsters.length === 0 && isGM && (
        <p className="text-[11px] text-codex-muted italic px-1">Add monsters with the buttons above.</p>
      )}
      {monsters.map(c => (
        <NimbleCard
          key={c.id}
          combatant={c}
          isGM={isGM}
          isDragTarget={c.id === dropId}
          showBossToggle={isGM}
          onToggleHasGone={() => onToggleHasGone(c.id)}
          onToggleDead={() => onToggleDead(c.id)}
          onRemove={isGM ? () => onRemove(c.id) : undefined}
          onUpdateHP={(cur, max) => onUpdateHP(c.id, cur, max)}
          onToggleLegendaryBoss={() => onToggleLegendaryBoss(c.id)}
          onDragStart={() => onDragStart(c.id)}
          onDragOver={e => onDragOver(e, c.id)}
          onDrop={() => onDrop(c.id)}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  )
}

// ─── LegendaryLayout ─────────────────────────────────────────────────────────
// Interleaved pattern: [PC₁ → Boss] [PC₂ → Boss] …

function LegendaryLayout({
  orderedPCs, boss, allMonsters, isGM,
  dragId, dropId,
  onToggleHasGone, onToggleBossSlot, onToggleDead,
  onRemove, onUpdateHP, onToggleLegendaryBoss,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  // Non-boss monsters are shown separately at bottom
  const sideMonsters = allMonsters.filter(c => !c.is_legendary_boss)

  return (
    <>
      {orderedPCs.length === 0 && (
        <p className="text-[11px] text-codex-muted italic">No players in combat.</p>
      )}

      {orderedPCs.map((pc, slotIdx) => (
        <div key={pc.id} className="space-y-1">
          {/* PC card */}
          <NimbleCard
            combatant={pc}
            isGM={isGM}
            isDragTarget={pc.id === dropId}
            showBossToggle={false}
            onToggleHasGone={() => onToggleHasGone(pc.id)}
            onToggleDead={() => onToggleDead(pc.id)}
            onRemove={undefined}
            onUpdateHP={(cur, max) => onUpdateHP(pc.id, cur, max)}
            onDragStart={() => onDragStart(pc.id)}
            onDragOver={e => onDragOver(e, pc.id)}
            onDrop={() => onDrop(pc.id)}
            onDragEnd={onDragEnd}
          />

          {/* Boss reaction slot — indented */}
          {boss ? (
            <div className="ml-6 border-l-2 border-amber-500/30 pl-2.5">
              <BossSlotCard
                boss={boss}
                slotIndex={slotIdx}
                pcName={pc.name}
                isGM={isGM}
                onToggle={() => onToggleBossSlot(slotIdx)}
                onUpdateHP={(cur, max) => onUpdateHP(boss.id, cur, max)}
              />
            </div>
          ) : isGM ? (
            <div className="ml-6 border-l-2 border-codex-border/30 pl-2.5">
              <p className="text-[10px] text-codex-muted italic py-1.5">
                No boss designated — switch to Standard or add a monster ⚔
              </p>
            </div>
          ) : null}
        </div>
      ))}

      {/* Non-boss monsters (shouldn't normally exist in legendary mode) */}
      {sideMonsters.length > 0 && (
        <>
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-codex-border" />
            <span className="text-[9px] text-codex-muted uppercase tracking-widest">Other monsters</span>
            <div className="flex-1 h-px bg-codex-border" />
          </div>
          {sideMonsters.map(c => (
            <NimbleCard
              key={c.id}
              combatant={c}
              isGM={isGM}
              isDragTarget={c.id === dropId}
              showBossToggle={isGM}
              onToggleHasGone={() => onToggleHasGone(c.id)}
              onToggleDead={() => onToggleDead(c.id)}
              onRemove={isGM ? () => onRemove(c.id) : undefined}
              onUpdateHP={(cur, max) => onUpdateHP(c.id, cur, max)}
              onToggleLegendaryBoss={() => onToggleLegendaryBoss(c.id)}
            />
          ))}
        </>
      )}
    </>
  )
}

// ─── NimbleCard ───────────────────────────────────────────────────────────────
// Shared card for PCs and standard monsters.

function NimbleCard({
  combatant: c, isGM, isDragTarget, showBossToggle,
  onToggleHasGone, onToggleDead, onRemove, onUpdateHP,
  onToggleLegendaryBoss,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  const [editHP,    setEditHP]    = useState(false)
  const [hpCurVal,  setHpCurVal]  = useState(c.hp_current)
  const [hpMaxVal,  setHpMaxVal]  = useState(c.hp_max)

  useEffect(() => {
    if (!editHP) { setHpCurVal(c.hp_current); setHpMaxVal(c.hp_max) }
  }, [c.hp_current, c.hp_max, editHP])

  const hpPct   = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0
  const lowHP   = hpPct <= 50 && !c.is_dead
  const isPC    = c.type === 'pc'

  const cardBg  = c.has_gone
    ? 'bg-codex-card/50 border-codex-border/40 opacity-70'
    : isDragTarget
      ? 'bg-codex-card border-codex-gold/50'
      : 'bg-codex-card border-codex-border hover:border-codex-border/80'

  return (
    <div
      className={`rounded-xl border transition-all ${cardBg} ${c.is_dead ? 'opacity-30' : ''}`}
      draggable={isGM && isPC}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">

        {/* Drag handle (PCs only) */}
        {isGM && isPC && (
          <span className="text-codex-muted text-xs cursor-grab active:cursor-grabbing select-none shrink-0">≡</span>
        )}

        {/* Checkbox */}
        {isGM && (
          <button
            onClick={onToggleHasGone}
            disabled={c.is_dead}
            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              c.has_gone
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-codex-border hover:border-emerald-500/60'
            } ${c.is_dead ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            title={c.has_gone ? 'Mark as not gone' : 'Mark as gone'}
          >
            {c.has_gone && <span className="text-[9px] font-bold">✓</span>}
          </button>
        )}

        {/* Gone indicator for players */}
        {!isGM && (
          <span className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
            c.has_gone
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'border-codex-border/40'
          }`}>
            {c.has_gone && <span className="text-[9px] font-bold">✓</span>}
          </span>
        )}

        {/* Type dot */}
        <span className={`shrink-0 w-2 h-2 rounded-full ${isPC ? 'bg-blue-400' : 'bg-amber-400'}`} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-medium truncate ${
              c.is_dead ? 'line-through text-codex-muted' : 'text-codex-text'
            }`}>
              {c.name}
            </span>
            {c.username && isPC && (
              <span className="text-[10px] text-codex-muted truncate">({c.username})</span>
            )}
          </div>
        </div>

        {/* HP bar + edit (monsters for GM, PCs for all) */}
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
                  className="w-10 bg-codex-bg border border-codex-gold/50 rounded px-1 text-xs text-center text-codex-text outline-none"
                  autoFocus
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
                className={`text-xs font-mono flex items-center gap-1 ${isGM ? 'hover:text-codex-gold cursor-pointer' : 'cursor-default'} ${lowHP ? 'text-red-400' : 'text-codex-subtext'}`}
              >
                <Heart size={9} />
                {c.hp_current}/{c.hp_max}
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

        {/* AC badge */}
        {c.ac != null && (
          <div className="shrink-0 flex items-center gap-0.5 text-[10px] text-codex-muted">
            <Shield size={9} />
            {c.ac}
          </div>
        )}

        {/* Boss toggle (monsters only, standard mode, GM only) */}
        {showBossToggle && isGM && (
          <button
            onClick={onToggleLegendaryBoss}
            className={`shrink-0 p-1 rounded transition-colors ${
              c.is_legendary_boss
                ? 'text-amber-400 bg-amber-500/20'
                : 'text-codex-muted hover:text-amber-400/60'
            }`}
            title="Designate as legendary boss"
          >
            <Swords size={11} />
          </button>
        )}

        {/* Skull / remove */}
        {isGM && (
          <div className="shrink-0 flex items-center gap-1">
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

// ─── BossSlotCard ─────────────────────────────────────────────────────────────
// The legendary boss card that appears after each PC. HP is shared (same boss id).

function BossSlotCard({ boss, slotIndex, pcName, isGM, onToggle, onUpdateHP }) {
  const [editHP,   setEditHP]   = useState(false)
  const [hpCurVal, setHpCurVal] = useState(boss.hp_current)
  const [hpMaxVal, setHpMaxVal] = useState(boss.hp_max)

  useEffect(() => {
    if (!editHP) { setHpCurVal(boss.hp_current); setHpMaxVal(boss.hp_max) }
  }, [boss.hp_current, boss.hp_max, editHP])

  const gone    = boss.legendary_slots_gone?.[slotIndex] ?? false
  const hpPct   = boss.hp_max > 0 ? Math.max(0, Math.min(100, (boss.hp_current / boss.hp_max) * 100)) : 0
  const lowHP   = hpPct <= 50

  return (
    <div className={`rounded-xl border transition-all ${
      gone
        ? 'bg-amber-900/5 border-amber-500/15 opacity-60'
        : 'bg-amber-900/10 border-amber-500/25'
    }`}>
      <div className="flex items-center gap-2 px-3 py-2.5">

        {/* Checkbox */}
        {isGM && (
          <button
            onClick={onToggle}
            disabled={boss.is_dead}
            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              gone
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-amber-500/40 hover:border-emerald-500/60'
            } ${boss.is_dead ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {gone && <span className="text-[9px] font-bold">✓</span>}
          </button>
        )}
        {!isGM && (
          <span className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
            gone ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'border-amber-500/30'
          }`}>
            {gone && <span className="text-[9px] font-bold">✓</span>}
          </span>
        )}

        {/* Boss icon */}
        <span className="shrink-0 text-amber-400 text-xs">⚔</span>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-semibold truncate ${boss.is_dead ? 'line-through text-codex-muted' : 'text-amber-300'}`}>
            {boss.name}
          </span>
        </div>

        {/* Shared HP — any edit here updates ALL instances */}
        {isGM && boss.hp_max > 0 && (
          <div className="shrink-0 flex flex-col items-end gap-1 min-w-[90px]">
            {editHP ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={hpCurVal}
                  onChange={e => setHpCurVal(e.target.value)}
                  onBlur={() => { setEditHP(false); onUpdateHP(hpCurVal, hpMaxVal) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  className="w-10 bg-codex-bg border border-amber-500/50 rounded px-1 text-xs text-center text-codex-text outline-none"
                  autoFocus
                />
                <span className="text-[10px] text-codex-muted">/</span>
                <input
                  type="number"
                  value={hpMaxVal}
                  onChange={e => setHpMaxVal(e.target.value)}
                  onBlur={() => { setEditHP(false); onUpdateHP(hpCurVal, hpMaxVal) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  className="w-10 bg-codex-bg border border-amber-500/50 rounded px-1 text-xs text-center text-codex-text outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => isGM && setEditHP(true)}
                className={`text-xs font-mono flex items-center gap-1 cursor-pointer ${lowHP ? 'text-red-400' : 'text-amber-400/80 hover:text-amber-300'}`}
              >
                <Heart size={9} />
                {boss.hp_current}/{boss.hp_max}
              </button>
            )}
            <div className="w-24 h-1 bg-codex-bg rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${hpColor(hpPct)}`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>
        )}

        {!isGM && boss.hp_max > 0 && (
          <div className="shrink-0 flex flex-col items-end gap-1 min-w-[80px]">
            <span className={`text-xs font-mono ${lowHP ? 'text-red-400' : 'text-amber-400/70'}`}>
              {boss.hp_current}/{boss.hp_max}
            </span>
            <div className="w-20 h-1 bg-codex-bg rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${hpColor(hpPct)}`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>
        )}

        {boss.ac != null && (
          <span className="shrink-0 text-[10px] text-codex-muted flex items-center gap-0.5">
            <Shield size={9} /> {boss.ac}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── LegendaryBossPanel ───────────────────────────────────────────────────────
// Right-panel summary for the legendary boss.

function LegendaryBossPanel({ boss }) {
  const hpPct = boss.hp_max > 0 ? Math.max(0, Math.min(100, (boss.hp_current / boss.hp_max) * 100)) : 0
  const slotsDone = (boss.legendary_slots_gone ?? []).filter(Boolean).length
  const slotsTotal = boss.legendary_slots_gone?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">⚔</span>
          <div>
            <p className="text-sm font-bold text-amber-300">{boss.name}</p>
            <p className="text-[10px] text-amber-500/70 uppercase tracking-wider">Legendary Boss</p>
          </div>
        </div>

        {/* HP bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-codex-muted flex items-center gap-1"><Heart size={10}/> HP</span>
            <span className={`font-mono font-bold ${hpPct <= 25 ? 'text-red-400' : hpPct <= 50 ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {boss.hp_current} / {boss.hp_max}
            </span>
          </div>
          <div className="w-full h-2 bg-codex-bg rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${hpColor(hpPct)}`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        {/* AC */}
        {boss.ac != null && (
          <div className="flex items-center gap-2 text-xs text-codex-subtext">
            <Shield size={11} />
            <span>Armor Class <span className="font-semibold text-codex-text">{boss.ac}</span></span>
          </div>
        )}

        {/* Turn progress */}
        {slotsTotal > 0 && (
          <div className="flex items-center gap-2 text-xs text-codex-subtext">
            <AlertTriangle size={11} className="text-amber-500/70" />
            <span>
              Acted <span className="font-semibold text-amber-400">{slotsDone}</span> / {slotsTotal} this round
            </span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-codex-muted leading-relaxed">
        HP changes on any card immediately sync across all boss turns this round.
      </p>
    </div>
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ label, count }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[9px] font-semibold text-codex-muted uppercase tracking-widest">{label}</span>
      <span className="text-[9px] text-codex-muted/50">({count})</span>
    </div>
  )
}
