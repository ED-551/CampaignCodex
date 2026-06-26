/**
 * InitiativeTracker.tsx — Combat turn order panel.
 *
 * UI Layout
 * ─────────
 *  [⚔ Combat — Round N]          [✕]
 *  [Start Combat] [End Combat]
 *  [Add All Tokens] [Roll All] [Sort]
 *  ───────────────────────────────
 *  ▶ [●] Aragorn          20  | 45/55 HP | 17 AC
 *    [●] Goblin            14  |  8/12 HP | 11 AC
 *    [●] Wizard            12  | 28/38 HP | 12 AC
 *  ───────────────────────────────
 *  [◀ Prev]                [Next ▶]
 *
 * Camera follow
 * ─────────────
 * When turn advances, a 'vtt:follow-token' DOM event fires. VTTCanvas
 * intercepts it and pans the viewport to center on that token.
 * Clicking the color swatch also fires the event manually.
 */

import { useState }     from 'react'
import { useVTTStore }  from '../store'
import type { Combatant } from '../types'
import { ALL_CONDITIONS, CONDITION_COLORS } from '../types'

interface Props {
  open:    boolean
  onClose: () => void
}

function emitFollow(id: string): void {
  window.dispatchEvent(new CustomEvent('vtt:follow-token', { detail: { id } }))
}

export function InitiativeTracker({ open, onClose }: Props) {
  const combatActive    = useVTTStore(s => s.combatActive)
  const combatRound     = useVTTStore(s => s.combatRound)
  const activeIndex     = useVTTStore(s => s.activeIndex)
  const combatants      = useVTTStore(s => s.combatants)

  const startCombat       = useVTTStore(s => s.startCombat)
  const endCombat         = useVTTStore(s => s.endCombat)
  const addAllTokens      = useVTTStore(s => s.addAllTokens)
  const addCombatant      = useVTTStore(s => s.addCombatant)
  const removeCombatant   = useVTTStore(s => s.removeCombatant)
  const updateCombatant   = useVTTStore(s => s.updateCombatant)
  const clearCombatants   = useVTTStore(s => s.clearCombatants)
  const rollAllInitiatives = useVTTStore(s => s.rollAllInitiatives)
  const rollInitiative    = useVTTStore(s => s.rollInitiative)
  const sortCombatants    = useVTTStore(s => s.sortCombatants)
  const nextTurn          = useVTTStore(s => s.nextTurn)
  const prevTurn          = useVTTStore(s => s.prevTurn)
  const syncHp            = useVTTStore(s => s.syncHp)
  const tokens            = useVTTStore(s => s.tokens)

  // Track which row is expanded for condition editing
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!open) return null

  const activeId = combatants[activeIndex]?.id ?? null

  // Tokens not yet in tracker
  const tokenIds = Object.keys(tokens)
  const inTracker = new Set(combatants.map(c => c.id))
  const untracked = tokenIds.filter(id => !inTracker.has(id))

  function handleHpChange(c: Combatant, raw: string) {
    const n = raw === '' ? null : parseInt(raw)
    syncHp(c.id, isNaN(n as number) ? null : n)
  }

  function handleMaxHpChange(c: Combatant, raw: string) {
    const n = raw === '' ? null : parseInt(raw)
    updateCombatant(c.id, { maxHp: isNaN(n as number) ? null : n })
  }

  function handleInitChange(c: Combatant, raw: string) {
    const n = raw === '' ? null : parseInt(raw)
    updateCombatant(c.id, { initiative: isNaN(n as number) ? null : n })
  }

  function toggleCondition(c: Combatant, cond: string) {
    const conds = c.conditions.includes(cond as Combatant['conditions'][number])
      ? c.conditions.filter(x => x !== cond)
      : [...c.conditions, cond as Combatant['conditions'][number]]
    updateCombatant(c.id, { conditions: conds })
  }

  const hpBarColor = (c: Combatant) => {
    if (c.maxHp == null || c.hp == null) return '#4b5563'
    const pct = c.hp / c.maxHp
    if (pct > 0.5) return '#22c55e'
    if (pct > 0.25) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="tracker-panel">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="tracker-header">
        <div className="tracker-title">
          <span>⚔</span>
          <span>Combat</span>
          {combatActive && (
            <span className="tracker-round">Round {combatRound}</span>
          )}
        </div>
        <button className="tracker-close-btn" onClick={onClose} title="Close tracker">✕</button>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="tracker-controls">
        <div className="tracker-btn-row">
          {!combatActive
            ? <button className="tracker-btn primary" onClick={startCombat} disabled={combatants.length === 0}>
                ▶ Start Combat
              </button>
            : <button className="tracker-btn danger" onClick={endCombat}>
                ■ End Combat
              </button>
          }
        </div>

        <div className="tracker-btn-row">
          <button className="tracker-btn" onClick={addAllTokens} title="Add all map tokens">
            + All Tokens
          </button>
          <button className="tracker-btn" onClick={rollAllInitiatives} title="Roll d20 for unrolled combatants">
            🎲 Roll All
          </button>
          <button className="tracker-btn" onClick={sortCombatants} title="Re-sort by initiative">
            ↕ Sort
          </button>
          <button className="tracker-btn danger-soft" onClick={clearCombatants} title="Clear all combatants">
            🗑
          </button>
        </div>

        {/* Add individual untracked token */}
        {untracked.length > 0 && (
          <select
            className="tracker-add-select"
            value=""
            onChange={e => { if (e.target.value) addCombatant(e.target.value) }}
          >
            <option value="">+ Add token…</option>
            {untracked.map(id => (
              <option key={id} value={id}>
                {tokens[id]?.label || id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Combatant list ─────────────────────────────────────────────── */}
      <div className="tracker-list">
        {combatants.length === 0 && (
          <div className="tracker-empty">
            No combatants. Click "Add All Tokens" or add individually.
          </div>
        )}

        {combatants.map((c, idx) => {
          const isActive  = combatActive && idx === activeIndex
          const isExpanded = expandedId === c.id
          const hpPct = (c.maxHp && c.hp != null) ? Math.max(0, c.hp / c.maxHp) : 1

          return (
            <div
              key={c.id}
              className={`tracker-row ${isActive ? 'active' : ''} ${c.conditions.includes('dead') ? 'dead' : ''}`}
            >
              {/* Active indicator */}
              <div className="tracker-active-arrow">{isActive ? '▶' : ''}</div>

              {/* Color swatch (click = camera follow) */}
              <button
                className="tracker-swatch"
                style={{ background: c.color }}
                title="Center camera on token"
                onClick={() => emitFollow(c.id)}
              />

              {/* Initiative input */}
              <input
                type="number"
                className="tracker-init-input"
                value={c.initiative ?? ''}
                placeholder="—"
                min={1}
                max={30}
                title="Initiative"
                onChange={e => handleInitChange(c, e.target.value)}
              />

              {/* Name */}
              <input
                type="text"
                className="tracker-name-input"
                value={c.name}
                onChange={e => updateCombatant(c.id, { name: e.target.value })}
                title={c.name}
              />

              {/* Roll d20 for this combatant */}
              <button
                className="tracker-roll-btn"
                title="Roll d20"
                onClick={() => rollInitiative(c.id)}
              >
                🎲
              </button>

              {/* Expand for HP/AC/conditions */}
              <button
                className="tracker-expand-btn"
                title="Edit HP, AC, conditions"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                {isExpanded ? '▲' : '▼'}
              </button>

              {/* Remove */}
              <button
                className="tracker-remove-btn"
                title="Remove from tracker"
                onClick={() => removeCombatant(c.id)}
              >
                ✕
              </button>

              {/* HP bar */}
              {c.maxHp != null && (
                <div className="tracker-hp-bar-row">
                  <div className="tracker-hp-bar-bg">
                    <div
                      className="tracker-hp-bar-fill"
                      style={{ width: `${hpPct * 100}%`, background: hpBarColor(c) }}
                    />
                  </div>
                </div>
              )}

              {/* Expanded detail row */}
              {isExpanded && (
                <div className="tracker-detail">
                  <div className="tracker-detail-row">
                    <label className="tracker-detail-label">HP</label>
                    <input
                      type="number"
                      className="tracker-detail-input"
                      value={c.hp ?? ''}
                      placeholder="—"
                      onChange={e => handleHpChange(c, e.target.value)}
                    />
                    <span className="tracker-detail-sep">/</span>
                    <input
                      type="number"
                      className="tracker-detail-input"
                      value={c.maxHp ?? ''}
                      placeholder="—"
                      onChange={e => handleMaxHpChange(c, e.target.value)}
                    />
                  </div>

                  <div className="tracker-detail-row">
                    <label className="tracker-detail-label">AC</label>
                    <input
                      type="number"
                      className="tracker-detail-input"
                      value={c.ac ?? ''}
                      placeholder="—"
                      onChange={e => {
                        const n = e.target.value === '' ? null : parseInt(e.target.value)
                        updateCombatant(c.id, { ac: isNaN(n as number) ? null : n })
                      }}
                    />
                    <label className="tracker-detail-label" style={{ marginLeft: 8 }}>Init+</label>
                    <input
                      type="number"
                      className="tracker-detail-input"
                      value={c.initiativeBonus}
                      onChange={e => updateCombatant(c.id, { initiativeBonus: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="tracker-detail-row">
                    <label className="tracker-detail-label">Surprised</label>
                    <input
                      type="checkbox"
                      checked={c.isSurprised}
                      onChange={e => updateCombatant(c.id, { isSurprised: e.target.checked })}
                    />
                  </div>

                  {/* Conditions */}
                  <div className="tracker-conditions-label">Conditions</div>
                  <div className="tracker-conditions-grid">
                    {ALL_CONDITIONS.map(cond => (
                      <button
                        key={cond}
                        className={`tracker-cond-btn ${c.conditions.includes(cond) ? 'active' : ''}`}
                        style={c.conditions.includes(cond)
                          ? { background: CONDITION_COLORS[cond], borderColor: CONDITION_COLORS[cond] }
                          : {}
                        }
                        onClick={() => toggleCondition(c, cond)}
                        title={cond}
                      >
                        {cond.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Active conditions mini-badges */}
              {!isExpanded && c.conditions.length > 0 && (
                <div className="tracker-cond-badges">
                  {c.conditions.map(cond => (
                    <span
                      key={cond}
                      className="tracker-cond-badge"
                      style={{ background: CONDITION_COLORS[cond] }}
                      title={cond}
                    >
                      {cond.slice(0, 3)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Turn controls ──────────────────────────────────────────────── */}
      {combatActive && combatants.length > 0 && (
        <div className="tracker-turn-row">
          <button className="tracker-btn" onClick={prevTurn}>◀ Prev</button>
          <div className="tracker-active-name">
            {activeId && (combatants.find(c => c.id === activeId)?.name ?? '—')}
          </div>
          <button className="tracker-btn primary" onClick={nextTurn}>Next ▶</button>
        </div>
      )}
    </div>
  )
}
