/**
 * TokenProperties.tsx — Right sidebar for the selected token.
 *
 * Appears when exactly one token is selected with the Select tool.
 * Allows editing: label, HP, max HP, AC, sight radius, conditions,
 * visibility, and locked state.
 *
 * All changes go through the store and are wrapped in history Commands.
 */

import { useState, useEffect } from 'react'
import { useVTTStore }         from '../store'
import { ALL_CONDITIONS, CONDITION_COLORS } from '../types'
import type { Token, Condition }            from '../types'

export function TokenProperties() {
  const token    = useVTTStore(s => s.getSingleSelected())
  const execute  = useVTTStore(s => s.execute)

  const [label,       setLabel      ] = useState('')
  const [hp,          setHp         ] = useState('')
  const [maxHp,       setMaxHp      ] = useState('')
  const [ac,          setAc         ] = useState('')
  const [sightRadius, setSightRadius ] = useState('')

  // Sync local state when the selected token changes
  useEffect(() => {
    if (!token) return
    setLabel(token.label)
    setHp(token.hp    !== null ? String(token.hp)    : '')
    setMaxHp(token.maxHp !== null ? String(token.maxHp) : '')
    setAc(token.ac    !== null ? String(token.ac)    : '')
    setSightRadius(String(token.sightRadius))
  }, [token?.id])  // only re-run when a different token is selected

  if (!token) return null

  function commit(changes: Partial<Token>) {
    if (!token) return
    const before: Partial<Token> = {}
    for (const k of Object.keys(changes) as (keyof Token)[]) {
      // @ts-expect-error — dynamic key access
      before[k] = token[k]
    }
    execute({
      label:   'Edit token',
      execute: () => useVTTStore.getState().updateToken(token.id, changes),
      undo:    () => useVTTStore.getState().updateToken(token.id, before),
    })
  }

  function commitLabel() {
    commit({ label: label.trim() || 'Token' })
  }

  function commitNumber(field: keyof Token, raw: string) {
    const val = raw === '' ? null : parseInt(raw, 10)
    if (raw !== '' && isNaN(val as number)) return
    commit({ [field]: val } as Partial<Token>)
  }

  function toggleCondition(cond: Condition) {
    if (!token) return
    const next = token.conditions.includes(cond)
      ? token.conditions.filter(c => c !== cond)
      : [...token.conditions, cond]
    commit({ conditions: next })
  }

  return (
    <aside className="side-panel right-panel">
      <div className="panel-header">
        <span className="panel-title">Token</span>
        <span className="panel-hint">
          {token.widthCells > 1 ? `${token.widthCells}×${token.widthCells}` : 'Medium'}
        </span>
      </div>

      {/* Label */}
      <div className="prop-row">
        <label className="prop-label">Name</label>
        <input
          className="prop-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => e.key === 'Enter' && commitLabel()}
          placeholder="Token name"
        />
      </div>

      {/* HP row */}
      <div className="prop-row">
        <label className="prop-label">HP</label>
        <input
          className="prop-input narrow"
          type="number"
          value={hp}
          onChange={e => setHp(e.target.value)}
          onBlur={() => commitNumber('hp', hp)}
          placeholder="—"
        />
        <span className="prop-sep">/</span>
        <input
          className="prop-input narrow"
          type="number"
          value={maxHp}
          onChange={e => setMaxHp(e.target.value)}
          onBlur={() => commitNumber('maxHp', maxHp)}
          placeholder="—"
        />
      </div>

      {/* AC */}
      <div className="prop-row">
        <label className="prop-label">AC</label>
        <input
          className="prop-input narrow"
          type="number"
          value={ac}
          onChange={e => setAc(e.target.value)}
          onBlur={() => commitNumber('ac', ac)}
          placeholder="—"
        />
      </div>

      {/* Sight */}
      <div className="prop-row">
        <label className="prop-label">Sight</label>
        <input
          className="prop-input narrow"
          type="number"
          value={sightRadius}
          onChange={e => setSightRadius(e.target.value)}
          onBlur={() => {
            const v = parseInt(sightRadius, 10)
            if (!isNaN(v)) commit({ sightRadius: v })
          }}
        />
        <span className="prop-unit">ft</span>
      </div>

      {/* Visible / Locked toggles */}
      <div className="prop-row">
        <label className="prop-label">Visible</label>
        <button
          className={`toggle-btn ${token.visible ? 'on' : 'off'}`}
          onClick={() => commit({ visible: !token.visible })}
        >
          {token.visible ? 'Yes' : 'No'}
        </button>
      </div>
      <div className="prop-row">
        <label className="prop-label">Locked</label>
        <button
          className={`toggle-btn ${token.locked ? 'on' : 'off'}`}
          onClick={() => commit({ locked: !token.locked })}
        >
          {token.locked ? 'Yes' : 'No'}
        </button>
      </div>

      {/* Conditions */}
      <div className="prop-section-label">Conditions</div>
      <div className="condition-grid">
        {ALL_CONDITIONS.map(cond => {
          const active = token.conditions.includes(cond)
          const color  = CONDITION_COLORS[cond]
          return (
            <button
              key={cond}
              className={`cond-btn ${active ? 'active' : ''}`}
              onClick={() => toggleCondition(cond)}
              style={active ? { borderColor: color, color } : undefined}
              title={cond}
            >
              {cond.slice(0, 4)}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
