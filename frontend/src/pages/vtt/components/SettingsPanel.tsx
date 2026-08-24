/**
 * SettingsPanel.tsx — Grid, lighting, and fog configuration.
 *
 * Opens from the toolbar ⚙ button. Changes apply live to the canvas.
 */

import { useState }    from 'react'
import { useVTTStore } from '../store'
import type { GridType, FogMode, MeasurementType } from '../types'
import { MEASUREMENT_LABELS } from '../canvas/measure'

interface Props {
  open:    boolean
  onClose: () => void
}

type Tab = 'grid' | 'lighting' | 'fog'

export function SettingsPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('grid')

  // Grid
  const grid    = useVTTStore(s => s.grid)
  const setGrid = useVTTStore(s => s.setGrid)

  // Lighting — derive from scenes array so the selector is reactive
  const ambientLight      = useVTTStore(s =>
    s.scenes.find(sc => sc.id === s.activeSceneId)?.ambientLight ?? 1
  )
  const updateActiveScene = useVTTStore(s => s.updateActiveScene)

  // Fog
  const fog           = useVTTStore(s => s.fog)
  const setFogMode    = useVTTStore(s => s.setFogMode)
  const setFogEnabled = useVTTStore(s => s.setFogEnabled)
  const setFogOpacity = useVTTStore(s => s.setFogOpacity)
  const setFogColor   = useVTTStore(s => s.setFogColor)
  const fogRevealAll  = useVTTStore(s => s.fogRevealAll)
  const fogHideAll    = useVTTStore(s => s.fogHideAll)

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box settings-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">⚙ Settings</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="net-tabs">
          {(['grid', 'lighting', 'fog'] as Tab[]).map(t => (
            <button
              key={t}
              className={`net-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Grid ──────────────────────────────────────────────────────────── */}
        {tab === 'grid' && (
          <div className="settings-body">
            <div className="settings-row">
              <label className="settings-label">Type</label>
              <select
                className="settings-select"
                value={grid.type}
                onChange={e => setGrid({ type: e.target.value as GridType })}
              >
                <option value="square">Square</option>
                <option value="hex-flat">Hex (flat top)</option>
                <option value="hex-pointy">Hex (pointy top)</option>
                <option value="gridless">Gridless</option>
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">
                Cell size
                <span className="settings-unit">{grid.cellSize}px</span>
              </label>
              <input
                type="range" min={20} max={200} step={1}
                value={grid.cellSize}
                onChange={e => setGrid({ cellSize: +e.target.value })}
                className="settings-slider"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Feet per cell</label>
              <input
                type="number" min={1} max={100} step={1}
                value={grid.cellFeet}
                onChange={e => setGrid({ cellFeet: +e.target.value })}
                className="settings-number"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Measure distance by</label>
              <select
                value={grid.measurement}
                onChange={e => setGrid({ measurement: e.target.value as MeasurementType })}
                className="settings-select"
              >
                {(Object.keys(MEASUREMENT_LABELS) as MeasurementType[]).map(m => (
                  <option key={m} value={m}>{MEASUREMENT_LABELS[m]}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">
                Opacity
                <span className="settings-unit">{Math.round(grid.opacity * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={grid.opacity}
                onChange={e => setGrid({ opacity: +e.target.value })}
                className="settings-slider"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Color</label>
              <input
                type="color"
                value={grid.color}
                onChange={e => setGrid({ color: e.target.value })}
                className="settings-color"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Show grid</label>
              <input
                type="checkbox"
                checked={grid.visible}
                onChange={e => setGrid({ visible: e.target.checked })}
                className="settings-check"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Snap to grid</label>
              <input
                type="checkbox"
                checked={grid.snapToGrid}
                onChange={e => setGrid({ snapToGrid: e.target.checked })}
                className="settings-check"
              />
            </div>
          </div>
        )}

        {/* ── Lighting ──────────────────────────────────────────────────────── */}
        {tab === 'lighting' && (
          <div className="settings-body">
            <div className="settings-row">
              <label className="settings-label">
                Ambient light
                <span className="settings-unit">{Math.round(ambientLight * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={ambientLight}
                onChange={e => updateActiveScene({ ambientLight: +e.target.value })}
                className="settings-slider"
              />
            </div>
            <p className="settings-hint">
              0% = pitch black (lighting engine fully active) · 100% = fully lit (no darkness overlay)
            </p>
          </div>
        )}

        {/* ── Fog ───────────────────────────────────────────────────────────── */}
        {tab === 'fog' && (
          <div className="settings-body">
            <div className="settings-row">
              <label className="settings-label">Enable fog</label>
              <input
                type="checkbox"
                checked={fog.enabled}
                onChange={e => setFogEnabled(e.target.checked)}
                className="settings-check"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Mode</label>
              <select
                className="settings-select"
                value={fog.mode}
                onChange={e => setFogMode(e.target.value as FogMode)}
              >
                <option value="manual">Manual — GM paints fog</option>
                <option value="explorer">Explorer — auto-reveal on move</option>
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">
                Opacity
                <span className="settings-unit">{Math.round(fog.opacity * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={fog.opacity}
                onChange={e => setFogOpacity(+e.target.value)}
                className="settings-slider"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Fog color</label>
              <input
                type="color"
                value={fog.color}
                onChange={e => setFogColor(e.target.value)}
                className="settings-color"
              />
            </div>

            <div className="settings-divider" />

            <div className="settings-fog-btns">
              <button className="settings-danger-btn" onClick={() => fogRevealAll()}>
                Reveal All
              </button>
              <button className="settings-danger-btn" onClick={() => fogHideAll()}>
                Hide All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
