import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Sword, Plus, BookOpen, SkipForward, RefreshCw,
  X, Skull, Wifi, WifiOff, AlertTriangle, Heart, Shield, Crown, CheckSquare,
} from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../utils/api'
import QuickMonsterModal from '../components/combat/QuickMonsterModal'
import NimbleCombatView from '../components/combat/NimbleCombatView'
import MorkBorgCombatView from '../components/combat/MorkBorgCombatView'

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_LABEL = {
  shadowdark: 'Shadowdark',
  morkborg:   'Mörk Borg',
  nimble:     'Nimble RPG',
}

const TRACKER_BTN = `flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-codex-border
  text-codex-subtext hover:text-codex-text hover:border-codex-gold/40 transition-all`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function d20() { return Math.floor(Math.random() * 20) + 1 }
function clone(obj) { return JSON.parse(JSON.stringify(obj)) }
function calcDexMod(dex) { return Math.floor((dex - 10) / 2) }

function formatMod(mod) {
  if (mod === null || mod === undefined) return '—'
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function newNPC() {
  return {
    id:             crypto.randomUUID(),
    type:           'npc',
    seatIndex:      0,    // acts on GM's turn
    name:           'Enemy',
    hp_current:     10,
    hp_max:         10,
    ac:             12,
    dex_mod:        0,
    initiative:     null,
    conditions:     [],
    is_active_turn: false,
    is_dead:        false,
    notes:          '',
  }
}

// Insert a combatant after the GM card + all existing seat-0 combatants
// (keeps monsters grouped under the GM card in the array).
function insertAfterGMGroup(combatants, newCombatant) {
  const lastGMIdx = combatants.reduce(
    (last, c, i) => (c.seatIndex === 0 ? i : last),
    -1
  )
  const insertAt = lastGMIdx >= 0 ? lastGMIdx + 1 : 0
  const next = [...combatants]
  next.splice(insertAt, 0, newCombatant)
  return next
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-codex-bg flex flex-col">
      {children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CombatPage() {
  const { id: campaignId }    = useParams()
  const { user }              = useAuth()
  const { socket, connected } = useSocket()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [campaign, setCampaign]           = useState(null)
  const [session, setSession]             = useState(null)
  const [combatants, setCombatants]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [starting, setStarting]           = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [liveConnected, setLiveConnected] = useState(false)

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId]             = useState(null)
  const [statBlock, setStatBlock]               = useState(null)
  const [statLoading, setStatLoading]           = useState(false)
  const [showBestiary, setShowBestiary]         = useState(false)
  const [showQuickCreate, setShowQuickCreate]   = useState(false)
  const [bestiaryMonsters, setBestiaryMonsters] = useState([])
  const [bestiarySearch, setBestiarySearch]     = useState('')
  const [bestiaryLoading, setBestiaryLoading]   = useState(false)
  const [moraleWarning, setMoraleWarning]       = useState(false)
  const [moraleDismissed, setMoraleDismissed]   = useState(false)
  const [historyStack, setHistoryStack]         = useState([])
  const [initError, setInitError]               = useState('')  // missing-roll validation

  // ── Drag state ───────────────────────────────────────────────────────────────
  const [dragId, setDragId] = useState(null)
  const [dropId, setDropId] = useState(null)

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const sessionRef    = useRef(session)
  const combatantsRef = useRef(combatants)
  useEffect(() => { sessionRef.current    = session    }, [session])
  useEffect(() => { combatantsRef.current = combatants }, [combatants])

  const initialMonsterCount = useRef(0)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isGM              = campaign?.gm_user_id === user?.id
  const gameSystem        = campaign?.game_system ?? 'shadowdark'
  const selectedCombatant = combatants.find(c => c.id === selectedId) ?? null
  const activeIdx         = combatants.findIndex(c => c.is_active_turn)
  const round             = session?.round_number ?? 1

  // ── Load campaign + active session ──────────────────────────────────────────
  useEffect(() => {
    // cancelled guard — prevents state updates on unmount or when campaignId
    // changes mid-flight (navigating between two campaign combat pages).
    let cancelled = false

    async function load() {
      try {
        const { campaign: c } = await api.get(`/campaigns/${campaignId}`)
        if (cancelled) return
        setCampaign(c)
        try {
          const { session: s } = await api.get(`/combat/${campaignId}/active`)
          if (cancelled) return
          setSession(s)
          const cs = s.combatants ?? []
          setCombatants(cs)
          initialMonsterCount.current = cs.filter(c => c.type === 'monster' || c.type === 'npc').length
        } catch { /* no active session yet */ }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [campaignId])

  // ── Socket: join combat room ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected) return

    socket.emit('join_combat', { campaignId }, ({ ok, error: err }) => {
      if (err) console.error('[combat socket]', err)
      else setLiveConnected(true)
    })

    function handleCombatUpdate({ combatants: updated, roundNumber, eventType }) {
      if (eventType === 'started') {
        api.get(`/combat/${campaignId}/active`).then(({ session: s }) => {
          setSession(s)
          const cs = s.combatants ?? []
          setCombatants(cs)
          initialMonsterCount.current = cs.filter(c => c.type === 'monster' || c.type === 'npc').length
        }).catch(() => {})
        return
      }
      if (eventType === 'ended') {
        setSession(null)
        setCombatants([])
        setSelectedId(null)
        return
      }
      setCombatants(updated ?? [])
      if (roundNumber !== undefined) {
        setSession(prev => prev ? { ...prev, round_number: roundNumber } : prev)
      }
    }

    socket.on('combat_update', handleCombatUpdate)

    return () => {
      socket.off('combat_update', handleCombatUpdate)
      socket.emit('leave_combat', { campaignId })
      setLiveConnected(false)
    }
  }, [socket, connected, campaignId])

  // ── Morale check watcher ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || moraleDismissed) return
    const enemies = combatants.filter(c => c.type === 'monster' || c.type === 'npc')
    const dead    = enemies.filter(c => c.is_dead).length
    const total   = initialMonsterCount.current
    if (total > 0 && dead >= Math.ceil(total / 2)) {
      setMoraleWarning(true)
    }
  }, [combatants, session, moraleDismissed])

  // ── Stat block fetch when selection changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedCombatant) { setStatBlock(null); return }
    if (selectedCombatant.statData) { setStatBlock(selectedCombatant.statData); return }
    if (selectedCombatant.monsterId) {
      setStatLoading(true)
      api.get(`/bestiary/${selectedCombatant.monsterId}`)
        .then(({ monster }) => setStatBlock(monster?.stat_data ?? null))
        .catch(() => setStatBlock(null))
        .finally(() => setStatLoading(false))
      return
    }
    setStatBlock(null)
  // selectedCombatant?.monsterId: if the same combatant slot is reassigned to a different
  // monster (edge case: remove + re-add while still selected), the fetch must re-fire.
  }, [selectedId, selectedCombatant?.monsterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push update helper ────────────────────────────────────────────────────────
  const pushUpdate = useCallback(async (newCombatants, newRound, eventType = 'update') => {
    if (!sessionRef.current) return null
    setSaving(true)
    try {
      const { session: s } = await api.patch(`/combat/${sessionRef.current.id}`, {
        combatants:   newCombatants,
        round_number: newRound ?? sessionRef.current.round_number,
      })
      setSession(s)
      if (socket && connected) {
        socket.emit('push_combat_update', {
          campaignId,
          combatants:  s.combatants ?? newCombatants,
          roundNumber: s.round_number,
          eventType,
        })
      }
      return s
    } catch (err) {
      console.error('Combat sync error:', err)
      return null
    } finally {
      setSaving(false)
    }
  }, [socket, connected, campaignId])

  // ── Undo ─────────────────────────────────────────────────────────────────────
  function saveSnapshot() {
    setHistoryStack(prev => [...prev.slice(-9), { combatants: clone(combatants), round }])
  }

  async function handleUndo() {
    if (!historyStack.length) return
    const prev = historyStack[historyStack.length - 1]
    setHistoryStack(h => h.slice(0, -1))
    setCombatants(prev.combatants)
    await pushUpdate(prev.combatants, prev.round)
  }

  // ── Start combat ─────────────────────────────────────────────────────────────
  async function startCombat() {
    setStarting(true)
    try {
      const { session: s } = await api.post('/combat/start', { campaignId })
      setSession(s)
      const cs = s.combatants ?? []
      setCombatants(cs)
      initialMonsterCount.current = cs.filter(c => c.type === 'monster' || c.type === 'npc').length
      if (socket && connected) {
        socket.emit('push_combat_update', {
          campaignId,
          combatants:  cs,
          roundNumber: s.round_number,
          eventType:   'started',
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  // ── End combat ────────────────────────────────────────────────────────────────
  async function endCombat() {
    if (!confirm('End this combat session? This cannot be undone.')) return
    await api.post(`/combat/${session.id}/end`)
    if (socket && connected) {
      socket.emit('push_combat_update', {
        campaignId,
        combatants:  [],
        roundNumber: 1,
        eventType:   'ended',
      })
    }
    setSession(null)
    setCombatants([])
    setSelectedId(null)
  }

  // ── applyInitiativeOrder — shared core of both initiative buttons ─────────────
  // Receives combatants that already have .initiative set per combatant.
  // Groups by seatIndex, finds highest-roll seat, rebuilds clockwise order,
  // marks is_active_turn, then pushes the update.
  function applyInitiativeOrder(currentCombatants) {
    // Build seat map — one entry per unique seatIndex
    const seatMap = new Map()
    for (const c of currentCombatants) {
      const si = c.seatIndex ?? 99
      if (!seatMap.has(si)) seatMap.set(si, { seatIndex: si, roll: 0, combatants: [] })
      seatMap.get(si).combatants.push(c)
    }
    // The seat's roll = the initiative already stored on its combatants
    // (they're all the same value for monsters; for PC seats it's on the PC card)
    const seats = [...seatMap.values()].sort((a, b) => a.seatIndex - b.seatIndex)
    for (const seat of seats) {
      const rep = seat.combatants.find(c => c.type !== 'monster') ?? seat.combatants[0]
      seat.roll = Number(rep?.initiative ?? 0)
    }

    // Find the winning seat (highest roll; ties: lower seatIndex wins)
    const winner = seats.reduce((best, s) =>
      s.roll > best.roll || (s.roll === best.roll && s.seatIndex < best.seatIndex) ? s : best
    , seats[0])
    const winnerPos = seats.indexOf(winner)

    // Reorder seats clockwise starting from winner
    const orderedSeats = Array.from({ length: seats.length }, (_, i) =>
      seats[(winnerPos + i) % seats.length]
    )

    // Rebuild combatants: monsters share the GM seat but never get is_active_turn
    const rebuilt = []
    orderedSeats.forEach((seat, turnPos) => {
      seat.combatants.forEach(c => {
        rebuilt.push({
          ...c,
          initiative:     seat.roll,
          is_active_turn: turnPos === 0 && c.type !== 'monster',
        })
      })
    })
    // Safety: if nothing is active (e.g. seat 0 has only monsters), activate first card
    if (!rebuilt.some(c => c.is_active_turn)) {
      rebuilt[0] = { ...rebuilt[0], is_active_turn: true }
    }

    setCombatants(rebuilt)
    pushUpdate(rebuilt)
    setInitError('')
  }

  // ── Roll all initiative — Shadowdark seating mechanic ────────────────────────
  // Seats are ordered by seatIndex (set at combat start from join order).
  // The seat with the highest d20+DEX roll goes first; turn order then follows
  // the seating circle clockwise (i.e. ascending seatIndex, wrapping around).
  // All seat-0 combatants (GM card + monsters) roll together as one seat.
  function rollAllInitiative() {
    saveSnapshot()

    // Roll initiative for each seat, then stamp those values onto combatants
    const seatMap = new Map()
    for (const c of combatants) {
      const si = c.seatIndex ?? 99
      if (!seatMap.has(si)) seatMap.set(si, { seatIndex: si, roll: 0, combatants: [] })
      seatMap.get(si).combatants.push(c)
    }
    const seats = [...seatMap.values()].sort((a, b) => a.seatIndex - b.seatIndex)
    for (const seat of seats) {
      // PC seats use DEX mod; GM seat and monster-only seats use flat d20
      const bonusC = seat.combatants.find(c => c.type === 'pc') ?? seat.combatants[0]
      seat.roll = d20() + (bonusC?.dex_mod ?? 0)
    }

    // Stamp rolled values onto each combatant before handing off
    const stamped = combatants.map(c => {
      const si = c.seatIndex ?? 99
      return { ...c, initiative: seatMap.get(si)?.roll ?? c.initiative }
    })

    applyInitiativeOrder(stamped)
  }

  // ── Confirm manually-entered rolls — validates then delegates to applyInitiativeOrder ──
  // Seat holders = GM card (type='gm') + PC cards (type='pc').
  // Monsters share the GM seat and don't need their own roll.
  function confirmManualRolls() {
    // Identify the one combatant that "speaks for" each seat:
    //   seat 0 → the GM card (type='gm')
    //   seat N → the PC card
    const seatHolders = combatants.filter(c => c.type === 'gm' || c.type === 'pc')

    const missing = seatHolders.filter(c => {
      const v = c.initiative
      return v === null || v === undefined || String(v).trim() === ''
    })

    if (missing.length > 0) {
      const names = missing.map(c => c.name).join(', ')
      setInitError(`Missing initiative roll for: ${names}`)
      return
    }

    saveSnapshot()
    applyInitiativeOrder([...combatants])
  }

  // ── Next turn — advances by seat (seatIndex groups), not by array position ──
  // Seat 0 (GM + monsters) counts as ONE turn. When all seats have gone → new round.
  function nextTurn() {
    saveSnapshot()
    const next = clone(combatants)

    // Find the current active seat
    const activeCombatant = next.find(c => c.is_active_turn)
    const activeSeat      = activeCombatant?.seatIndex ?? 0

    // Derive the ordered list of unique seat indices from current array order
    // (this preserves the initiative-determined turn order across rounds)
    const seenSeats = []
    const seatOrder = []
    for (const c of next) {
      const si = c.seatIndex ?? 0
      if (!seenSeats.includes(si)) { seenSeats.push(si); seatOrder.push(si) }
    }

    const curPos  = seatOrder.indexOf(activeSeat)
    const nextPos = (curPos + 1) % seatOrder.length
    const nextSeat = seatOrder[nextPos]
    const newRound = nextPos === 0 ? round + 1 : undefined

    // Skip dead-only seats — if every combatant in nextSeat is dead, advance again
    let chosenSeat = nextSeat
    let safety = 0
    while (safety < seatOrder.length) {
      const seatCombatants = next.filter(c => (c.seatIndex ?? 0) === chosenSeat)
      if (seatCombatants.some(c => !c.is_dead)) break
      const p = (seatOrder.indexOf(chosenSeat) + 1) % seatOrder.length
      chosenSeat = seatOrder[p]
      safety++
    }

    // Update is_active_turn: GM card becomes active for seat 0; PC becomes active for its seat
    next.forEach(c => {
      const si = c.seatIndex ?? 0
      if (si !== chosenSeat) { c.is_active_turn = false; return }
      // Within seat 0: only the GM card is "active" (represents the whole group)
      if (si === 0) {
        c.is_active_turn = c.type === 'gm'
      } else {
        c.is_active_turn = true
      }
    })

    setCombatants(next)
    pushUpdate(next, newRound)
  }

  // ── HP update ─────────────────────────────────────────────────────────────────
  async function updateHP(id, hpCurrent, hpMax) {
    const next = clone(combatants).map(c =>
      c.id === id ? { ...c, hp_current: hpCurrent, hp_max: hpMax } : c
    )
    setCombatants(next)
    await pushUpdate(next)

    const target = combatants.find(c => c.id === id)
    if (target?.type === 'pc' && target?.characterId) {
      api.patch(`/characters/${target.characterId}/hp`, {
        hp_current: hpCurrent,
        hp_max:     hpMax,
      }).catch(err => console.warn('HP sync to character sheet failed:', err))
    }
  }

  // ── Field helpers ─────────────────────────────────────────────────────────────
  function updateLocal(id, patch) {
    setCombatants(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    // Clear the initiative validation error as soon as the GM edits any field
    if ('initiative' in patch && initError) setInitError('')
  }

  function commitField(id, patch) {
    const next = combatants.map(c => c.id === id ? { ...c, ...patch } : c)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Toggle dead ───────────────────────────────────────────────────────────────
  function toggleDead(id) {
    const next = combatants.map(c => c.id === id ? { ...c, is_dead: !c.is_dead } : c)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Add NPC/monster — always grouped under the GM card (seat 0) ─────────────
  function addNPC() {
    const gmC    = combatants.find(c => c.type === 'gm')
    const npc    = { ...newNPC(), seatIndex: 0, initiative: gmC?.initiative ?? null }
    const next   = insertAfterGMGroup(combatants, npc)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Add from bestiary ─────────────────────────────────────────────────────────
  function addFromBestiary(monster) {
    const sd  = monster.stat_data ?? {}
    const dex = sd.stats?.dex ?? 10
    const gmC = combatants.find(c => c.type === 'gm')
    const combatant = {
      id:             crypto.randomUUID(),
      type:           'monster',
      seatIndex:      0,    // seat 0 = GM's group
      name:           monster.name,
      hp_current:     Number(sd.hp) || 8,
      hp_max:         Number(sd.hp) || 8,
      ac:             Number(sd.ac) || 12,
      dex_mod:        calcDexMod(dex),
      initiative:     gmC?.initiative ?? null,   // inherit current GM initiative
      conditions:     [],
      is_active_turn: false,
      is_dead:        false,
      notes:          '',
      monsterId:      monster.id,
      statData:       sd,
    }
    const next = insertAfterGMGroup(combatants, combatant)
    setCombatants(next)
    pushUpdate(next)
    setShowBestiary(false)
  }

  // ── Remove combatant ──────────────────────────────────────────────────────────
  function removeCombatant(id) {
    const next = combatants.filter(c => c.id !== id)
    if (selectedId === id) setSelectedId(null)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Open bestiary picker ──────────────────────────────────────────────────────
  async function openBestiary() {
    setShowBestiary(true)
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

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  function handleDragStart(id) { setDragId(id) }
  function handleDragOver(e, id) { e.preventDefault(); setDropId(id) }
  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setDropId(null); return }
    const next  = clone(combatants)
    const fromI = next.findIndex(c => c.id === dragId)
    const toI   = next.findIndex(c => c.id === targetId)
    const [item] = next.splice(fromI, 1)
    next.splice(toI, 0, item)
    setCombatants(next)
    pushUpdate(next)
    setDragId(null)
    setDropId(null)
  }
  function handleDragEnd() { setDragId(null); setDropId(null) }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <Shell>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-codex-muted animate-pulse text-sm">Loading combat…</p>
      </div>
    </Shell>
  )

  if (error) return (
    <Shell>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </Shell>
  )

  if (campaign && campaign.gm_user_id !== user?.id) return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Shield size={28} className="text-codex-muted" />
        <p className="text-codex-subtext text-sm">Access denied — GM only.</p>
        <Link to={`/campaigns/${campaignId}`} className="text-xs text-codex-gold hover:underline">
          Back to Campaign
        </Link>
      </div>
    </Shell>
  )

  return (
    <Shell>
      <Helmet><title>Combat — CampaignCodex</title></Helmet>
      {/* ── Header ── */}
      <header className="flex-none border-b border-codex-border bg-codex-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 h-12 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={`/campaigns/${campaignId}`}
              className="flex items-center gap-1 text-xs text-codex-subtext hover:text-codex-text transition-colors shrink-0"
            >
              <ArrowLeft size={13} /> Back
            </Link>
            <span className="text-codex-border text-codex-border">|</span>
            <span className="text-sm font-semibold text-codex-text truncate">
              {campaign?.name ?? 'Combat'}
            </span>
            {campaign?.game_system && (
              <span className="hidden sm:inline text-[10px] text-codex-subtext border border-codex-border rounded-full px-2 py-0.5 shrink-0">
                {GAME_LABEL[gameSystem] ?? gameSystem}
              </span>
            )}
            {saving && (
              <span className="text-[10px] text-codex-muted animate-pulse shrink-0">Syncing…</span>
            )}
            <span
              className={`hidden sm:flex items-center gap-1 text-[10px] shrink-0 ${liveConnected ? 'text-emerald-400' : 'text-codex-muted'}`}
              title={liveConnected ? 'Live updates active' : 'Connecting…'}
            >
              {liveConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
              {liveConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {isGM && session && (
            <button
              onClick={endCombat}
              className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50 transition-all shrink-0"
            >
              <Skull size={11} /> End Combat
            </button>
          )}
        </div>
      </header>

      {/* ── Morale warning ── */}
      {moraleWarning && !moraleDismissed && (
        <div className="flex-none bg-amber-900/30 border-b border-amber-600/30 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 flex-1">
            <strong>Morale Check!</strong> ≥50% casualties — DC 15 WIS check or enemies flee.
          </p>
          <button
            onClick={() => setMoraleDismissed(true)}
            className="text-amber-500 hover:text-amber-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── No session ── */}
      {!session && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Sword size={36} className="text-codex-muted" />
          <p className="text-codex-subtext text-sm">No active combat session.</p>
          {isGM ? (
            <button
              onClick={startCombat}
              disabled={starting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-900/30 border border-amber-700/40 text-amber-300 hover:bg-amber-900/50 text-sm font-medium transition-all disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start Combat'}
            </button>
          ) : (
            <p className="text-xs text-codex-muted flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? 'bg-emerald-400' : 'bg-codex-muted'} animate-pulse`} />
              {liveConnected ? 'Watching for GM to start combat…' : 'Connecting to live updates…'}
            </p>
          )}
        </div>
      )}

      {/* ── Active session: Nimble RPG combat tracker ── */}
      {session && gameSystem === 'nimble' && (
        <NimbleCombatView
          session={session}
          campaignId={campaignId}
          isGM={isGM}
          onEndCombat={endCombat}
          socket={socket}
        />
      )}

      {/* ── Active session: Mörk Borg combat tracker ── */}
      {session && gameSystem === 'morkborg' && (
        <MorkBorgCombatView
          session={session}
          campaignId={campaignId}
          isGM={isGM}
          onEndCombat={endCombat}
          socket={socket}
        />
      )}

      {/* ── Active session: Shadowdark two-panel layout ── */}
      {session && gameSystem !== 'nimble' && gameSystem !== 'morkborg' && (
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT PANEL 60% */}
          <div className="flex flex-col w-[60%] min-w-0 border-r border-codex-border overflow-hidden">

            {/* GM controls row */}
            {isGM && (
              <div className="flex-none flex flex-col px-4 py-2 border-b border-codex-border gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Initiative group */}
                  <div className="flex items-center gap-1 rounded-lg border border-codex-border overflow-hidden">
                    <button
                      onClick={rollAllInitiative}
                      className={`${TRACKER_BTN} rounded-none border-none`}
                      title="Auto-roll d20+DEX for each seat; highest goes first then clockwise"
                    >
                      <RefreshCw size={10} /> Roll Initiative
                    </button>
                    <div className="w-px h-4 bg-codex-border shrink-0" />
                    <button
                      onClick={confirmManualRolls}
                      className={`${TRACKER_BTN} rounded-none border-none`}
                      title="Use the values you typed in the initiative boxes to set turn order"
                    >
                      <CheckSquare size={10} /> Use My Rolls
                    </button>
                  </div>

                  <button
                    onClick={nextTurn}
                    className={`${TRACKER_BTN} border-amber-500/30 text-amber-400 hover:border-amber-500/60`}
                  >
                    <SkipForward size={10} /> Next Turn
                  </button>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[10px] text-codex-muted">
                      Round <span className="text-codex-gold font-mono font-semibold">{round}</span>
                    </span>
                  </div>
                </div>
                {/* Validation error — only shows when a seat holder is missing a roll */}
                {initError && (
                  <p className="text-[10px] text-red-400 leading-tight">
                    ⚠ {initError}
                  </p>
                )}
              </div>
            )}

            {/* Round badge (player view) */}
            {!isGM && (
              <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-codex-border">
                <span className="text-[10px] text-codex-muted">
                  Round <span className="text-codex-gold font-mono font-semibold">{round}</span>
                </span>
              </div>
            )}

            {/* Section label */}
            <div className="flex-none px-4 pt-3 pb-1">
              <p className="text-[10px] uppercase tracking-widest text-codex-muted">Seating Order → Turn Order</p>
            </div>

            {/* Combatant list — GM card + indented monsters + PC cards */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1.5">
              {combatants.length === 0 && (
                <div className="flex items-center justify-center py-16">
                  <p className="text-codex-muted text-xs text-center">
                    No combatants yet. Click "Start Combat" to load players automatically.
                  </p>
                </div>
              )}

              {combatants.map(c => {
                // ── GM Card ─────────────────────────────────────────────────────
                if (c.type === 'gm') {
                  return (
                    <GMCard
                      key={c.id}
                      combatant={c}
                      isGM={isGM}
                      gameSystem={gameSystem}
                      isSelected={c.id === selectedId}
                      isDragTarget={c.id === dropId}
                      onSelect={() => setSelectedId(prev => prev === c.id ? null : c.id)}
                      onInitChange={v => updateLocal(c.id, { initiative: v })}
                      onInitBlur={v   => commitField(c.id, { initiative: parseInt(v) || null })}
                      onDragStart={() => handleDragStart(c.id)}
                      onDragOver={e  => handleDragOver(e, c.id)}
                      onDrop={() => handleDrop(c.id)}
                      onDragEnd={handleDragEnd}
                      onAddBestiary={openBestiary}
                      onAddQuick={() => setShowQuickCreate(true)}
                      onAddNPC={addNPC}
                    />
                  )
                }

                // ── Monster card — indented under GM ────────────────────────────
                if (c.type === 'monster' || (c.seatIndex === 0 && c.type === 'npc')) {
                  return (
                    <div key={c.id} className="ml-6 border-l-2 border-amber-500/20 pl-2.5">
                      <CombatantCard
                        combatant={c}
                        isGM={isGM}
                        gameSystem={gameSystem}
                        isSelected={c.id === selectedId}
                        isDragTarget={c.id === dropId}
                        onSelect={() => setSelectedId(prev => prev === c.id ? null : c.id)}
                        onInitChange={v        => updateLocal(c.id, { initiative: v })}
                        onInitBlur={v          => commitField(c.id, { initiative: parseInt(v) || null })}
                        onHPChange={(cur, max) => updateLocal(c.id, { hp_current: Number(cur), hp_max: Number(max) })}
                        onHPCommit={(cur, max) => updateHP(c.id, Number(cur), Number(max))}
                        onToggleDead={() => toggleDead(c.id)}
                        onRemove={isGM ? () => removeCombatant(c.id) : undefined}
                        onDragStart={() => handleDragStart(c.id)}
                        onDragOver={e  => handleDragOver(e, c.id)}
                        onDrop={() => handleDrop(c.id)}
                        onDragEnd={handleDragEnd}
                      />
                    </div>
                  )
                }

                // ── PC card ─────────────────────────────────────────────────────
                return (
                  <CombatantCard
                    key={c.id}
                    combatant={c}
                    isGM={isGM}
                    isSelected={c.id === selectedId}
                    isDragTarget={c.id === dropId}
                    onSelect={() => setSelectedId(prev => prev === c.id ? null : c.id)}
                    onInitChange={v        => updateLocal(c.id, { initiative: v })}
                    onInitBlur={v          => commitField(c.id, { initiative: parseInt(v) || null })}
                    onHPChange={(cur, max) => updateLocal(c.id, { hp_current: Number(cur), hp_max: Number(max) })}
                    onHPCommit={(cur, max) => updateHP(c.id, Number(cur), Number(max))}
                    onToggleDead={() => toggleDead(c.id)}
                    onRemove={undefined}
                    onDragStart={() => handleDragStart(c.id)}
                    onDragOver={e  => handleDragOver(e, c.id)}
                    onDrop={() => handleDrop(c.id)}
                    onDragEnd={handleDragEnd}
                  />
                )
              })}
            </div>
          </div>

          {/* RIGHT PANEL 40% */}
          <div className="flex flex-col w-[40%] min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {selectedCombatant ? (
                <StatPanel
                  combatant={selectedCombatant}
                  statData={statBlock}
                  loading={statLoading}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
                  <Sword size={28} className="text-codex-border" />
                  <p className="text-codex-muted text-xs leading-relaxed">
                    Click a combatant to view its stat block here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer — Shadowdark only (Nimble + Mörk Borg manage their own state) ── */}
      {session && isGM && gameSystem !== 'nimble' && gameSystem !== 'morkborg' && (
        <footer className="flex-none border-t border-codex-border bg-codex-surface/60 px-4 py-2 flex items-center gap-3">
          <button
            onClick={handleUndo}
            disabled={!historyStack.length}
            className={`${TRACKER_BTN} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <RefreshCw size={10} /> Undo last
          </button>
        </footer>
      )}

      {/* ── Bestiary Picker Modal ── */}
      {showBestiary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowBestiary(false) }}
        >
          <div className="bg-codex-card border border-codex-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[80vh]">
            <div className="h-0.5 bg-gradient-to-r from-amber-500/60 via-codex-gold to-amber-500/60" />

            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-codex-gold" />
                <h2 className="text-sm font-semibold text-codex-text">Add from Bestiary</h2>
              </div>
              <button
                onClick={() => setShowBestiary(false)}
                className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-5 pb-3 shrink-0">
              <input
                type="text"
                placeholder="Search monsters…"
                value={bestiarySearch}
                onChange={e => setBestiarySearch(e.target.value)}
                className="w-full bg-codex-bg border border-codex-border rounded-lg px-3 py-2 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-1.5">
              {bestiaryLoading && (
                <p className="text-center text-codex-muted text-xs py-8 animate-pulse">Loading…</p>
              )}

              {!bestiaryLoading && bestiaryMonsters.length === 0 && (
                <p className="text-center text-codex-muted text-xs py-8">
                  No monsters in bestiary for {GAME_LABEL[gameSystem] ?? gameSystem}.
                </p>
              )}

              {!bestiaryLoading && bestiaryMonsters
                .filter(m => m.name.toLowerCase().includes(bestiarySearch.toLowerCase()))
                .map(monster => {
                  const sd = monster.stat_data ?? {}
                  return (
                    <button
                      key={monster.id}
                      onClick={() => addFromBestiary(monster)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border border-codex-border hover:border-codex-gold/40 hover:bg-codex-surface transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-codex-text font-medium group-hover:text-codex-gold transition-colors truncate">
                          {monster.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {monster.challenge && (
                            <span className="text-[10px] text-codex-muted">LV {monster.challenge}</span>
                          )}
                          {sd.hitDie && (
                            <span className="text-[10px] text-codex-muted">HD {sd.hitDie}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sd.ac != null && (
                          <span className="text-[10px] text-codex-subtext border border-codex-border rounded px-1.5 py-0.5">
                            AC {sd.ac}
                          </span>
                        )}
                        {sd.hp != null && (
                          <span className="text-[10px] text-codex-subtext border border-codex-border rounded px-1.5 py-0.5">
                            HP {sd.hp}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Monster Modal ── */}
      {showQuickCreate && (
        <QuickMonsterModal
          gameSystem={gameSystem}
          onCreated={(monster) => { addFromBestiary(monster); setShowQuickCreate(false) }}
          onClose={() => setShowQuickCreate(false)}
        />
      )}
    </Shell>
  )
}

// ─── GMCard ───────────────────────────────────────────────────────────────────
// The GM's "seat" at the table. All monsters act on this turn.
// Shows the GM's username + initiative roll result. Add-monster buttons live here.

function GMCard({
  combatant, isGM, gameSystem, isSelected, isDragTarget,
  onSelect, onInitChange, onInitBlur, onDragStart, onDragOver, onDrop, onDragEnd,
  onAddBestiary, onAddQuick, onAddNPC,
}) {
  const c         = combatant
  const isActive  = c.is_active_turn
  const isShadowdark = gameSystem === 'shadowdark'

  // Local state for the initiative input (mirrors CombatantCard pattern)
  const [editingInit, setEditingInit] = useState(false)
  const [initVal,     setInitVal]     = useState(c.initiative ?? '')
  useEffect(() => {
    if (!editingInit) setInitVal(c.initiative ?? '')
  }, [c.initiative, editingInit])

  const cardClass = [
    'rounded-xl border-2 transition-all duration-150 overflow-hidden',
    isActive
      ? 'border-amber-400/70 bg-amber-900/15 shadow-[0_0_16px_rgba(217,119,6,0.25)]'
      : 'border-amber-500/25 bg-codex-card',
    isSelected   ? 'ring-1 ring-codex-gold/50' : '',
    isDragTarget ? 'border-codex-gold/60' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClass}
      draggable={isGM}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Amber top bar */}
      <div className="h-0.5 bg-gradient-to-r from-amber-600/50 via-codex-gold to-amber-600/50" />

      <div className="flex items-center gap-3 px-3 py-2.5">
        {isGM && (
          <span className="text-codex-muted text-xs cursor-grab active:cursor-grabbing select-none">≡</span>
        )}

        {/* Crown icon */}
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
          isActive
            ? 'bg-amber-500/20 border-amber-500/50'
            : 'bg-codex-surface border-codex-border'
        }`}>
          <Crown size={14} className={isActive ? 'text-amber-400' : 'text-codex-gold'} />
        </div>

        {/* Name + labels */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onSelect}
              className={`text-sm font-semibold text-left transition-colors ${
                isActive ? 'text-amber-300' : 'text-codex-gold hover:text-codex-goldHover'
              }`}
            >
              Game Master
            </button>
            <span className="text-[9px] text-amber-500/70 border border-amber-500/30 rounded-full px-1.5 py-px font-medium">
              GM
            </span>
          </div>
          <p className="text-[10px] text-codex-muted truncate">{c.username}</p>
        </div>

        {/* Initiative input — Shadowdark only; GM rolls once for all monsters */}
        {isShadowdark && isGM && (
          <div
            className="shrink-0 w-9 h-9 flex items-center justify-center border border-codex-border rounded bg-codex-bg text-xs font-mono cursor-pointer hover:border-amber-500/40 transition-colors"
            onClick={() => setEditingInit(true)}
            title="GM's initiative roll (covers all monsters)"
          >
            {editingInit ? (
              <input
                type="number"
                value={initVal}
                autoFocus
                onChange={e => { setInitVal(e.target.value); onInitChange?.(e.target.value) }}
                onBlur={() => { setEditingInit(false); onInitBlur?.(initVal) }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                className="w-full bg-transparent outline-none text-center text-xs text-codex-text"
              />
            ) : (
              <span className={c.initiative != null ? 'text-amber-400 font-bold' : 'text-codex-muted'}>
                {c.initiative ?? '—'}
              </span>
            )}
          </div>
        )}
        {/* Read-only init badge for non-Shadowdark systems (after Roll Initiative) */}
        {!isShadowdark && c.initiative != null && (
          <div className="shrink-0 flex flex-col items-center">
            <span className="text-[9px] text-codex-muted uppercase">Init</span>
            <span className="text-sm font-mono font-bold text-amber-400">{c.initiative}</span>
          </div>
        )}

        {/* Active turn indicator */}
        {isActive && (
          <span className="shrink-0 text-[10px] font-medium text-amber-300 border border-amber-500/40 rounded px-1.5 py-0.5 animate-pulse">
            GM's Turn
          </span>
        )}
      </div>

      {/* Add-monster controls (GM only) */}
      {isGM && (
        <div className="flex items-center gap-1.5 px-3 pb-2.5">
          <button onClick={onAddBestiary} className={TRACKER_BTN}>
            <BookOpen size={9} /> + Bestiary
          </button>
          <button onClick={onAddQuick} className={TRACKER_BTN}>
            <Plus size={9} /> + Quick
          </button>
          <button onClick={onAddNPC} className={TRACKER_BTN}>
            <Plus size={9} /> + NPC
          </button>
        </div>
      )}
    </div>
  )
}

// ─── CombatantCard ────────────────────────────────────────────────────────────

function CombatantCard({
  combatant, isGM, gameSystem, isSelected, isDragTarget,
  onSelect, onInitChange, onInitBlur,
  onHPChange, onHPCommit,
  onToggleDead, onRemove,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  const c = combatant

  const [editingInit, setEditingInit] = useState(false)
  const [initVal,     setInitVal]     = useState(c.initiative ?? '')
  const [editingHP,   setEditingHP]   = useState(false)
  const [hpCurVal,    setHpCurVal]    = useState(c.hp_current)
  const [hpMaxVal,    setHpMaxVal]    = useState(c.hp_max)

  // Sync when combatant updates from remote
  useEffect(() => {
    if (!editingInit) setInitVal(c.initiative ?? '')
  }, [c.initiative, editingInit])

  useEffect(() => {
    if (!editingHP) { setHpCurVal(c.hp_current); setHpMaxVal(c.hp_max) }
  }, [c.hp_current, c.hp_max, editingHP])

  const hpPct   = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0
  const lowHP   = hpPct <= 50 && !c.is_dead
  const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'

  const typeDotColor = c.type === 'pc'
    ? 'bg-blue-400'
    : c.type === 'monster'
      ? 'bg-amber-400'
      : 'bg-red-400'

  const cardClass = [
    'relative rounded-lg border transition-all duration-150',
    c.is_dead
      ? 'opacity-40 border-codex-border/30 bg-codex-surface/40'
      : c.is_active_turn
        ? 'border-l-2 border-l-amber-400 bg-amber-500/5 border-codex-border'
        : 'border-codex-border bg-codex-surface',
    isSelected   ? 'ring-1 ring-codex-gold/40' : '',
    isDragTarget ? 'border-codex-gold/60 bg-codex-gold/5' : '',
    lowHP        ? 'shadow-[0_0_12px_rgba(239,68,68,0.4)]' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClass}
      draggable={isGM}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Dead strikethrough overlay */}
      {c.is_dead && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none overflow-hidden rounded-lg">
          <div className="w-full h-px bg-red-500/50 rotate-[-1deg]" />
        </div>
      )}

      <div className="flex items-center gap-2 px-2.5 py-2">

        {/* Drag handle */}
        {isGM && (
          <span className="text-codex-muted text-xs cursor-grab active:cursor-grabbing select-none shrink-0">≡</span>
        )}

        {/* Initiative box — hidden for monsters in Shadowdark (GM card rolls for the group) */}
        {(gameSystem !== 'shadowdark' || c.type !== 'monster') ? (
          <div
            className="shrink-0 w-9 h-9 flex items-center justify-center border border-codex-border rounded bg-codex-bg text-xs font-mono cursor-pointer hover:border-codex-gold/40 transition-colors"
            onClick={() => isGM && setEditingInit(true)}
            title={isGM ? 'Click to edit initiative' : undefined}
          >
            {editingInit && isGM ? (
              <input
                type="number"
                value={initVal}
                autoFocus
                onChange={e => { setInitVal(e.target.value); onInitChange(e.target.value) }}
                onBlur={() => { setEditingInit(false); onInitBlur(initVal) }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                className="w-full bg-transparent outline-none text-center text-xs text-codex-text"
              />
            ) : (
              <span className={c.initiative != null ? 'text-codex-text' : 'text-codex-muted'}>
                {c.initiative ?? '—'}
              </span>
            )}
          </div>
        ) : (
          /* Shadowdark monsters: show a locked indicator — initiative is the GM's roll */
          <div
            className="shrink-0 w-9 h-9 flex items-center justify-center border border-amber-500/20 rounded bg-codex-bg text-xs font-mono"
            title="Initiative set by GM's roll"
          >
            <span className={c.initiative != null ? 'text-amber-500/70 font-bold' : 'text-codex-muted/40'}>
              {c.initiative ?? '—'}
            </span>
          </div>
        )}

        {/* Type dot */}
        <span className={`shrink-0 w-2 h-2 rounded-full ${typeDotColor}`} title={c.type} />

        {/* Name + username */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onSelect}
              className={`text-left text-sm font-medium leading-tight truncate transition-colors ${
                c.is_active_turn
                  ? 'text-amber-400'
                  : 'text-codex-text hover:text-codex-gold'
              }`}
            >
              {c.name}
            </button>
            {/* Crown badge — GM's own character playing as a PC */}
            {c.isGMCharacter && (
              <Crown
                size={10}
                className="shrink-0 text-codex-gold opacity-70"
                title="GM's character"
              />
            )}
          </div>
          {c.username && (
            <p className="text-[10px] text-codex-muted truncate">{c.username}</p>
          )}
        </div>

        {/* AC badge */}
        {c.ac != null && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-codex-subtext border border-codex-border rounded px-1.5 py-0.5">
            <Shield size={9} className="text-codex-muted" /> {c.ac}
          </span>
        )}

        {/* HP display + inline edit */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {editingHP && isGM ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={hpCurVal}
                autoFocus
                onChange={e => { setHpCurVal(e.target.value); onHPChange(e.target.value, hpMaxVal) }}
                onBlur={() => { setEditingHP(false); onHPCommit(hpCurVal, hpMaxVal) }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                className="w-10 bg-codex-bg border border-codex-border rounded px-1 py-0.5 text-xs text-codex-text focus:outline-none focus:border-codex-gold text-center"
              />
              <span className="text-[10px] text-codex-muted">/</span>
              <input
                type="number"
                value={hpMaxVal}
                onChange={e => { setHpMaxVal(e.target.value); onHPChange(hpCurVal, e.target.value) }}
                onBlur={() => { setEditingHP(false); onHPCommit(hpCurVal, hpMaxVal) }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                className="w-10 bg-codex-bg border border-codex-border rounded px-1 py-0.5 text-xs text-codex-text focus:outline-none focus:border-codex-gold text-center"
              />
            </div>
          ) : (
            <button
              onClick={() => isGM && setEditingHP(true)}
              className={`flex items-center gap-1 text-xs font-mono transition-colors ${
                lowHP ? 'text-red-400' : 'text-codex-text'
              } ${isGM ? 'hover:text-codex-gold cursor-pointer' : 'cursor-default'}`}
              title={isGM ? 'Click to edit HP' : undefined}
            >
              <Heart size={9} className="text-codex-muted" />
              {c.hp_current}/{c.hp_max}
            </button>
          )}

          {/* HP bar */}
          <div className="w-16 h-1 rounded-full bg-codex-bg overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hpColor}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>

        {/* Dead toggle */}
        {isGM && (
          <button
            onClick={onToggleDead}
            title={c.is_dead ? 'Revive' : 'Mark dead'}
            className={`shrink-0 p-1 rounded transition-colors ${
              c.is_dead ? 'text-red-400 hover:text-red-300' : 'text-codex-muted hover:text-red-400'
            }`}
          >
            <Skull size={13} />
          </button>
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            title="Remove from combat"
            className="shrink-0 p-1 rounded text-codex-muted hover:text-red-400 transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── StatPanel ────────────────────────────────────────────────────────────────

function StatPanel({ combatant, statData, loading }) {
  const c  = combatant
  const sd = statData ?? {}

  const typeBadgeClass = c.type === 'pc'
    ? 'text-blue-400 border-blue-400/30 bg-blue-400/10'
    : c.type === 'monster'
      ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
      : 'text-red-400 border-red-400/30 bg-red-400/10'

  const hpPct   = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0
  const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-codex-muted text-xs animate-pulse">Loading stat block…</p>
    </div>
  )

  // PC with no stat data
  if (c.type === 'pc' && !statData) return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <p className="text-base font-semibold text-codex-text">{c.name}</p>
        <span className={`text-[10px] border rounded px-1.5 py-0.5 ${typeBadgeClass}`}>PC</span>
        {c.isGMCharacter && (
          <span className="flex items-center gap-0.5 text-[10px] text-codex-gold border border-codex-gold/30 rounded px-1.5 py-0.5">
            <Crown size={9} /> GM
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-codex-muted uppercase tracking-wider flex items-center gap-1">
            <Heart size={9} /> HP
          </span>
          <span className={`text-xs font-mono ${hpPct <= 50 ? 'text-red-400' : 'text-codex-text'}`}>
            {c.hp_current} / {c.hp_max}
          </span>
        </div>
        <div className="h-2 rounded-full bg-codex-bg overflow-hidden">
          <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      {c.ac != null && (
        <div className="flex items-center gap-1.5 text-xs text-codex-subtext">
          <Shield size={12} className="text-codex-muted" /> AC {c.ac}
        </div>
      )}

      <p className="text-[11px] text-codex-muted border border-codex-border/50 rounded-lg px-3 py-2.5 bg-codex-surface/50">
        PC character — full sheet available on the character page.
      </p>
    </div>
  )

  const ATTRS = [
    { label: 'STR', key: 'str' },
    { label: 'DEX', key: 'dex' },
    { label: 'CON', key: 'con' },
    { label: 'INT', key: 'int' },
    { label: 'WIS', key: 'wis' },
    { label: 'CHA', key: 'cha' },
  ]

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Name + type badge */}
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-codex-text leading-tight">{c.name}</p>
          {(sd.combatRole || sd.level || sd.movement) && (
            <p className="text-[10px] text-codex-muted mt-0.5">
              {[
                sd.combatRole,
                sd.level ? `Level ${sd.level}` : null,
                sd.movement,
              ].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] border rounded px-1.5 py-0.5 ${typeBadgeClass}`}>
          {c.type.toUpperCase()}
        </span>
      </div>

      {/* Core pills: AC, HP, HD */}
      <div className="flex items-center gap-2 flex-wrap">
        {sd.ac != null && (
          <span className="flex items-center gap-1 text-[11px] bg-codex-surface border border-codex-border rounded-full px-2.5 py-1 text-codex-subtext">
            <Shield size={10} className="text-codex-muted" /> AC {sd.ac}
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] bg-codex-surface border border-codex-border rounded-full px-2.5 py-1 text-codex-subtext">
          <Heart size={10} className="text-codex-muted" />
          {c.hp_current}/{c.hp_max}
        </span>
        {sd.hitDie && (
          <span className="text-[11px] bg-codex-surface border border-codex-border rounded-full px-2.5 py-1 text-codex-subtext">
            HD {sd.hitDie}
          </span>
        )}
      </div>

      {/* Attr grid 6-col */}
      {sd.stats && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-codex-muted mb-2">Attributes</p>
          <div className="grid grid-cols-6 gap-1">
            {ATTRS.map(({ label, key }) => {
              const raw = sd.stats[key]
              const mod = raw != null ? Math.floor((raw - 10) / 2) : null
              return (
                <div
                  key={key}
                  className="flex flex-col items-center gap-0.5 bg-codex-surface rounded-lg py-2 border border-codex-border"
                >
                  <span className="text-[9px] text-codex-muted uppercase">{label}</span>
                  <span className="text-xs font-semibold text-codex-text font-mono">
                    {raw ?? '—'}
                  </span>
                  <span className={`text-[10px] font-mono ${mod != null && mod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {mod != null ? formatMod(mod) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Attacks */}
      {sd.attacks && sd.attacks.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-codex-muted mb-2">Attacks</p>
          <div className="flex flex-col gap-1.5">
            {sd.attacks.map((atk, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 px-3 py-2 bg-codex-surface border border-codex-border rounded-lg"
              >
                <span className="text-xs text-codex-text font-medium flex-1 min-w-0 truncate">
                  {atk.count > 1 ? `${atk.count}× ` : ''}
                  {atk.weapon}
                  {atk.range ? (
                    <span className="text-codex-muted font-normal"> ({atk.range})</span>
                  ) : null}
                </span>
                {atk.bonus !== 0 && atk.bonus != null && (
                  <span className="text-[10px] text-codex-subtext shrink-0">
                    {formatMod(atk.bonus)} to hit
                  </span>
                )}
                {atk.damage && (
                  <span className="text-xs font-mono font-bold text-amber-400 shrink-0">
                    {atk.damage}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Talents */}
      {sd.talents && sd.talents.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-codex-muted mb-2">Talents</p>
          <div className="flex flex-col gap-2">
            {sd.talents.map((t, i) => (
              <div
                key={i}
                className="px-3 py-2 bg-codex-surface border border-codex-border rounded-lg"
              >
                <p className="text-xs font-semibold text-codex-text leading-snug">{t.name}</p>
                {t.description && (
                  <p className="text-[11px] text-codex-subtext mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback for monster with no stat data */}
      {c.type !== 'pc' && !sd.stats && !sd.attacks && !sd.talents && (
        <p className="text-[11px] text-codex-muted border border-codex-border/50 rounded-lg px-3 py-2.5 bg-codex-surface/50">
          No stat block data available for this combatant.
        </p>
      )}
    </div>
  )
}
