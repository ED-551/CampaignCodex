/**
 * LightPanel.tsx — Light source presets and placement controls.
 *
 * Module-level `selectedLightPreset` is read directly by LightTool
 * (same pattern as selectedWallType in WallPanel.tsx).
 *
 * Presets are based on D&D 5e light source descriptions:
 *   Torch      — 20ft bright, 20ft dim (cone, effectively 40ft total)
 *   Lantern    — 30ft bright, 30ft dim
 *   Candle     — 5ft bright,  5ft dim
 *   Campfire   — 30ft bright, 30ft dim
 *   Moon Shard — 0ft bright, 20ft dim (eerie blue glow, no shadows)
 *   Darkness   — 0ft bright,  0ft dim (extinguishes nearby light — future)
 *
 * Also exposes an ambient light slider that controls the scene's overall
 * darkness level (0 = pitch black, 1 = fully lit).
 *
 * Attach-to-token: when exactly one token is selected, the next light
 * placed by LightTool will auto-attach to that token and follow its position.
 */

import { useState }   from 'react'
import { useVTTStore } from '../store'

export interface LightPreset {
  label:          string
  icon:           string
  brightRadiusFt: number
  dimRadiusFt:    number
  color:          string
  intensity:      number
  castsShadows:   boolean
}

// ── Presets ────────────────────────────────────────────────────────────────────

const PRESETS: LightPreset[] = [
  {
    label:          'Torch',
    icon:           '🔥',
    brightRadiusFt: 20,
    dimRadiusFt:    40,
    color:          '#ff8c00',
    intensity:      1,
    castsShadows:   true,
  },
  {
    label:          'Lantern',
    icon:           '🏮',
    brightRadiusFt: 30,
    dimRadiusFt:    60,
    color:          '#ffe4b5',
    intensity:      1,
    castsShadows:   true,
  },
  {
    label:          'Candle',
    icon:           '🕯',
    brightRadiusFt: 5,
    dimRadiusFt:    10,
    color:          '#ffd700',
    intensity:      0.7,
    castsShadows:   true,
  },
  {
    label:          'Campfire',
    icon:           '🪵',
    brightRadiusFt: 30,
    dimRadiusFt:    60,
    color:          '#ff6600',
    intensity:      1,
    castsShadows:   true,
  },
  {
    label:          'Moon Shard',
    icon:           '🌙',
    brightRadiusFt: 0,
    dimRadiusFt:    20,
    color:          '#aaddff',
    intensity:      0.6,
    castsShadows:   false,
  },
  {
    label:          'Sunrod',
    icon:           '☀️',
    brightRadiusFt: 30,
    dimRadiusFt:    60,
    color:          '#ffffff',
    intensity:      1,
    castsShadows:   true,
  },
]

// ── Module-level state (read synchronously by LightTool on click) ──────────────

export let selectedLightPreset: LightPreset = PRESETS[0]

// ── Component ──────────────────────────────────────────────────────────────────

export function LightPanel() {
  const activeTool  = useVTTStore(s => s.activeTool)
  const lights      = useVTTStore(s => s.lights)
  const deleteLight = useVTTStore(s => s.deleteLight)
  const clearLights = useVTTStore(s => s.clearLights)
  const updateScene = useVTTStore(s => s.updateActiveScene)

  const selectedTokenIds = useVTTStore(s => s.selectedTokenIds)
  const hasOneSelected   = selectedTokenIds.size === 1

  // Subscribe to the active scene's ambientLight so the slider re-renders
  // when it changes (getScene() alone doesn't trigger re-renders).
  const ambientLight = useVTTStore(
    s => s.scenes.find(sc => sc.id === s.activeSceneId)?.ambientLight ?? 1
  )

  const [activeIdx, setActiveIdx] = useState(0)

  if (activeTool !== 'light') return null

  function selectPreset(idx: number) {
    setActiveIdx(idx)
    selectedLightPreset = PRESETS[idx]
  }

  return (
    <div className="side-panel left-panel light-panel">
      <div className="panel-header">
        <span className="panel-title">💡 Light Sources</span>
        <span className="panel-hint">
          Click map to place · shift-click to{' '}
          {hasOneSelected ? 'attach to token' : 'place free'}
        </span>
      </div>

      {/* Preset grid */}
      <div className="panel-section">
        <div className="prop-section-label">Presets</div>
        <div className="light-preset-grid">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              className={`light-preset-btn ${i === activeIdx ? 'active' : ''}`}
              onClick={() => selectPreset(i)}
              title={`${p.label}: ${p.brightRadiusFt}ft bright / ${p.dimRadiusFt}ft dim`}
            >
              <span className="light-preset-icon">{p.icon}</span>
              <span className="light-preset-swatch" style={{ background: p.color }} />
              <span className="light-preset-label">{p.label}</span>
              <span className="light-preset-radii">
                {p.brightRadiusFt}/{p.dimRadiusFt}ft
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Attach indicator */}
      {hasOneSelected && (
        <div className="panel-section">
          <div className="prop-row">
            <span className="prop-label" style={{ width: 'auto', flex: 1, fontSize: 10, color: 'rgba(255,200,100,0.8)' }}>
              ✦ Next light will attach to selected token
            </span>
          </div>
        </div>
      )}

      {/* Ambient light slider */}
      <div className="panel-section">
        <div className="prop-section-label">Ambient Light</div>
        <div className="prop-row" style={{ gap: 8, paddingTop: 4 }}>
          <span className="prop-label" style={{ width: 28, fontSize: 10 }}>
            {Math.round(ambientLight * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={ambientLight}
            className="ambient-slider"
            onChange={e => updateScene({ ambientLight: parseFloat(e.target.value) })}
          />
        </div>
        <div className="ambient-labels">
          <span>Pitch dark</span>
          <span>Full daylight</span>
        </div>
      </div>

      {/* Active light list */}
      {Object.values(lights).length > 0 && (
        <div className="panel-section">
          <div className="panel-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="prop-section-label">Active ({Object.values(lights).length})</div>
            <button
              className="clear-lights-btn"
              onClick={clearLights}
              title="Remove all light sources"
            >
              Clear all
            </button>
          </div>
          <div className="light-list">
            {Object.values(lights).map(l => {
              const preset = PRESETS.find(p => p.brightRadiusFt === l.brightRadiusFt && p.dimRadiusFt === l.dimRadiusFt)
              return (
                <div key={l.id} className="light-list-row">
                  <span className="light-list-swatch" style={{ background: l.color }} />
                  <span className="light-list-label">
                    {preset?.icon ?? '💡'} {preset?.label ?? 'Light'}
                    {l.attachedTokenId ? ' (attached)' : ''}
                  </span>
                  <button
                    className="light-list-del"
                    onClick={() => deleteLight(l.id)}
                    title="Remove light"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
