/**
 * MapAlignPanel.tsx — Line an imported map's printed grid up with the scene grid.
 *
 * A downloaded battle map almost never arrives at the scene's cell size, so
 * tokens land between squares and every distance is wrong. Rather than make
 * the GM guess at a scale factor, this panel asks the one question they can
 * answer by looking: how many of the map's own squares span its width?
 *
 * From that, the scale needed to make one printed square equal one scene cell
 * follows directly, and nudge controls handle the offset.
 */

import { useEffect, useState } from 'react'
import { useVTTStore }         from '../store'

interface Props {
  open:    boolean
  onClose: () => void
}

export function MapAlignPanel({ open, onClose }: Props) {
  const background  = useVTTStore(s => s.getActiveScene().background)
  const cellSize    = useVTTStore(s => s.grid.cellSize)
  const updateScene = useVTTStore(s => s.updateActiveScene)

  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)
  const [squares,      setSquares]      = useState('20')

  // The image's own pixel width is what the scale factor is derived from, and
  // it is not stored on the scene, so read it back off the loaded image.
  useEffect(() => {
    if (!background?.imageUrl) { setNaturalWidth(null); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => { if (!cancelled) setNaturalWidth(img.naturalWidth) }
    img.src = background.imageUrl
    return () => { cancelled = true }
  }, [background?.imageUrl])

  if (!open) return null

  if (!background) {
    return (
      <Shell onClose={onClose}>
        <p className="panel-hint">
          No map on this scene yet. Drag an image onto the canvas to set one.
        </p>
      </Shell>
    )
  }

  const nudge = (dx: number, dy: number) =>
    updateScene({ background: { ...background, offsetX: background.offsetX + dx, offsetY: background.offsetY + dy } })

  const setScale = (s: number) =>
    updateScene({ background: { ...background, scaleX: s, scaleY: s } })

  function applySquares() {
    const count = parseFloat(squares)
    if (!naturalWidth || !Number.isFinite(count) || count <= 0) return
    // One printed square must end up the same size as one scene cell:
    //   (imageWidth / count) * scale = cellSize
    setScale((cellSize * count) / naturalWidth)
  }

  const currentScale = background.scaleX
  const printedCell  = naturalWidth ? (naturalWidth * currentScale) / Math.max(1, parseFloat(squares) || 1) : 0

  return (
    <Shell onClose={onClose}>
      <div className="panel-section">
        <div className="prop-section-label">Match the map's grid</div>
        <p className="panel-hint" style={{ paddingBottom: 8 }}>
          Count the squares across the full width of your map image and enter
          that number. One of its squares will then equal one grid cell.
        </p>
        <div className="prop-row" style={{ gap: 8 }}>
          <input
            type="number" min={1} step={1}
            value={squares}
            onChange={e => setSquares(e.target.value)}
            className="settings-number"
          />
          <button className="net-primary-btn" onClick={applySquares} disabled={!naturalWidth}>
            Fit
          </button>
        </div>
        {naturalWidth && (
          <p className="panel-hint" style={{ paddingTop: 6 }}>
            Image is {naturalWidth}px wide · a printed square currently spans{' '}
            {printedCell.toFixed(1)}px against a {cellSize}px cell
          </p>
        )}
      </div>

      <div className="panel-section">
        <div className="prop-section-label">
          Scale <span className="settings-unit">{(currentScale * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range" min={0.05} max={4} step={0.01}
          value={currentScale}
          className="ambient-slider"
          onChange={e => setScale(parseFloat(e.target.value))}
        />
      </div>

      <div className="panel-section">
        <div className="prop-section-label">Nudge into place</div>
        <div className="align-pad">
          <button onClick={() => nudge(0, -cellSize)} title="Up one cell">↑</button>
          <div className="align-pad-row">
            <button onClick={() => nudge(-cellSize, 0)} title="Left one cell">←</button>
            <button onClick={() => nudge(cellSize, 0)}  title="Right one cell">→</button>
          </div>
          <button onClick={() => nudge(0, cellSize)} title="Down one cell">↓</button>
        </div>
        <div className="fog-brush-row" style={{ paddingTop: 6 }}>
          <button className="fog-brush-btn" onClick={() => nudge(-1, 0)}>◄ 1px</button>
          <button className="fog-brush-btn" onClick={() => nudge(1, 0)}>1px ►</button>
          <button className="fog-brush-btn" onClick={() => nudge(0, -1)}>▲ 1px</button>
          <button className="fog-brush-btn" onClick={() => nudge(0, 1)}>▼ 1px</button>
        </div>
        <p className="panel-hint" style={{ paddingTop: 6 }}>
          Offset {Math.round(background.offsetX)}, {Math.round(background.offsetY)}
        </p>
      </div>

      <div className="panel-section">
        <div className="fog-brush-row">
          <button
            className={`fog-brush-btn ${background.locked ? 'active reveal' : ''}`}
            onClick={() => updateScene({ background: { ...background, locked: !background.locked } })}
            title={background.locked ? 'Unlock the map' : 'Lock so it cannot be nudged by accident'}
          >
            {background.locked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
          <button
            className="fog-brush-btn"
            onClick={() => updateScene({ background: { ...background, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 } })}
          >
            ↺ Reset
          </button>
          <button
            className="fog-brush-btn"
            onClick={() => updateScene({ background: null })}
            title="Remove the map from this scene"
          >
            ✕ Remove
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="asset-panel-backdrop" onClick={onClose}>
      <aside className="asset-panel" onClick={e => e.stopPropagation()}>
        <div className="asset-panel-header">
          <span className="asset-panel-title">🗺 Map Alignment</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </aside>
    </div>
  )
}
