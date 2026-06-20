/**
 * CombatTracker — embedded combat panel for CampaignDetail
 *
 * Appears to the right of the Campaign Chat when a combat session is active.
 * All real-time state flows through the existing Socket.io infrastructure:
 *   GM  → REST PATCH → pushes socket 'push_combat_update'
 *   All ← socket 'combat_update' (server sanitizes monster HP for non-GMs)
 *
 * Shadowdark-specific features (only render when gameSystem === 'shadowdark'):
 *   • Death timer — countdown badge on dying PCs (1d4+CON rounds)
 *   • Morale check prompt — shown when ≥50% of initial monsters are dead/dead-toggle
 *   • Light timer — optional real-time torch countdown (1 hour default)
 *   • Surprise phase indicator
 */

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Sword, Plus, SkipForward, Skull, RefreshCw,
  Heart, Shield, X, ChevronUp, ChevronDown, Wifi, WifiOff,
  AlertTriangle, Clock, Zap, BookOpen,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { api } from '../../utils/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function d20() { return Math.floor(Math.random() * 20) + 1 }
function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

function hpColor(pct) {
  if (pct > 60) return 'bg-emerald-500'
  if (pct > 30) return 'bg-yellow-400'
  return 'bg-red-500'
}

function hpLabelColor(label) {
  switch (label) {
    case 'Healthy':    return 'text-emerald-400'
    case 'Bloodied':   return 'text-yellow-400'
    case 'Near Death': return 'text-orange-400'
    case 'Dying':      return 'text-red-400'
    case 'Dead':       return 'text-codex-muted line-through'
    default:           return 'text-codex-subtext'
  }
}

function calcDexMod(dex) {
  if (dex == null || isNaN(Number(dex))) return 0
  return Math.floor((Number(dex) - 10) / 2)
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CombatTracker = forwardRef(function CombatTracker({ campaignId, isGM, gameSystem, onActiveChange }, ref) {
  const { user }              = useAuth()
  const { socket, connected } = useSocket()

  const [session,      setSession]      = useState(null)
  const [combatants,   setCombatants]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [liveConn,     setLiveConn]     = useState(false)

  // Shadowdark extras
  const [moraleTriggered,  setMoraleTriggered]  = useState(false)
  const [moraleDismissed,  setMoraleDismissed]  = useState(false)
  const [initMonsterCount, setInitMonsterCount] = useState(0)
  // Drag-and-drop reordering
  const [dragId, setDragId] = useState(null)
  const [dropId, setDropId] = useState(null)

  // Bestiary picker (add monster mid-combat)
  const [showBestiaryPicker, setShowBestiaryPicker] = useState(false)
  const [bestiaryMonsters,   setBestiaryMonsters]   = useState([])
  const [bestiaryLoading,    setBestiaryLoading]    = useState(false)
  const [bestiarySearch,     setBestiarySearch]     = useState('')
  // Stat block popup (click monster name to view stats)
  const [statPopup, setStatPopup] = useState(null) // { combatant, statData, loading }

  const isSD = gameSystem === 'shadowdark'
  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])
  const combatantsRef = useRef(combatants)
  useEffect(() => { combatantsRef.current = combatants }, [combatants])

  // ── Load initial session ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    api.get(`/combat/${campaignId}/active`)
      .then(({ session: s }) => {
        if (!mounted) return
        const c = s.combatants ?? []
        setSession(s)
        setCombatants(c)
        onActiveChange?.(true, s)
        const monsters = c.filter(x => x.type !== 'pc')
        setInitMonsterCount(monsters.length)
      })
      .catch(() => {
        if (!mounted) return
        setSession(null)
        setCombatants([])
        onActiveChange?.(false, null)
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [campaignId]) // eslint-disable-line

  // ── Socket: join combat room ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected) return

    socket.emit('join_combat', { campaignId }, ({ ok, error: err, session: initSession }) => {
      if (err) { console.error('[CombatTracker socket]', err); return }
      setLiveConn(true)
      // Hydrate from socket if REST missed an active session
      if (initSession && !sessionRef.current) {
        const c = initSession.combatants ?? []
        setSession(initSession)
        setCombatants(c)
        onActiveChange?.(true, initSession)
        const monsters = c.filter(x => x.type !== 'pc')
        setInitMonsterCount(monsters.length)
      }
    })

    function onCombatUpdate({ combatants: updated, roundNumber, eventType }) {
      if (eventType === 'started') {
        api.get(`/combat/${campaignId}/active`)
          .then(({ session: s }) => {
            const c = s.combatants ?? []
            setSession(s)
            setCombatants(c)
            setMoraleTriggered(false)
            setMoraleDismissed(false)
            onActiveChange?.(true, s)
            const monsters = c.filter(x => x.type !== 'pc')
            setInitMonsterCount(monsters.length)
          })
          .catch(() => {})
        return
      }
      if (eventType === 'ended') {
        setSession(null)
        setCombatants([])
        onActiveChange?.(false, null)
        return
      }
      if (updated !== undefined) setCombatants(updated)
      if (roundNumber !== undefined) {
        setSession(prev => prev ? { ...prev, round_number: roundNumber } : prev)
      }
    }

    socket.on('combat_update', onCombatUpdate)
    return () => {
      socket.off('combat_update', onCombatUpdate)
      socket.emit('leave_combat', { campaignId })
      setLiveConn(false)
    }
  }, [socket, connected, campaignId]) // eslint-disable-line

  // ── Expose startCombat to parent via ref ─────────────────────────────────────
  useImperativeHandle(ref, () => ({ startCombat }), [startCombat]) // eslint-disable-line

  // ── Morale check monitor (Shadowdark) ────────────────────────────────────────
  useEffect(() => {
    if (!isSD || initMonsterCount === 0 || moraleDismissed) return
    const dead = combatants.filter(c => c.type !== 'pc' && c.is_dead).length
    if (dead >= Math.ceil(initMonsterCount / 2)) {
      setMoraleTriggered(true)
    }
  }, [combatants, isSD, initMonsterCount, moraleDismissed])

  // ── Push update to DB + broadcast ────────────────────────────────────────────
  const pushUpdate = useCallback(async (newCombatants, newRound, eventType = 'update') => {
    const s = sessionRef.current
    if (!s || !isGM) return
    setSaving(true)
    try {
      const { session: saved } = await api.patch(`/combat/${s.id}`, {
        combatants:   newCombatants,
        round_number: newRound ?? s.round_number,
      })
      setSession(saved)
      if (socket && connected) {
        socket.emit('push_combat_update', {
          campaignId,
          combatants:  saved.combatants ?? newCombatants,
          roundNumber: saved.round_number,
          eventType,
          phase:       saved.phase ?? 'active',
          activeIndex: (saved.combatants ?? newCombatants).findIndex(c => c.is_active_turn),
        })
      }
    } catch (err) {
      console.error('[CombatTracker] push failed:', err)
    } finally {
      setSaving(false)
    }
  }, [isGM, socket, connected, campaignId])

  // ── Start combat ─────────────────────────────────────────────────────────────
  // NOTE: must remain a `function` declaration (not const/useCallback) so it is
  // hoisted and accessible by the useImperativeHandle call above without hitting
  // the temporal dead zone.
  async function startCombat(opts = {}) {
    const payload = { campaignId }
    if (opts.encounterId) payload.encounterId = opts.encounterId
    const { session: s } = await api.post('/combat/start', payload)
    const c = s.combatants ?? []
    setSession(s)
    setCombatants(c)
    setMoraleTriggered(false)
    setMoraleDismissed(false)
    onActiveChange?.(true, s)
    const monsters = c.filter(x => x.type !== 'pc')
    setInitMonsterCount(monsters.length)
    if (socket && connected) {
      socket.emit('push_combat_update', {
        campaignId, combatants: c, roundNumber: 1, eventType: 'started',
      })
    }
  }

  // ── End combat ───────────────────────────────────────────────────────────────
  async function endCombat() {
    if (!session) return
    if (!confirm('End this combat session? This cannot be undone.')) return
    await api.post(`/combat/${session.id}/end`)
    setSession(null)
    setCombatants([])
    setShowBestiaryPicker(false)
    setStatPopup(null)
    onActiveChange?.(false, null)
    if (socket && connected) {
      socket.emit('push_combat_update', {
        campaignId, combatants: [], roundNumber: 1, eventType: 'ended',
      })
    }
  }

  // ── Add NPC on the fly ───────────────────────────────────────────────────────
  function addNPC() {
    const next = [...combatantsRef.current, {
      id: crypto.randomUUID(), type: 'npc', name: 'Enemy',
      hp_current: 10, hp_max: 10, ac: 12, dex_mod: 0,
      initiative: null, conditions: [], is_active_turn: false, is_dead: false, notes: '',
    }]
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Add from bestiary mid-combat ─────────────────────────────────────────────
  async function openBestiaryPicker() {
    setShowBestiaryPicker(true)
    setBestiarySearch('')
    setBestiaryLoading(true)
    try {
      const { monsters } = await api.get(`/bestiary?system=${gameSystem}`)
      setBestiaryMonsters(monsters ?? [])
    } catch {
      setBestiaryMonsters([])
    } finally {
      setBestiaryLoading(false)
    }
  }

  function addFromBestiary(monster) {
    const sd = monster.stat_data ?? {}
    const next = [...combatantsRef.current, {
      id:           crypto.randomUUID(),
      type:         'monster',
      name:         monster.name,
      hp_current:   sd.hp  ?? 10,
      hp_max:       sd.hp  ?? 10,
      ac:           sd.ac  ?? 12,
      dex_mod:      calcDexMod(sd.stats?.dex),
      initiative:   null,
      conditions:   [], is_active_turn: false, is_dead: false, notes: '',
      monsterId:    monster.id,
      statData:     sd,
    }]
    setCombatants(next)
    pushUpdate(next)
    setShowBestiaryPicker(false)
    setBestiarySearch('')
  }

  // ── Stat block popup (single-click monster name) ──────────────────────────────
  async function openStatPopup(combatant) {
    // Already have stat data in memory — show immediately
    if (combatant.statData && Object.keys(combatant.statData).length) {
      setStatPopup({ combatant, statData: combatant.statData, loading: false })
      return
    }
    // Fetch from bestiary by monsterId
    if (combatant.monsterId) {
      setStatPopup({ combatant, statData: null, loading: true })
      try {
        const { monster } = await api.get(`/bestiary/${combatant.monsterId}`)
        setStatPopup({ combatant, statData: monster.stat_data ?? {}, loading: false })
      } catch {
        setStatPopup(null)
      }
    }
  }

  // ── Roll initiative (d20 + dex_mod, sort descending) ────────────────────────
  function rollAllInitiative() {
    const next = clone(combatantsRef.current).map(c => {
      const roll = d20()
      const total = roll + (c.dex_mod ?? 0)
      return { ...c, initiative_roll: roll, initiative: total }
    }).sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
    if (next.length > 0) { next[0].is_active_turn = true }
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Next turn ────────────────────────────────────────────────────────────────
  function nextTurn() {
    const next = clone(combatantsRef.current)
    const livings = next.filter(c => !c.is_dead)
    if (livings.length === 0) return
    const cur = next.findIndex(c => c.is_active_turn)
    if (cur >= 0) next[cur].is_active_turn = false

    // Skip dead combatants — find next living
    let ni = cur >= 0 ? (cur + 1) % next.length : 0
    const start = ni
    while (next[ni].is_dead) {
      ni = (ni + 1) % next.length
      if (ni === start) break
    }
    next[ni].is_active_turn = true

    // Decrement death timers for dying PCs on their turn (Shadowdark)
    if (isSD && next[ni].type === 'pc' && next[ni].conditions?.includes('dying') && next[ni].death_timer != null) {
      next[ni].death_timer = Math.max(0, next[ni].death_timer - 1)
      if (next[ni].death_timer === 0 && !next[ni].is_stabilized) {
        next[ni].is_dead = true
        next[ni].conditions = [...(next[ni].conditions ?? []).filter(c => c !== 'dying'), 'Dead']
      }
    }

    const wrapped = ni < cur
    const newRound = wrapped ? (sessionRef.current?.round_number ?? 1) + 1 : undefined
    setCombatants(next)
    pushUpdate(next, newRound)
  }

  // ── Toggle dead ──────────────────────────────────────────────────────────────
  function toggleDead(idx) {
    const next = clone(combatantsRef.current)
    next[idx].is_dead = !next[idx].is_dead
    if (next[idx].is_dead) {
      if (!next[idx].conditions.includes('Dead')) next[idx].conditions.push('Dead')
      next[idx].conditions = next[idx].conditions.filter(c => c !== 'dying')
      if (next[idx].is_active_turn) {
        next[idx].is_active_turn = false
        const livings = next.filter(c => !c.is_dead)
        if (livings.length > 0) livings[0].is_active_turn = true
      }
    } else {
      next[idx].conditions = next[idx].conditions.filter(c => c !== 'Dead')
    }
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Update HP ────────────────────────────────────────────────────────────────
  function adjustHP(idx, delta) {
    const next = clone(combatantsRef.current)
    const c = next[idx]
    c.hp_current = Math.max(0, Math.min(c.hp_max, (c.hp_current ?? 0) + delta))
    // Shadowdark: 0 HP = dying for PCs
    if (isSD && c.type === 'pc' && c.hp_current <= 0 && !c.is_dead && !c.is_stabilized) {
      if (!c.conditions.includes('dying')) c.conditions.push('dying')
    }
    setCombatants(next)
    pushUpdate(next)
  }

  function setHP(idx, val) {
    const next = clone(combatantsRef.current)
    const parsed = parseInt(val, 10)
    if (isNaN(parsed)) return
    next[idx].hp_current = Math.max(0, Math.min(next[idx].hp_max, parsed))
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Set death timer (Shadowdark) ─────────────────────────────────────────────
  function setDeathTimer(idx, val) {
    const next = clone(combatantsRef.current)
    next[idx].death_timer = val === '' || val === null ? null : Math.max(0, parseInt(val, 10) || 0)
    setCombatants(next)
    pushUpdate(next)
  }

  function stabilize(idx) {
    const next = clone(combatantsRef.current)
    next[idx].is_stabilized = true
    next[idx].death_timer   = null
    next[idx].conditions    = next[idx].conditions.filter(c => c !== 'dying')
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Update name / hp_max / ac inline (double-click edit) ────────────────────
  function updateField(idx, fields) {
    const next = clone(combatantsRef.current)
    Object.assign(next[idx], fields)
    if (fields.hp_max !== undefined) {
      next[idx].hp_max     = Math.max(1, Number(fields.hp_max) || 1)
      next[idx].hp_current = Math.min(next[idx].hp_current, next[idx].hp_max)
    }
    if (fields.ac !== undefined) {
      next[idx].ac = Math.max(0, Math.min(30, Number(fields.ac) || 0))
    }
    if (fields.name !== undefined) {
      next[idx].name = fields.name.trim() || next[idx].name
    }
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Drag-and-drop reordering ─────────────────────────────────────────────────
  // Uses HTML5 drag API. GM drags the ≡ handle; release reorders the combatants
  // array and pushes to DB. Array order = turn order in Shadowdark (no initiative sort).
  function handleDragStart(id) { setDragId(id) }
  function handleDragOver(id)  { if (id !== dragId) setDropId(id) }
  function handleDrop(dropCombatantId) {
    if (!dragId || dragId === dropCombatantId) { setDragId(null); setDropId(null); return }
    const arr   = clone(combatantsRef.current)
    const from  = arr.findIndex(c => c.id === dragId)
    const [moved] = arr.splice(from, 1)
    const to    = arr.findIndex(c => c.id === dropCombatantId)
    arr.splice(to, 0, moved)
    setCombatants(arr)
    pushUpdate(arr)
    setDragId(null)
    setDropId(null)
  }
  function handleDragEnd() { setDragId(null); setDropId(null) }

  // ─────────────────────────────────────────────────────────────────────────────

  // Sort combatants.
  // When ALL living combatants have initiative set → sort by initiative (D&D style).
  // When ANY are null → honour the GM's drag-and-drop array order (Shadowdark side-initiative).
  // Dead combatants always sink to the bottom regardless.
  const allHaveInitiative = combatants.filter(c => !c.is_dead).every(c => c.initiative != null)
  const sorted = [...combatants].sort((a, b) => {
    if (a.is_dead && !b.is_dead) return 1
    if (!a.is_dead && b.is_dead) return -1
    if (!allHaveInitiative) return 0  // preserve insertion order
    return (b.initiative ?? -999) - (a.initiative ?? -999)
  })

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <TrackerShell gameSystem={gameSystem}>
        <div className="flex-1 flex items-center justify-center text-codex-muted text-xs animate-pulse">
          Loading…
        </div>
      </TrackerShell>
    )
  }

  // ── Render: no active session ────────────────────────────────────────────────
  if (!session) {
    return (
      <TrackerShell gameSystem={gameSystem} liveConn={liveConn}>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <Sword size={28} className="text-codex-border" />
          {isGM ? (
            <>
              <p className="text-xs text-codex-subtext">No active encounter.</p>
              <p className="text-xs text-codex-muted">Use "Start Encounter" above to begin.</p>
            </>
          ) : (
            <>
              <p className="text-xs text-codex-subtext">No combat active.</p>
              <div className={`flex items-center gap-1.5 text-xs mt-1 ${liveConn ? 'text-emerald-400' : 'text-codex-muted'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${liveConn ? 'bg-emerald-400 animate-pulse' : 'bg-codex-muted'}`} />
                {liveConn ? 'Watching for GM to start…' : 'Connecting…'}
              </div>
            </>
          )}
        </div>
      </TrackerShell>
    )
  }

  // ── Render: active combat ────────────────────────────────────────────────────
  return (
    <TrackerShell gameSystem={gameSystem} liveConn={liveConn}>
      {/* Controls bar (GM only) */}
      {isGM && (
        <div className="flex items-center gap-1.5 flex-wrap shrink-0 p-2 border-b border-codex-border bg-codex-bg/30">
          <button onClick={rollAllInitiative} className="tracker-btn">
            <RefreshCw size={10} /> Init
          </button>
          <button onClick={nextTurn} className="tracker-btn-gold">
            <SkipForward size={10} /> Next
          </button>
          <button onClick={addNPC} className="tracker-btn">
            <Plus size={10} /> NPC
          </button>
          <button onClick={openBestiaryPicker} className="tracker-btn">
            <BookOpen size={10} /> Bestiary
          </button>
          <button onClick={endCombat} className="tracker-btn text-red-400 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10 ml-auto">
            <Skull size={10} /> End
          </button>
        </div>
      )}

      {/* Round + save indicator */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-codex-border/50">
        <span className="text-xs font-semibold text-codex-gold font-mono">
          Round {session.round_number ?? 1}
        </span>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-codex-muted animate-pulse">Syncing…</span>}
          <span className={`flex items-center gap-1 text-[10px] ${liveConn ? 'text-emerald-400' : 'text-codex-muted'}`}>
            {liveConn ? <Wifi size={9} /> : <WifiOff size={9} />}
          </span>
        </div>
      </div>

      {/* Morale check banner (Shadowdark, GM only) */}
      {isSD && isGM && moraleTriggered && !moraleDismissed && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400 font-medium">
              Morale Check! ≥50% casualties — DC 15 WIS
            </span>
          </div>
          <button
            onClick={() => setMoraleDismissed(true)}
            className="text-codex-muted hover:text-codex-text shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Combatant list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-codex-muted text-center px-4 gap-2">
            <p>No combatants yet.</p>
            {isGM && <p className="text-[10px]">Party loads automatically. Add monsters via "+ NPC", "Bestiary", or start an encounter.</p>}
          </div>
        ) : (
          sorted.map((c, sortedIdx) => {
            // Find original index for mutations
            const origIdx = combatants.findIndex(x => x.id === c.id)
            return (
              <CombatantRow
                key={c.id}
                combatant={c}
                isGM={isGM}
                isSD={isSD}
                isDragTarget={dropId === c.id}
                isDragging={dragId === c.id}
                onAdjustHP={delta => adjustHP(origIdx, delta)}
                onSetHP={val => setHP(origIdx, val)}
                onToggleDead={() => toggleDead(origIdx)}
                onSetDeathTimer={val => setDeathTimer(origIdx, val)}
                onStabilize={() => stabilize(origIdx)}
                onUpdateField={fields => updateField(origIdx, fields)}
                onDragStart={() => handleDragStart(c.id)}
                onDragOver={() => handleDragOver(c.id)}
                onDrop={() => handleDrop(c.id)}
                onDragEnd={handleDragEnd}
                onOpenPopup={c.type !== 'pc' && (c.monsterId || c.statData) ? () => openStatPopup(c) : undefined}
              />
            )
          })
        )}
      </div>

      {/* Bestiary picker — fixed overlay, position:fixed bypasses overflow-hidden */}
      {showBestiaryPicker && (
        <BestiaryPickerModal
          monsters={bestiaryMonsters}
          loading={bestiaryLoading}
          search={bestiarySearch}
          onSearch={setBestiarySearch}
          onAdd={addFromBestiary}
          onClose={() => setShowBestiaryPicker(false)}
          gameSystem={gameSystem}
        />
      )}

      {/* Stat block popup — fixed overlay */}
      {statPopup && (
        <StatBlockPopup popup={statPopup} onClose={() => setStatPopup(null)} />
      )}
    </TrackerShell>
  )
})

export default CombatTracker

// ─── TrackerShell ─────────────────────────────────────────────────────────────
function TrackerShell({ children, gameSystem, liveConn }) {
  const label = { shadowdark: 'Shadowdark', morkborg: 'Mörk Borg', nimble: 'Nimble RPG' }[gameSystem] ?? ''
  return (
    <div className="flex flex-col h-full bg-codex-surface border border-codex-border rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-codex-border shrink-0">
        <Sword size={13} className="text-codex-gold" />
        <span className="text-sm font-semibold text-codex-text">Combat</span>
        {label && (
          <span className="text-[10px] text-codex-muted">· {label}</span>
        )}
        {liveConn !== undefined && (
          <span className={`ml-auto flex items-center gap-1 text-[10px] ${liveConn ? 'text-emerald-400' : 'text-codex-muted animate-pulse'}`}>
            {liveConn ? <Wifi size={9} /> : <WifiOff size={9} />}
            {liveConn ? 'Live' : 'Connecting…'}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── CombatantRow ─────────────────────────────────────────────────────────────
function CombatantRow({ combatant: c, isGM, isSD, isDragTarget, isDragging,
  onAdjustHP, onSetHP, onToggleDead, onSetDeathTimer, onStabilize, onUpdateField,
  onDragStart, onDragOver, onDrop, onDragEnd, onOpenPopup }) {
  const [editHP,     setEditHP]     = useState(false)
  const [hpInput,    setHPInput]    = useState('')
  const hpRef = useRef(null)

  // Double-click-to-edit fields (GM only)
  const [editName,   setEditName]   = useState(false)
  const [nameInput,  setNameInput]  = useState('')

  // Single-click on name → stat popup; double-click → rename (GM)
  // 220 ms delay lets us distinguish single from double without jitter
  const clickTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(clickTimerRef.current), [])
  function handleNameClick() {
    if (!onOpenPopup) return
    clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => onOpenPopup(), 220)
  }
  function handleNameDoubleClick() {
    clearTimeout(clickTimerRef.current)
    if (isGM) { setNameInput(c.name); setEditName(true) }
  }
  const [editMaxHP,  setEditMaxHP]  = useState(false)
  const [maxHPInput, setMaxHPInput] = useState('')
  const [editAC,     setEditAC]     = useState(false)
  const [acInput,    setACInput]    = useState('')

  function commitName()  { onUpdateField?.({ name: nameInput });          setEditName(false)  }
  function commitMaxHP() { onUpdateField?.({ hp_max: maxHPInput });       setEditMaxHP(false) }
  function commitAC()    { onUpdateField?.({ ac: acInput });              setEditAC(false)    }

  function fieldKeyDown(e, commit, cancel) {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') cancel()
  }

  const isPC      = c.type === 'pc'
  const isMonster = !isPC
  const isDead    = c.is_dead
  const isDying   = isSD && isPC && (c.conditions ?? []).includes('dying') && !c.is_stabilized
  const hpPct     = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0

  return (
    <div
      draggable={isGM}
      onDragStart={isGM ? e => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.() } : undefined}
      onDragOver={isGM ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver?.() } : undefined}
      onDrop={isGM ? e => { e.preventDefault(); onDrop?.() } : undefined}
      onDragEnd={isGM ? onDragEnd : undefined}
      className={`relative border-b border-codex-border/40 transition-all select-none
        ${c.is_active_turn ? 'bg-codex-gold/5 border-l-2 border-l-codex-gold' : 'border-l-2 border-l-transparent'}
        ${isDead ? 'opacity-40' : ''}
        ${isDragging ? 'opacity-30 scale-95' : ''}
        ${isDragTarget && !isDead ? 'border-t-2 border-t-codex-gold/60' : ''}
      `}
    >
      {/* Dead overlay — X mark */}
      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-full h-0.5 bg-red-500/40 absolute rotate-12" />
          <div className="w-full h-0.5 bg-red-500/40 absolute -rotate-12" />
        </div>
      )}

      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Drag handle — only for GM; cursor grab */}
        {isGM && (
          <div className="shrink-0 cursor-grab active:cursor-grabbing text-codex-border hover:text-codex-muted transition-colors" title="Drag to reorder">
            <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
              <circle cx="2" cy="2"  r="1.2"/><circle cx="6" cy="2"  r="1.2"/>
              <circle cx="2" cy="7"  r="1.2"/><circle cx="6" cy="7"  r="1.2"/>
              <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
            </svg>
          </div>
        )}
        {/* Initiative badge */}
        <div className="shrink-0 w-7 text-center">
          <span className={`text-xs font-mono font-bold ${c.is_active_turn ? 'text-codex-gold' : 'text-codex-muted'}`}>
            {c.initiative ?? '—'}
          </span>
        </div>

        {/* Type badge */}
        <div className="shrink-0">
          {isPC
            ? <span className="text-[9px] border border-blue-400/40 text-blue-400 rounded px-1">PC</span>
            : <span className="text-[9px] border border-red-400/40 text-red-400 rounded px-1">
                {c.type === 'monster' ? 'MON' : 'NPC'}
              </span>
          }
        </div>

        {/* Name + username */}
        <div className="flex-1 min-w-0">
          {isGM && editName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => fieldKeyDown(e, commitName, () => setEditName(false))}
              maxLength={60}
              className="w-full bg-transparent border-b border-codex-gold/60 text-xs font-medium text-codex-gold outline-none pb-0.5 leading-tight"
            />
          ) : (
            <p
              className={`text-xs font-medium truncate
                ${c.is_active_turn ? 'text-codex-gold' : 'text-codex-text'}
                ${onOpenPopup
                  ? 'cursor-pointer underline decoration-dotted underline-offset-2 hover:text-codex-gold'
                  : isGM ? 'cursor-text' : ''}`}
              onClick={handleNameClick}
              onDoubleClick={handleNameDoubleClick}
              title={onOpenPopup ? 'Click to view stat block · Double-click to rename' : isGM ? 'Double-click to rename' : undefined}
            >
              {c.name}
            </p>
          )}
          {c.username && (
            <p className="text-[10px] text-codex-muted truncate">{c.username}</p>
          )}
          {/* Death timer badge (Shadowdark dying PCs) */}
          {isDying && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-red-400 font-medium animate-pulse">
                ☠ {c.death_timer != null ? `${c.death_timer} rd${c.death_timer !== 1 ? 's' : ''}` : 'DYING'}
              </span>
              {isGM && c.death_timer != null && (
                <>
                  <button onClick={() => onSetDeathTimer(c.death_timer - 1)} className="text-[9px] text-red-400/70 hover:text-red-300 px-1 border border-red-500/20 rounded">−</button>
                  <button onClick={() => onSetDeathTimer(c.death_timer + 1)} className="text-[9px] text-codex-muted hover:text-codex-subtext px-1 border border-codex-border rounded">+</button>
                  <button onClick={onStabilize} className="text-[9px] text-emerald-400/70 hover:text-emerald-300 px-1.5 border border-emerald-500/20 rounded">Stabilize</button>
                </>
              )}
              {isGM && c.death_timer == null && (
                <button onClick={() => onSetDeathTimer(3)} className="text-[9px] text-red-400/70 hover:text-red-300 px-1.5 border border-red-500/20 rounded">Set timer</button>
              )}
            </div>
          )}
        </div>

        {/* HP section */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {isPC ? (
            /* PC — always show HP numbers */
            isGM ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onAdjustHP(-1)} className="text-[10px] text-red-400/70 hover:text-red-300 w-4 h-4 border border-red-500/20 rounded flex items-center justify-center">−</button>
                {editHP ? (
                  <input
                    ref={hpRef}
                    type="number"
                    value={hpInput}
                    onChange={e => setHPInput(e.target.value)}
                    onBlur={() => { onSetHP(hpInput); setEditHP(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') { onSetHP(hpInput); setEditHP(false) } }}
                    className="w-10 text-center bg-codex-bg border border-codex-gold/50 rounded text-xs text-codex-text focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="flex items-baseline gap-0 font-mono min-w-[36px] justify-center">
                    <button
                      onClick={() => { setEditHP(true); setHPInput(String(c.hp_current)) }}
                      className="text-xs text-codex-text hover:text-codex-gold transition-colors"
                    >
                      {c.hp_current}
                    </button>
                    {editMaxHP ? (
                      <input
                        autoFocus
                        value={maxHPInput}
                        onChange={e => setMaxHPInput(e.target.value)}
                        onBlur={commitMaxHP}
                        onKeyDown={e => fieldKeyDown(e, commitMaxHP, () => setEditMaxHP(false))}
                        type="number"
                        className="w-7 bg-transparent border-b border-codex-gold/60 text-[10px] text-codex-gold outline-none text-center ml-px"
                      />
                    ) : (
                      <span
                        className="text-codex-muted text-[10px] cursor-text"
                        onDoubleClick={() => { setMaxHPInput(String(c.hp_max)); setEditMaxHP(true) }}
                        title="Double-click to change max HP"
                      >/{c.hp_max}</span>
                    )}
                  </span>
                )}
                <button onClick={() => onAdjustHP(1)} className="text-[10px] text-emerald-400/70 hover:text-emerald-300 w-4 h-4 border border-emerald-500/20 rounded flex items-center justify-center">+</button>
              </div>
            ) : (
              <span className="text-xs font-mono text-codex-text">
                {c.hp_current}<span className="text-codex-muted">/{c.hp_max}</span>
              </span>
            )
          ) : (
            /* Monster/NPC — GM sees HP controls, players see label/bar */
            isGM ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onAdjustHP(-1)} className="text-[10px] text-red-400/70 hover:text-red-300 w-4 h-4 border border-red-500/20 rounded flex items-center justify-center">−</button>
                {editHP ? (
                  <input
                    ref={hpRef}
                    type="number"
                    value={hpInput}
                    onChange={e => setHPInput(e.target.value)}
                    onBlur={() => { onSetHP(hpInput); setEditHP(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') { onSetHP(hpInput); setEditHP(false) } }}
                    className="w-10 text-center bg-codex-bg border border-codex-gold/50 rounded text-xs text-codex-text focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="flex items-baseline gap-0 font-mono min-w-[36px] justify-center">
                    <button
                      onClick={() => { setEditHP(true); setHPInput(String(c.hp_current)) }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      {c.hp_current}
                    </button>
                    {editMaxHP ? (
                      <input
                        autoFocus
                        value={maxHPInput}
                        onChange={e => setMaxHPInput(e.target.value)}
                        onBlur={commitMaxHP}
                        onKeyDown={e => fieldKeyDown(e, commitMaxHP, () => setEditMaxHP(false))}
                        type="number"
                        className="w-7 bg-transparent border-b border-codex-gold/60 text-[10px] text-codex-gold outline-none text-center ml-px"
                      />
                    ) : (
                      <span
                        className="text-codex-muted text-[10px] cursor-text"
                        onDoubleClick={() => { setMaxHPInput(String(c.hp_max)); setEditMaxHP(true) }}
                        title="Double-click to change max HP"
                      >/{c.hp_max}</span>
                    )}
                  </span>
                )}
                <button onClick={() => onAdjustHP(1)} className="text-[10px] text-emerald-400/70 hover:text-emerald-300 w-4 h-4 border border-emerald-500/20 rounded flex items-center justify-center">+</button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <span className={`text-[10px] font-medium ${hpLabelColor(c.hp_label)}`}>
                  {c.hp_label ?? 'Unknown'}
                </span>
                {c.hp_label !== 'Dead' && c.hp_label !== 'Dying' && (
                  <div className="w-14 h-1 rounded-full bg-codex-bg overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      c.hp_label === 'Healthy' ? 'w-full bg-emerald-500' :
                      c.hp_label === 'Bloodied' ? 'w-1/2 bg-yellow-400' :
                      'w-1/4 bg-red-500'
                    }`} />
                  </div>
                )}
              </div>
            )
          )}

          {/* AC badge — double-click to edit (GM only) */}
          <div className="flex items-center gap-1 mt-0.5">
            <Shield size={8} className="text-codex-muted shrink-0" />
            {isGM && editAC ? (
              <input
                autoFocus
                value={acInput}
                onChange={e => setACInput(e.target.value)}
                onBlur={commitAC}
                onKeyDown={e => fieldKeyDown(e, commitAC, () => setEditAC(false))}
                type="number"
                className="w-7 bg-transparent border-b border-codex-gold/60 text-[10px] text-codex-gold outline-none text-center"
              />
            ) : (
              <span
                className={`text-[10px] text-codex-muted ${isGM ? 'cursor-text' : ''}`}
                onDoubleClick={isGM ? () => { setACInput(String(c.ac ?? 10)); setEditAC(true) } : undefined}
                title={isGM ? 'Double-click to change AC' : undefined}
              >
                {c.ac ?? '—'}
              </span>
            )}
          </div>
        </div>

        {/* Dead toggle (GM only) */}
        {isGM && (
          <button
            onClick={onToggleDead}
            title={isDead ? 'Mark as alive' : 'Mark as dead'}
            className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full border transition-all
              ${isDead
                ? 'border-red-500/60 bg-red-900/40 text-red-400 hover:bg-red-900/20'
                : 'border-codex-border text-codex-muted hover:border-red-500/40 hover:text-red-400'
              }`}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* HP bar for PCs (everyone sees) */}
      {isPC && !isDead && (
        <div className="mx-2.5 mb-1.5 h-1 rounded-full bg-codex-bg overflow-hidden">
          <div className={`h-full rounded-full transition-all ${hpColor(hpPct)}`} style={{ width: `${hpPct}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ label, val }) {
  return (
    <div className="flex flex-col items-center bg-codex-bg border border-codex-border rounded-lg px-2.5 py-1.5 min-w-[46px]">
      <span className="text-[9px] uppercase tracking-wide text-codex-muted">{label}</span>
      <span className="text-sm font-bold font-mono text-codex-text leading-tight">{val ?? '—'}</span>
    </div>
  )
}

// ─── StatBlockPopup ───────────────────────────────────────────────────────────
function StatBlockPopup({ popup, onClose }) {
  const { combatant: c, statData: sd, loading } = popup

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-codex-card border border-amber-500/20 rounded-xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
        {/* Amber accent line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-50" />

        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div>
            <h3 className="text-sm font-bold text-codex-text">{c.name}</h3>
            {!loading && sd?.combatRole && (
              <p className="text-[10px] text-codex-muted mt-0.5 capitalize">
                {sd.combatRole}{sd.level ? ` · LV ${sd.level}` : ''}
                {sd.movement ? ` · MV ${sd.movement}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-codex-muted hover:text-codex-text transition-colors shrink-0 ml-3">
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div className="px-4 pb-6 text-center text-codex-muted text-xs animate-pulse">Loading stat block…</div>
        ) : !sd || !Object.keys(sd).length ? (
          <div className="px-4 pb-6 text-center text-codex-muted text-xs">No stat data available.</div>
        ) : (
          <>
            {/* Core stat pills */}
            <div className="flex flex-wrap gap-2 px-4 pb-3 border-b border-codex-border/50">
              <StatPill label="AC"  val={sd.ac ?? c.ac} />
              <StatPill label="HP"  val={sd.hp ?? c.hp_max} />
              {sd.hitDie  && <StatPill label="HD" val={sd.hitDie} />}
            </div>

            {/* Attribute modifiers */}
            {sd.stats && (
              <div className="grid grid-cols-6 gap-1 px-4 py-3 border-b border-codex-border/50">
                {[['S', sd.stats.str], ['D', sd.stats.dex], ['C', sd.stats.con],
                  ['I', sd.stats.int], ['W', sd.stats.wis], ['Ch', sd.stats.cha]].map(([lbl, mod]) => (
                  <div key={lbl} className="flex flex-col items-center">
                    <span className="text-[9px] text-codex-muted">{lbl}</span>
                    <span className="text-xs font-mono font-semibold text-codex-text">
                      {mod != null ? (mod >= 0 ? `+${mod}` : `${mod}`) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Attacks */}
            {sd.attacks?.length > 0 && (
              <div className="px-4 py-3 border-b border-codex-border/50">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-codex-muted mb-2">Attacks</p>
                {sd.attacks.map((atk, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                    <span className="text-sm font-bold font-mono text-amber-400 shrink-0">{atk.damage || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-codex-text">
                        {atk.count > 1 ? `×${atk.count} ` : ''}{atk.weapon}
                      </span>
                      {atk.range && (
                        <span className="text-[10px] text-codex-muted ml-1.5">{atk.range}</span>
                      )}
                    </div>
                    {atk.bonus != null && atk.bonus !== 0 && (
                      <span className="text-[10px] text-codex-muted shrink-0">
                        {atk.bonus > 0 ? `+${atk.bonus}` : atk.bonus} to hit
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Talents */}
            {sd.talents?.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-codex-muted mb-2">Special Talents</p>
                {sd.talents.map((t, i) => (
                  <div key={i} className="mb-2.5 last:mb-0">
                    <p className="text-xs font-semibold text-codex-text">{t.name}</p>
                    {t.description && (
                      <p className="text-[11px] text-codex-subtext leading-relaxed mt-0.5">{t.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── BestiaryPickerModal ──────────────────────────────────────────────────────
function BestiaryPickerModal({ monsters, loading, search, onSearch, onAdd, onClose, gameSystem }) {
  const filtered = monsters.filter(m =>
    !search.trim() || m.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accentCls = {
    shadowdark: 'border-amber-500/30 text-amber-400',
    morkborg:   'border-yellow-300/30 text-yellow-300',
    nimble:     'border-emerald-400/30 text-emerald-400',
  }[gameSystem] ?? 'border-codex-gold/30 text-codex-gold'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-codex-card border border-codex-border rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-codex-gold" />
            <span className="text-sm font-semibold text-codex-text">Add from Bestiary</span>
          </div>
          <button onClick={onClose} className="text-codex-muted hover:text-codex-text transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-codex-border shrink-0">
          <input
            autoFocus
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search monsters…"
            className="w-full bg-codex-bg border border-codex-border rounded-lg px-3 py-1.5
              text-xs text-codex-text placeholder-codex-muted
              focus:outline-none focus:border-codex-gold/50 transition-colors"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-codex-muted animate-pulse">
              Loading bestiary…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-xs text-codex-muted">
              {search ? 'No monsters match.' : 'Your bestiary is empty.'}
            </div>
          ) : (
            filtered.map(m => {
              const sd = m.stat_data ?? {}
              return (
                <button
                  key={m.id}
                  onClick={() => onAdd(m)}
                  className="w-full flex items-center justify-between px-4 py-2.5
                    hover:bg-codex-surface/60 border-b border-codex-border/30
                    last:border-0 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-codex-text truncate">{m.name}</p>
                    <p className="text-[10px] text-codex-muted mt-0.5">
                      {m.challenge && `LV ${m.challenge}`}
                      {sd.hitDie && ` · HD ${sd.hitDie}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {sd.ac  != null && <span className="text-[10px] text-codex-subtext">AC {sd.ac}</span>}
                    {sd.hp  != null && <span className="text-[10px] text-codex-subtext">HP {sd.hp}</span>}
                    <Plus size={12} className={accentCls.split(' ')[1]} />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
