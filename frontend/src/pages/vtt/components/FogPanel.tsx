/**
 * FogPanel.tsx — Fog-of-War controls.
 *
 * Appears when activeTool === 'fog'.
 *
 * Module-level exports (read by FogTool synchronously):
 *   fogShapeMode — which shape the next drag draws
 *   fogCutMode   — whether that shape reveals (true) or covers (false)
 */

import { useState }    from 'react'
import { useVTTStore } from '../store'
import type { FogShapeType } from '../types'

// ── Module-level state read by FogTool ────────────────────────────────────────

export let fogShapeMode: FogShapeType = 'rect'
export let fogCutMode:   boolean      = true

const SHAPES: { value: FogShapeType; label: string; icon: string; hint: string }[] = [
  { value: 'rect',     label: 'Rect',    icon: '▭', hint: 'Drag a rectangle' },
  { value: 'polygon',  label: 'Poly',    icon: '⬠', hint: 'Click points, double-click to close' },
  { value: 'freehand', label: 'Lasso',   icon: '✎', hint: 'Drag a freehand area' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function FogPanel() {
  const activeTool = useVTTStore(s => s.activeTool)

  const fog              = useVTTStore(s => s.fog)
  const setFogMode       = useVTTStore(s => s.setFogMode)
  const setFogEnabled    = useVTTStore(s => s.setFogEnabled)
  const setFogOpacity    = useVTTStore(s => s.setFogOpacity)
  const fogRevealAll     = useVTTStore(s => s.fogRevealAll)
  const fogHideAll       = useVTTStore(s => s.fogHideAll)
  const fogResetExplored = useVTTStore(s => s.fogResetExplored)
  const clearFogShapes   = useVTTStore(s => s.clearFogShapes)
  const setFogFillAll    = useVTTStore(s => s.setFogFillAll)
  const clearedCount     = Object.keys(fog.clearedCells).length

  const [localShape, setLocalShape] = useState<FogShapeType>(fogShapeMode)
  const [localCut,   setLocalCut]   = useState<boolean>(fogCutMode)

  if (activeTool !== 'fog') return null

  function selectShape(shape: FogShapeType) {
    setLocalShape(shape)
    fogShapeMode = shape
  }

  function selectCut(cut: boolean) {
    setLocalCut(cut)
    fogCutMode = cut
  }

  return (
    <div className="side-panel left-panel fog-panel">
      <div className="panel-header">
        <span className="panel-title">☁ Fog of War</span>
        <span className="panel-hint">
          {fog.enabled ? 'Fog active — paint / erase' : 'Fog disabled'}
        </span>
      </div>

      {/* Enable toggle */}
      <div className="panel-section">
        <div className="prop-row">
          <span className="prop-label" style={{ flex: 1 }}>Fog</span>
          <button
            className={`toggle-btn ${fog.enabled ? 'on' : 'off'}`}
            onClick={() => setFogEnabled(!fog.enabled)}
          >
            {fog.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Mode selector */}
      <div className="panel-section">
        <div className="prop-section-label">Mode</div>
        <div className="fog-mode-row">
          <button
            className={`fog-mode-btn ${fog.mode === 'manual' ? 'active' : ''}`}
            onClick={() => setFogMode('manual')}
            title="GM manually paints and erases fog"
          >
            <span>✏ Manual</span>
            <span className="fog-mode-desc">GM paints</span>
          </button>
          <button
            className={`fog-mode-btn ${fog.mode === 'explorer' ? 'active' : ''}`}
            onClick={() => setFogMode('explorer')}
            title="Fog lifts as player tokens explore"
          >
            <span>👁 Explorer</span>
            <span className="fog-mode-desc">Tokens reveal</span>
          </button>
        </div>
      </div>

      {/* Shape tools — only in manual mode */}
      {fog.mode === 'manual' && (
        <>
          <div className="panel-section">
            <div className="prop-section-label">Shape</div>
            <div className="fog-brush-row">
              {SHAPES.map(s => (
                <button
                  key={s.value}
                  className={`fog-brush-btn ${localShape === s.value ? 'active reveal' : ''}`}
                  onClick={() => selectShape(s.value)}
                  title={s.hint}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="prop-section-label">Drawing will</div>
            <div className="fog-brush-row">
              <button
                className={`fog-brush-btn ${localCut ? 'active reveal' : ''}`}
                onClick={() => selectCut(true)}
                title="Carve a hole in the fog so players can see this area"
              >
                ◌ Reveal
              </button>
              <button
                className={`fog-brush-btn ${!localCut ? 'active hide' : ''}`}
                onClick={() => selectCut(false)}
                title="Cover this area with fog"
              >
                ● Add fog
              </button>
            </div>
            <p className="panel-hint" style={{ paddingTop: 6 }}>
              {localShape === 'polygon'
                ? 'Click to add points · click the first point, double-click, or press Enter to close · Esc cancels'
                : localShape === 'rect'
                  ? 'Drag a rectangle'
                  : 'Drag to lasso an area'}
            </p>
          </div>
        </>
      )}

      {/* Opacity */}
      <div className="panel-section">
        <div className="prop-section-label">Fog Opacity</div>
        <div className="prop-row" style={{ gap: 8, paddingTop: 4 }}>
          <span className="prop-label" style={{ width: 28, fontSize: 10 }}>
            {Math.round(fog.opacity * 100)}%
          </span>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={fog.opacity}
            className="ambient-slider"
            onChange={e => setFogOpacity(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div className="panel-section">
        <div className="prop-section-label">Quick Actions</div>
        <div className="fog-actions">
          <button
            className="fog-action-btn reveal"
            onClick={fogRevealAll}
            title="Remove all fog — players see everything"
          >
            ☀ Reveal All
          </button>
          {fog.mode === 'manual' ? (
            <>
              <button
                className="fog-action-btn hide"
                onClick={() => { setFogFillAll(true); setFogEnabled(true) }}
                title="Blanket the whole canvas in fog, then carve out rooms with Reveal"
              >
                🌑 Fill Fog
              </button>
              <button
                className="fog-action-btn reset"
                onClick={clearFogShapes}
                title="Delete every fog shape and lift the blanket"
              >
                ↺ Clear Fog
              </button>
            </>
          ) : (
            <button
              className="fog-action-btn hide"
              onClick={fogHideAll}
              title="Cover everything with fog"
            >
              🌑 Hide All
            </button>
          )}
          {fog.mode === 'explorer' && (
            <button
              className="fog-action-btn reset"
              onClick={fogResetExplored}
              title="Reset explorer fog — players start exploring again from scratch"
            >
              ↺ Reset Explored
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="panel-section fog-stats">
        <span>
          {fog.revealAll
            ? 'All fog revealed'
            : fog.mode === 'manual'
              ? `${fog.shapes.length} shape${fog.shapes.length === 1 ? '' : 's'}${fog.fillAll ? ' · filled' : ''}`
              : `${clearedCount.toLocaleString()} cells explored`}
        </span>
      </div>
    </div>
  )
}
