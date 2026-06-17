import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Plus, X, RefreshCw, ChevronRight,
  SkipForward, Heart, Shield, Zap, Skull, Wifi, WifiOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../utils/api'

// ─── Constants ────────────────────────────────────────────────────────────────
const CONDITIONS = [
  'Poisoned','Stunned','Blinded','Frightened',
  'Prone','Restrained','Unconscious','Dead',
]

const GAME_LABEL = { shadowdark: 'Shadowdark', morkborg: 'Mörk Borg', nimble: 'Nimble RPG' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function d20() { return Math.floor(Math.random() * 20) + 1 }

/** Deep clone a JSON-safe object. */
function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

function newNPC(id) {
  return {
    id,
    type:           'npc',
    name:           'Enemy',
    hp_max:         10,
    hp_current:     10,
    initiative:     null,
    initiative_roll: null,
    actions_max:    3,
    actions_left:   3,
    conditions:     [],
    armor_tier:     0,
    is_active_turn: false,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CombatPage() {
  const { id: campaignId }    = useParams()
  const { user }              = useAuth()
  const { socket, connected } = useSocket()
  const navigate              = useNavigate()

  const [campaign, setCampaign]         = useState(null)
  const [session, setSession]           = useState(null)
  const [combatants, setCombatants]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [starting, setStarting]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [activeIdx, setActiveIdx]       = useState(null)
  const [error, setError]               = useState('')
  const [liveConnected, setLiveConnected] = useState(false)  // in combat socket room

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isGM       = campaign?.gm_user_id === user?.id
  const gameSystem = campaign?.game_system ?? 'shadowdark'
  const isNimble   = gameSystem === 'nimble'

  // Keep session ref current so the socket handler can read it without stale closure
  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])

  // ── Load campaign + active session ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { campaign: c } = await api.get(`/campaigns/${campaignId}`)
        setCampaign(c)
        try {
          const { session: s } = await api.get(`/combat/${campaignId}/active`)
          setSession(s)
          setCombatants(s.combatants ?? [])
          // Sync active index from loaded state
          const ai = (s.combatants ?? []).findIndex(c => c.is_active_turn)
          setActiveIdx(ai >= 0 ? ai : null)
        } catch { /* no active session yet */ }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [campaignId])

  // ── Socket: join combat room for live updates ────────────────────────────────
  // GM: emits push_combat_update after every change
  // Players: receive combat_update events and mirror the GM's state
  useEffect(() => {
    if (!socket || !connected) return

    socket.emit('join_combat', { campaignId }, ({ ok, error: err }) => {
      if (err) console.error('[combat socket]', err)
      else setLiveConnected(true)
    })

    function handleCombatUpdate({ combatants: updated, roundNumber, eventType }) {
      if (eventType === 'started') {
        // GM just started a new session — fetch fresh from API
        api.get(`/combat/${campaignId}/active`).then(({ session: s }) => {
          setSession(s)
          setCombatants(s.combatants ?? [])
          const ai = (s.combatants ?? []).findIndex(c => c.is_active_turn)
          setActiveIdx(ai >= 0 ? ai : null)
        }).catch(() => {})
        return
      }
      if (eventType === 'ended') {
        setSession(null)
        setCombatants([])
        setActiveIdx(null)
        return
      }
      // Normal update — mirror GM state directly
      setCombatants(updated ?? [])
      if (roundNumber !== undefined) {
        setSession(prev => prev ? { ...prev, round_number: roundNumber } : prev)
      }
      const ai = (updated ?? []).findIndex(c => c.is_active_turn)
      setActiveIdx(ai >= 0 ? ai : null)
    }

    socket.on('combat_update', handleCombatUpdate)

    return () => {
      socket.off('combat_update', handleCombatUpdate)
      socket.emit('leave_combat', { campaignId })
      setLiveConnected(false)
    }
  }, [socket, connected, campaignId])

  // ── Helper: push state change to DB + broadcast to players ──────────────────
  // Returns the saved session on success so callers can use fresh data.
  async function pushUpdate(newCombatants, newRound) {
    if (!sessionRef.current) return null
    setSaving(true)
    try {
      const { session: s } = await api.patch(`/combat/${sessionRef.current.id}`, {
        combatants:   newCombatants ?? combatants,
        round_number: newRound      ?? sessionRef.current.round_number,
      })
      setSession(s)

      // Relay to players via socket (GM only — non-GMs won't have push_combat_update accepted)
      if (socket && connected) {
        socket.emit('push_combat_update', {
          campaignId,
          combatants:  s.combatants ?? newCombatants ?? combatants,
          roundNumber: s.round_number,
          eventType:   'update',
        })
      }

      return s
    } catch (err) {
      console.error('Combat sync error:', err)
      return null
    } finally {
      setSaving(false)
    }
  }

  // ── Start combat ─────────────────────────────────────────────────────────────
  async function startCombat() {
    setStarting(true)
    try {
      const { session: s } = await api.post('/combat/start', { campaignId })
      setSession(s)
      setCombatants(s.combatants ?? [])

      if (socket && connected) {
        socket.emit('push_combat_update', {
          campaignId,
          combatants:  s.combatants ?? [],
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

  // ── End combat ───────────────────────────────────────────────────────────────
  async function endCombat() {
    if (!confirm('End this combat session?')) return
    await api.post(`/combat/${session.id}/end`)

    if (socket && connected) {
      socket.emit('push_combat_update', {
        campaignId,
        combatants:  [],
        roundNumber: 1,
        eventType:   'ended',
      })
    }

    navigate(`/campaigns/${campaignId}`)
  }

  // ── Add NPC ──────────────────────────────────────────────────────────────────
  function addNPC() {
    const next = [...combatants, newNPC(`npc-${Date.now()}`)]
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Remove combatant ─────────────────────────────────────────────────────────
  function removeCombatant(idx) {
    const next = combatants.filter((_, i) => i !== idx)
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Generic field updater ────────────────────────────────────────────────────
  function updateField(idx, field, value) {
    const next = clone(combatants)
    next[idx][field] = value
    setCombatants(next)
    return next
  }

  function commitField(idx, field, value) {
    const next = updateField(idx, field, value)
    pushUpdate(next)
  }

  // ── Roll initiative for all combatants ───────────────────────────────────────
  function rollAllInitiative() {
    const next = clone(combatants).map(c => {
      const roll = d20()
      return {
        ...c,
        initiative_roll: roll,
        initiative:      roll,
        // Nimble: initiative roll = starting action count for round 1
        actions_max:  isNimble ? roll : c.actions_max,
        actions_left: isNimble ? roll : c.actions_max,
      }
    })
    const sorted = [...next].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
    sorted[0].is_active_turn = true
    setCombatants(sorted)
    setActiveIdx(0)
    pushUpdate(sorted)
  }

  // ── Advance turn ─────────────────────────────────────────────────────────────
  function nextTurn() {
    const next = clone(combatants)
    const cur  = activeIdx ?? 0
    next[cur].is_active_turn = false

    let nextI = (cur + 1) % next.length
    // Skip dead combatants
    const startI = nextI
    while (next[nextI].conditions.includes('Dead')) {
      nextI = (nextI + 1) % next.length
      if (nextI === startI) break
    }

    // Nimble: reset action count to 3 on turns after round 1
    if (isNimble) {
      next[nextI].actions_max  = 3
      next[nextI].actions_left = 3
    }

    next[nextI].is_active_turn = true
    const newRound = nextI === 0 ? (session?.round_number ?? 1) + 1 : undefined

    setCombatants(next)
    setActiveIdx(nextI)
    pushUpdate(next, newRound)
  }

  // ── Nimble: spend/restore an action pip ─────────────────────────────────────
  function spendAction(idx) {
    if (!isNimble) return
    const next = clone(combatants)
    if (next[idx].actions_left > 0) next[idx].actions_left -= 1
    setCombatants(next)
    pushUpdate(next)
  }

  function restoreAction(idx) {
    if (!isNimble) return
    const next = clone(combatants)
    if (next[idx].actions_left < next[idx].actions_max) next[idx].actions_left += 1
    setCombatants(next)
    pushUpdate(next)
  }

  // ── Toggle condition ─────────────────────────────────────────────────────────
  function toggleCondition(idx, cond) {
    const next = clone(combatants)
    const conds = next[idx].conditions ?? []
    next[idx].conditions = conds.includes(cond)
      ? conds.filter(c => c !== cond)
      : [...conds, cond]
    setCombatants(next)
    pushUpdate(next)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return <Shell><div className="text-center animate-pulse text-codex-muted py-24">Loading…</div></Shell>
  if (error)   return <Shell><div className="text-center text-red-400 py-24">{error}</div></Shell>

  return (
    <Shell>
      {/* ── Top bar ── */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <Link to={`/campaigns/${campaignId}`}
              className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-2">
              <ArrowLeft size={13} /> Campaign
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-codex-text">Combat Tracker</h1>
              {campaign && (
                <span className="text-xs text-codex-subtext border border-codex-border rounded-full px-2.5 py-0.5">
                  {GAME_LABEL[gameSystem]}
                </span>
              )}
              {session && (
                <span className="text-xs text-codex-gold font-mono">
                  Round {session.round_number}
                </span>
              )}
              {saving && <span className="text-xs text-codex-muted animate-pulse">Syncing…</span>}
              {!isGM && (
                <span className={`flex items-center gap-1 text-xs ${liveConnected ? 'text-emerald-400' : 'text-codex-muted'}`}
                  title={liveConnected ? 'Live updates active' : 'Connecting…'}>
                  {liveConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {liveConnected ? 'Live' : 'Connecting…'}
                </span>
              )}
            </div>
          </div>
          {isGM && session && (
            <div className="flex items-center gap-2">
              <button onClick={addNPC}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-codex-surface border border-codex-border text-codex-text hover:border-codex-gold transition-all">
                <Plus size={12} /> Add NPC
              </button>
              <button onClick={rollAllInitiative}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-codex-surface border border-codex-border text-codex-text hover:border-codex-gold transition-all">
                <RefreshCw size={12} /> Roll Initiative
              </button>
              <button onClick={nextTurn}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 transition-all">
                <SkipForward size={12} /> Next Turn
              </button>
              <button onClick={endCombat}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50 transition-all">
                <Skull size={12} /> End Combat
              </button>
            </div>
          )}
        </div>

        {/* ── No session yet ── */}
        {!session && isGM && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="text-5xl">⚔️</div>
            <p className="text-codex-subtext text-sm">No active combat session.</p>
            <button onClick={startCombat} disabled={starting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 text-sm font-medium transition-all disabled:opacity-50">
              {starting ? 'Starting…' : '⚔️ Start Combat'}
            </button>
          </div>
        )}

        {!session && !isGM && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-sm text-codex-subtext">No combat session active.</p>
            {liveConnected ? (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Watching for GM to start combat…
              </p>
            ) : (
              <p className="text-xs text-codex-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-codex-muted animate-pulse" />
                Connecting to live updates…
              </p>
            )}
          </div>
        )}

        {/* ── Combat tracker grid ── */}
        {session && (
          <div className="flex flex-col gap-3">
            {isNimble && (
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                <Zap size={13} />
                <strong>Nimble Initiative:</strong> Each combatant's roll = actions available this round. Round 1 only. All subsequent rounds start with 3 actions.
              </div>
            )}

            {combatants.map((c, idx) => (
              <CombatantCard
                key={c.id}
                combatant={c}
                idx={idx}
                isGM={isGM}
                isNimble={isNimble}
                onNameChange={v     => updateField(idx, 'name', v)}
                onNameBlur={v       => commitField(idx, 'name', v)}
                onHPChange={v       => updateField(idx, 'hp_current', v)}
                onHPBlur={v         => commitField(idx, 'hp_current', Math.max(0, parseInt(v) || 0))}
                onMaxHPChange={v    => updateField(idx, 'hp_max', v)}
                onMaxHPBlur={v      => commitField(idx, 'hp_max', Math.max(1, parseInt(v) || 1))}
                onInitChange={v     => updateField(idx, 'initiative', v)}
                onInitBlur={v       => commitField(idx, 'initiative', parseInt(v) || null)}
                onSpendAction={()   => spendAction(idx)}
                onRestoreAction={() => restoreAction(idx)}
                onToggleCond={cond  => toggleCondition(idx, cond)}
                onRemove={isGM && c.type === 'npc' ? () => removeCombatant(idx) : undefined}
              />
            ))}

            {combatants.length === 0 && (
              <div className="border border-dashed border-codex-border rounded-xl p-12 text-center">
                <p className="text-codex-subtext text-sm">No combatants. Roll initiative to load party members, then add NPCs.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

// ─── CombatantCard ────────────────────────────────────────────────────────────
function CombatantCard({
  combatant, idx, isGM, isNimble,
  onNameChange, onNameBlur,
  onHPChange, onHPBlur,
  onMaxHPChange, onMaxHPBlur,
  onInitChange, onInitBlur,
  onSpendAction, onRestoreAction,
  onToggleCond, onRemove,
}) {
  const c        = combatant
  const isDead   = c.conditions.includes('Dead')
  const hpPct    = Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100))
  const hpColor  = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-yellow-400' : 'bg-red-500'

  return (
    <div className={`relative rounded-xl border transition-all duration-200 overflow-hidden
      ${c.is_active_turn
        ? 'border-codex-gold bg-codex-gold/5 shadow-[0_0_20px_rgba(201,168,76,0.15)]'
        : isDead
          ? 'border-codex-border/30 bg-codex-surface/40 opacity-50'
          : 'border-codex-border bg-codex-surface'}`}>

      {/* Active turn stripe */}
      {c.is_active_turn && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-codex-gold" />
      )}

      <div className="pl-4 pr-4 py-4 flex flex-wrap items-center gap-4">

        {/* ── Name + type badge ── */}
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <div className="flex items-center gap-2">
            {c.type === 'npc' && (
              <span className="text-xs text-red-400 border border-red-400/30 rounded px-1.5 py-0.5">NPC</span>
            )}
            {c.type === 'pc' && (
              <span className="text-xs text-blue-400 border border-blue-400/30 rounded px-1.5 py-0.5">PC</span>
            )}
            {c.is_active_turn && (
              <span className="text-xs text-codex-gold font-medium">Active Turn</span>
            )}
          </div>
          {isGM && c.type === 'npc' ? (
            <input
              value={c.name}
              onChange={e  => onNameChange(e.target.value)}
              onBlur={e    => onNameBlur(e.target.value)}
              className="bg-transparent border-b border-codex-border focus:border-codex-gold outline-none text-sm font-semibold text-codex-text px-0 py-0.5 w-full"
            />
          ) : (
            <span className="text-sm font-semibold text-codex-text">{c.name}</span>
          )}
          {c.username && (
            <span className="text-xs text-codex-muted">({c.username})</span>
          )}
        </div>

        {/* ── Initiative ── */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-codex-muted">Init</span>
          {isGM ? (
            <input
              type="number"
              value={c.initiative ?? ''}
              onChange={e => onInitChange(e.target.value)}
              onBlur={e   => onInitBlur(e.target.value)}
              className="w-14 text-center bg-codex-bg border border-codex-border rounded px-1 py-1 text-sm text-codex-text focus:outline-none focus:border-codex-gold"
            />
          ) : (
            <span className="text-sm font-mono font-bold text-codex-text">
              {c.initiative ?? '—'}
            </span>
          )}
        </div>

        {/* ── HP ── */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[10px] uppercase tracking-wider text-codex-muted flex items-center gap-1">
            <Heart size={10} /> HP
          </span>
          <div className="flex items-center gap-1">
            {isGM ? (
              <>
                <input
                  type="number"
                  value={c.hp_current}
                  onChange={e => onHPChange(e.target.value)}
                  onBlur={e   => onHPBlur(e.target.value)}
                  className="w-14 text-center bg-codex-bg border border-codex-border rounded px-1 py-1 text-sm text-codex-text focus:outline-none focus:border-codex-gold"
                />
                <span className="text-codex-muted text-sm">/</span>
                <input
                  type="number"
                  value={c.hp_max}
                  onChange={e => onMaxHPChange(e.target.value)}
                  onBlur={e   => onMaxHPBlur(e.target.value)}
                  className="w-14 text-center bg-codex-bg border border-codex-border rounded px-1 py-1 text-sm text-codex-text focus:outline-none focus:border-codex-gold"
                />
              </>
            ) : (
              <span className="text-sm font-mono text-codex-text">{c.hp_current}/{c.hp_max}</span>
            )}
          </div>
          {/* HP bar */}
          <div className="h-1.5 rounded-full bg-codex-bg overflow-hidden w-32">
            <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        {/* ── Nimble: action pips ── */}
        {isNimble && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-codex-muted flex items-center gap-1">
              <Zap size={10} /> Actions
            </span>
            <div className="flex gap-1 flex-wrap max-w-[120px]">
              {Array.from({ length: c.actions_max }).map((_, i) => {
                const filled = i < c.actions_left
                return (
                  <button
                    key={i}
                    disabled={!isGM}
                    onClick={() => filled ? onSpendAction() : onRestoreAction()}
                    className={`w-5 h-5 rounded-full border transition-all text-xs
                      ${filled
                        ? 'bg-amber-500 border-amber-400'
                        : 'bg-codex-bg border-codex-border hover:border-amber-400/50'}`}
                  />
                )
              })}
            </div>
            <span className="text-[10px] text-codex-muted">{c.actions_left}/{c.actions_max}</span>
          </div>
        )}

        {/* ── Conditions ── */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[10px] uppercase tracking-wider text-codex-muted">Conditions</span>
          <div className="flex flex-wrap gap-1">
            {CONDITIONS.map(cond => {
              const active = c.conditions.includes(cond)
              return (
                <button
                  key={cond}
                  disabled={!isGM}
                  onClick={() => onToggleCond(cond)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all
                    ${active
                      ? cond === 'Dead'
                        ? 'bg-red-900 border-red-600 text-red-300'
                        : 'bg-codex-gold/20 border-codex-gold/50 text-codex-gold'
                      : 'bg-codex-bg border-codex-border text-codex-muted hover:border-codex-border'}`}
                >
                  {cond}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Remove NPC ── */}
        {onRemove && (
          <button onClick={onRemove}
            className="ml-auto self-start text-codex-muted hover:text-red-400 transition-colors p-1 rounded">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-codex-bg">
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
