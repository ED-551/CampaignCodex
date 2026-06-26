/**
 * FogPanel.tsx — Fog-of-War controls.
 *
 * Appears when activeTool === 'fog'.
 *
 * Module-level exports (read by FogTool synchronously):
 *   fogBrushMode   — 'reveal' | 'hide'   (eraser vs painter)
 *   fogBrushRadius — number               (radius in grid cells)
 */

import { useState }    from 'react'
import { useVTTStore } from '../store'

// ── Module-level state read by FogTool ────────────────────────────────────────

export let fogBrushMode:   'reveal' | 'hide' = 'reveal'
export let fogBrushRadius: number             = 2

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
  const clearedCount     = Object.keys(fog.clearedCells).length

  const [localBrushMode,   setLocalBrushMode]   = useState<'reveal' | 'hide'>('reveal')
  const [localBrushRadius, setLocalBrushRadius] = useState<number>(2)

  if (activeTool !== 'fog') return null

  function selectBrushMode(mode: 'reveal' | 'hide') {
    setLocalBrushMode(mode)
    fogBrushMode = mode
  }

  function selectBrushRadius(r: number) {
    setLocalBrushRadius(r)
    fogBrushRadius = r
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

      {/* Brush controls — only in manual mode */}
      {fog.mode === 'manual' && (
        <div className="panel-section">
          <div className="prop-section-label">Brush</div>
          <div className="fog-brush-row">
            <button
              className={`fog-brush-btn ${localBrushMode === 'reveal' ? 'active reveal' : ''}`}
              onClick={() => selectBrushMode('reveal')}
              title="Erase fog (reveal area)"
            >
              ◌ Reveal
            </button>
            <button
              className={`fog-brush-btn ${localBrushMode === 'hide' ? 'active hide' : ''}`}
              onClick={() => selectBrushMode('hide')}
              title="Paint fog (hide area)"
            >
              ● Hide
            </button>
          </div>

          <div className="prop-row" style={{ gap: 8, paddingTop: 6 }}>
            <span className="prop-label" style={{ width: 50, fontSize: 10 }}>
              Size {localBrushRadius}
            </span>
            <input
              type="range"
              min={0.5}
              max={6}
              step={0.5}
              value={localBrushRadius}
              className="ambient-slider"
              onChange={e => selectBrushRadius(parseFloat(e.target.value))}
            />
          </div>
        </div>
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
          <button
            className="fog-action-btn hide"
            onClick={fogHideAll}
            title="Cover everything with fog"
          >
            🌑 Hide All
          </button>
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
            ? 'All cells revealed'
            : `${clearedCount.toLocaleString()} cells cleared`}
        </span>
      </div>
    </div>
  )
}
