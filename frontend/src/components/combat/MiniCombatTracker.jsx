import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Sword, ExternalLink } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'
import { api } from '../../utils/api'

const MiniCombatTracker = forwardRef(function MiniCombatTracker(
  { campaignId, isGM, gameSystem, onActiveChange },
  ref
) {
  // 1. useState hooks
  const [session, setSession] = useState(null)
  const [combatants, setCombatants] = useState([])
  const [loading, setLoading] = useState(true)
  const [liveConn, setLiveConn] = useState(false)
  const [combatMode, setCombatMode] = useState('standard')

  // 2. refs
  const sessionRef = useRef(session)
  const combatantsRef = useRef(combatants)

  // 3. sync refs
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { combatantsRef.current = combatants }, [combatants])

  // 4. load initial session from REST
  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    setLoading(true)
    api.get(`/combat/${campaignId}/active`)
      .then(data => {
        if (cancelled) return
        if (data.session) {
          setSession(data.session)
          setCombatants(data.session.combatants ?? [])
          setCombatMode(data.session.combat_mode ?? 'standard')
          onActiveChange?.(true)
        } else {
          setSession(null)
          setCombatants([])
          onActiveChange?.(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null)
          setCombatants([])
          onActiveChange?.(false)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 5. socket join/listen
  const { socket } = useSocket()
  useEffect(() => {
    if (!socket || !campaignId) return

    socket.emit('join_combat', { campaignId }, ({ ok, error, session: s } = {}) => {
      if (ok) {
        setLiveConn(true)
        if (s) {
          setSession(s)
          setCombatants(s.combatants ?? [])
          setCombatMode(s.combat_mode ?? 'standard')
          onActiveChange?.(true)
          setLoading(false)
        }
      } else {
        setLiveConn(false)
      }
    })

    function onCombatUpdate({ combatants: c, roundNumber, combatMode: cm, eventType }) {
      // Combat ended — clear everything and collapse the sidebar panel
      if (eventType === 'ended') {
        setSession(null)
        setCombatants([])
        onActiveChange?.(false)
        return
      }
      // Combat just started — re-fetch the full session from the server
      // so we get the complete combatant list rather than relying on the
      // partial payload in the socket event.
      if (eventType === 'start' || eventType === 'started') {
        api.get(`/combat/${campaignId}/active`)
          .then(data => {
            if (data?.session) {
              setSession(data.session)
              setCombatants(data.session.combatants ?? [])
              setCombatMode(data.session.combat_mode ?? 'standard')
              onActiveChange?.(true)
              setLoading(false)
            }
          })
          .catch(() => {})
        return
      }
      // Normal update — apply combatant list, round number, and combat mode
      if (cm) setCombatMode(cm)
      setCombatants(c ?? [])
      setSession(prev => prev
        ? { ...prev, combatants: c ?? [], round_number: roundNumber ?? prev.round_number }
        : { combatants: c ?? [], round_number: roundNumber }
      )
      onActiveChange?.(true)
    }

    socket.on('combat_update', onCombatUpdate)

    return () => {
      socket.off('combat_update', onCombatUpdate)
      socket.emit('leave_combat', { campaignId })
      setLiveConn(false)
    }
  }, [socket, campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 6. startCombat as useCallback — correct deps, no stale closure.
  // Previously a hoisted function declaration so useImperativeHandle could
  // reference it before its definition. Converted to useCallback so the ref
  // always reflects current campaignId/socket/onActiveChange values.
  const startCombat = useCallback(async (opts = {}) => {
    const data = await api.post('/combat/start', { campaignId, ...opts })
    if (data.session) {
      setSession(data.session)
      setCombatants(data.session.combatants ?? [])
      setCombatMode(data.session.combat_mode ?? 'standard')
      onActiveChange?.(true)
      if (socket) {
        socket.emit('push_combat_update', {
          campaignId,
          combatants: data.session.combatants ?? [],
          roundNumber: data.session.round_number,
          eventType: 'start',
        })
      }
    }
    return data.session
  }, [campaignId, socket, onActiveChange])

  // 7. useImperativeHandle — expose startCombat to parent via ref.
  // Dep array includes startCombat so the ref updates when its deps change.
  useImperativeHandle(ref, () => ({ startCombat }), [startCombat])

  // 8. sort/derive
  const isNimble   = gameSystem === 'nimble'
  const isMorkBorg = gameSystem === 'morkborg'

  // Shadowdark / Mörk Borg: push dead to bottom
  const sorted = [...combatants].sort((a, b) => {
    if (a.is_dead && !b.is_dead) return 1
    if (!a.is_dead && b.is_dead) return -1
    return 0
  })

  // Mörk Borg: derive sub-lists and initiative winner
  const mbPending      = isMorkBorg && combatMode === 'mb_pending'
  const mbPlayersFirst = isMorkBorg && combatMode === 'mb_players'
  const mbEnemiesFirst = isMorkBorg && combatMode === 'mb_enemies'
  const mbPCs          = isMorkBorg
    ? [...combatants.filter(c => c.type === 'pc')].sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0))
    : []
  const mbMonsters     = isMorkBorg
    ? combatants.filter(c => c.type === 'monster' || c.type === 'npc')
    : []

  // Nimble: derive sub-lists
  const nimblePCs      = isNimble
    ? [...combatants.filter(c => c.type === 'pc')].sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0))
    : []
  const nimbleMonsters = isNimble
    ? combatants.filter(c => c.type === 'monster' || c.type === 'npc')
    : []
  const nimbleBoss     = nimbleMonsters.find(c => c.is_legendary_boss) ?? null

  // 9. JSX
  return (
    <div className="h-full flex flex-col bg-codex-surface border border-codex-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-codex-border shrink-0">
        <div className="flex items-center gap-1.5">
          <Sword className="w-3.5 h-3.5 text-codex-gold shrink-0" />
          <span className="text-xs font-semibold text-codex-text">Combat</span>
          {session && (
            <span className="ml-1 text-[10px] font-mono text-codex-gold">
              R{session.round_number ?? 1}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Live connection dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              liveConn
                ? 'bg-green-400 animate-pulse'
                : 'bg-codex-muted'
            }`}
          />
          {/* GM manage link */}
          {isGM && session && (
            <a
              href={`/campaigns/${campaignId}/combat`}
              target="_blank"
              rel="noopener noreferrer"
              className="tracker-btn flex items-center gap-1"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Manage
            </a>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center h-full animate-pulse">
            <span className="text-[11px] text-codex-muted">Loading…</span>
          </div>
        ) : !session ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 px-3">
            <Sword className="w-5 h-5 text-codex-muted opacity-40" />
            <span className="text-[11px] text-codex-muted text-center">No combat active</span>
            {!isGM && liveConn && (
              <span className="text-[10px] text-codex-muted/60 text-center leading-tight">
                Watching for GM to start…
              </span>
            )}
          </div>
        ) : isMorkBorg ? (
          /* ── Mörk Borg mini tracker ── */
          <div className="px-1.5 py-1 space-y-0.5">
            {/* Initiative winner banner */}
            {!mbPending && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-1 ${
                mbPlayersFirst
                  ? 'bg-codex-gold/8 border border-codex-gold/20'
                  : 'bg-red-900/15 border border-red-700/20'
              }`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  mbPlayersFirst ? 'text-codex-gold/80' : 'text-red-400/80'
                }`}>
                  {mbPlayersFirst ? '⚔ Players first' : '💀 Enemies first'}
                </span>
              </div>
            )}
            {mbPending && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-1 border border-codex-border/40">
                <span className="text-[9px] text-codex-muted uppercase tracking-wider">
                  Initiative not rolled
                </span>
              </div>
            )}

            {/* First-acting group */}
            {(() => {
              const firstGroup  = mbPlayersFirst ? mbPCs : (mbEnemiesFirst ? mbMonsters : mbPCs)
              const secondGroup = mbPlayersFirst ? mbMonsters : (mbEnemiesFirst ? mbPCs : mbMonsters)
              const firstIsPC   = mbPending || mbPlayersFirst

              const renderRow = (c, isPC) => {
                const lowHp    = !c.is_dead && c.hp_max > 0 && c.hp_current / c.hp_max <= 0.5
                const hpLabel  = c.hp_label  // sanitized for non-GMs
                const dotColor = isPC ? 'bg-blue-400' : 'bg-red-400'
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${c.is_dead ? 'opacity-25' : ''}`}
                  >
                    <span className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] font-bold ${
                      c.has_gone
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : isPC
                          ? 'border-blue-400/30'
                          : 'border-red-400/25'
                    }`}>
                      {c.has_gone ? '✓' : ''}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className={`text-xs font-medium truncate flex-1 ${
                      c.is_dead ? 'line-through text-codex-muted' : 'text-codex-text'
                    }`}>
                      {c.name}
                    </span>
                    {!isPC && (
                      <span className={`text-[10px] font-mono shrink-0 ${
                        hpLabel === 'Near Death' || hpLabel === 'Dying' || hpLabel === 'Dead'
                          ? 'text-red-400'
                          : hpLabel === 'Bloodied'
                            ? 'text-yellow-400'
                            : lowHp
                              ? 'text-yellow-400'
                              : 'text-codex-muted'
                      }`}>
                        {hpLabel ?? (c.hp_max > 0 ? `${c.hp_current}/${c.hp_max}` : '')}
                      </span>
                    )}
                  </div>
                )
              }

              return (
                <>
                  {firstGroup.map(c => renderRow(c, firstIsPC))}
                  {secondGroup.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 py-0.5 px-1">
                        <div className="flex-1 h-px bg-codex-border/40" />
                        <span className="text-[8px] text-codex-muted/50 uppercase tracking-wider shrink-0">then</span>
                        <div className="flex-1 h-px bg-codex-border/40" />
                      </div>
                      {secondGroup.map(c => renderRow(c, !firstIsPC))}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        ) : isNimble ? (
          /* ── Nimble RPG mini tracker ── */
          <div className="px-1.5 py-1 space-y-0.5">
            {combatMode === 'legendary' && nimbleBoss && (
              <div className="mb-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-900/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 text-[11px] shrink-0">⚔</span>
                  <span className={`text-xs font-semibold truncate flex-1 ${nimbleBoss.is_dead ? 'line-through text-codex-muted' : 'text-amber-300'}`}>
                    {nimbleBoss.name}
                  </span>
                  {nimbleBoss.hp_max > 0 && (
                    <span className={`text-[10px] font-mono shrink-0 ${
                      nimbleBoss.hp_current / nimbleBoss.hp_max <= 0.5 ? 'text-red-400' : 'text-amber-400/70'
                    }`}>
                      {nimbleBoss.hp_current}/{nimbleBoss.hp_max}
                    </span>
                  )}
                </div>
                {(nimbleBoss.legendary_slots_gone?.length ?? 0) > 0 && (
                  <p className="text-[9px] text-amber-500/60 mt-0.5 pl-4">
                    acted {nimbleBoss.legendary_slots_gone.filter(Boolean).length}/{nimbleBoss.legendary_slots_gone.length}
                  </p>
                )}
              </div>
            )}

            {/* PCs */}
            {nimblePCs.map(c => (
              <div
                key={c.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${c.is_dead ? 'opacity-30' : ''}`}
              >
                <span className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] font-bold ${
                  c.has_gone
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'border-codex-border/50'
                }`}>
                  {c.has_gone ? '✓' : ''}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400 ${c.is_dead ? 'opacity-40' : ''}`} />
                <span className={`text-xs font-medium truncate flex-1 ${
                  c.is_dead ? 'line-through text-codex-muted' : 'text-codex-text'
                }`}>
                  {c.name}
                </span>
              </div>
            ))}

            {/* Standard mode: monsters section */}
            {combatMode === 'standard' && nimbleMonsters.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 py-0.5 px-1">
                  <div className="flex-1 h-px bg-codex-border/50" />
                  <span className="text-[8px] text-codex-muted/60 uppercase tracking-wider shrink-0">monsters</span>
                  <div className="flex-1 h-px bg-codex-border/50" />
                </div>
                {nimbleMonsters.map(c => {
                  const isLowHp = c.hp_max > 0 && c.hp_current / c.hp_max <= 0.5
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${c.is_dead ? 'opacity-30' : ''}`}
                    >
                      <span className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] font-bold ${
                        c.has_gone
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'border-codex-border/50'
                      }`}>
                        {c.has_gone ? '✓' : ''}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400 ${c.is_dead ? 'opacity-40' : ''}`} />
                      <span className={`text-xs font-medium truncate flex-1 ${
                        c.is_dead ? 'line-through text-codex-muted' : 'text-codex-text'
                      }`}>
                        {c.name}
                      </span>
                      {c.hp_max > 0 && (
                        <span className={`text-[10px] font-mono shrink-0 ${isLowHp ? 'text-red-400' : 'text-codex-muted'}`}>
                          {c.hp_current}/{c.hp_max}
                        </span>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        ) : (
          /* ── Shadowdark / Mörk Borg mini tracker ── */
          <ul className="space-y-0">
            {sorted.map(c => {
              const isLowHp = !c.is_dead && c.hp_max > 0 && c.hp_current / c.hp_max <= 0.5
              const isMonster = c.type === 'monster'
              const isPC = c.type === 'pc'

              const dotColor = isPC
                ? 'bg-blue-400'
                : isMonster
                  ? 'bg-amber-400'
                  : 'bg-red-400'

              const rowBorder = c.is_active_turn
                ? 'border-codex-gold/40 bg-amber-500/5'
                : 'border-transparent'

              const rowShadow = isLowHp ? 'shadow-[0_0_10px_rgba(239,68,68,0.35)]' : ''

              const nameColor = c.is_dead
                ? 'text-codex-muted line-through'
                : c.is_active_turn
                  ? 'text-codex-gold'
                  : isLowHp
                    ? 'text-red-300'
                    : 'text-codex-text'

              return (
                <li
                  key={c.id}
                  className={`px-2.5 py-1.5 mx-1.5 mb-0.5 rounded-lg border flex items-center gap-2 ${rowBorder} ${rowShadow} ${c.is_dead ? 'opacity-30' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  {c.is_active_turn && (
                    <span className="text-codex-gold text-[10px] leading-none shrink-0">▶</span>
                  )}
                  <span className={`text-xs font-medium truncate flex-1 ${nameColor}`}>
                    {c.name}
                  </span>
                  {isMonster && (
                    <span
                      className={`text-[10px] font-mono shrink-0 ${
                        isLowHp ? 'text-red-400' : 'text-codex-muted'
                      }`}
                    >
                      {c.hp_current}/{c.hp_max}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
})

export default MiniCombatTracker
