/**
 * DrawingPanel.tsx — Drawing tools + AoE template selector.
 *
 * Visible when activeTool === 'draw'.
 * Module-level exports are read synchronously by DrawingTool on each event.
 *
 * Sub-tool groups:
 *   Annotate: freehand, line, rect, circle, polygon, text, eraser
 *   AoE:      aoe-circle, aoe-cone, aoe-line, aoe-cube
 *
 * Color palette: 8 quick-select swatches + custom hex input.
 */

import { useState }    from 'react'
import { useVTTStore } from '../store'

// ─── Sub-tool types ─────────────────────────────────────────────────────────────

export type DrawSubTool =
  | 'freehand'
  | 'line'
  | 'rect'
  | 'circle'
  | 'polygon'
  | 'text'
  | 'eraser'
  | 'aoe-circle'
  | 'aoe-cone'
  | 'aoe-line'
  | 'aoe-cube'

// ─── Module-level state (read by DrawingTool synchronously) ────────────────────

export let drawSubTool: DrawSubTool  = 'line'
export let drawColor:   string       = '#e74c3c'
export let drawWidth:   number       = 2
export let drawOpacity: number       = 1
export let drawFill:    boolean      = false
export let drawFontSize: number      = 16

// ─── Quick color palette ────────────────────────────────────────────────────────

const PALETTE = [
  '#e74c3c',   // red
  '#f97316',   // orange
  '#eab308',   // yellow
  '#22c55e',   // green
  '#3b82f6',   // blue
  '#a855f7',   // purple
  '#ffffff',   // white
  '#1e293b',   // near-black
]

// ─── Tool defs ──────────────────────────────────────────────────────────────────

interface SubToolDef {
  id:    DrawSubTool
  icon:  string
  label: string
}

const DRAW_TOOLS: SubToolDef[] = [
  { id: 'freehand', icon: '✏',  label: 'Freehand' },
  { id: 'line',     icon: '╱',  label: 'Line'     },
  { id: 'rect',     icon: '▭',  label: 'Rect'     },
  { id: 'circle',   icon: '◯',  label: 'Circle'   },
  { id: 'polygon',  icon: '⬡',  label: 'Polygon'  },
  { id: 'text',     icon: 'T',  label: 'Text'     },
  { id: 'eraser',   icon: '⌫',  label: 'Eraser'   },
]

const AOE_TOOLS: SubToolDef[] = [
  { id: 'aoe-circle', icon: '◎',  label: 'Circle' },
  { id: 'aoe-cone',   icon: '△',  label: 'Cone'   },
  { id: 'aoe-line',   icon: '═',  label: 'Line'   },
  { id: 'aoe-cube',   icon: '⬜', label: 'Cube'   },
]

// ─── Component ──────────────────────────────────────────────────────────────────

export function DrawingPanel() {
  const activeTool  = useVTTStore(s => s.activeTool)
  const clearDrawings = useVTTStore(s => s.clearDrawings)

  const [localSub,     setLocalSub]     = useState<DrawSubTool>('line')
  const [localColor,   setLocalColor]   = useState('#e74c3c')
  const [localWidth,   setLocalWidth]   = useState(2)
  const [localOpacity, setLocalOpacity] = useState(1)
  const [localFill,    setLocalFill]    = useState(false)
  const [localFontSz,  setLocalFontSz]  = useState(16)

  if (activeTool !== 'draw') return null

  function selectSub(id: DrawSubTool) {
    setLocalSub(id)
    drawSubTool = id
  }

  function selectColor(c: string) {
    setLocalColor(c)
    drawColor = c
  }

  function setWidth(w: number) {
    setLocalWidth(w)
    drawWidth = w
  }

  function setOpacity(o: number) {
    setLocalOpacity(o)
    drawOpacity = o
  }

  function setFill(f: boolean) {
    setLocalFill(f)
    drawFill = f
  }

  function setFontSize(s: number) {
    setLocalFontSz(s)
    drawFontSize = s
  }

  const isShape = ['rect', 'circle', 'polygon', 'aoe-circle', 'aoe-cone', 'aoe-line', 'aoe-cube'].includes(localSub)
  const isText  = localSub === 'text'
  const isAoe   = localSub.startsWith('aoe-')

  return (
    <div className="side-panel left-panel draw-panel">
      <div className="panel-header">
        <span className="panel-title">✏ Draw</span>
        <span className="panel-hint">
          {localSub.startsWith('aoe-')
            ? 'Drag to size · release to pin'
            : localSub === 'polygon'
            ? 'Click points · double-click finish'
            : localSub === 'eraser'
            ? 'Click to remove drawing'
            : 'Click and drag'}
        </span>
      </div>

      {/* Annotation sub-tools */}
      <div className="panel-section">
        <div className="prop-section-label">Annotate</div>
        <div className="draw-tool-grid">
          {DRAW_TOOLS.map(t => (
            <button
              key={t.id}
              className={`draw-tool-btn ${localSub === t.id ? 'active' : ''}`}
              onClick={() => selectSub(t.id)}
              title={t.label}
            >
              <span className="draw-tool-icon">{t.icon}</span>
              <span className="draw-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AoE templates */}
      <div className="panel-section">
        <div className="prop-section-label">AoE Templates</div>
        <div className="draw-tool-grid">
          {AOE_TOOLS.map(t => (
            <button
              key={t.id}
              className={`draw-tool-btn aoe ${localSub === t.id ? 'active' : ''}`}
              onClick={() => selectSub(t.id)}
              title={`AoE ${t.label}`}
            >
              <span className="draw-tool-icon">{t.icon}</span>
              <span className="draw-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color palette */}
      {localSub !== 'eraser' && (
        <div className="panel-section">
          <div className="prop-section-label">Color</div>
          <div className="color-palette">
            {PALETTE.map(c => (
              <button
                key={c}
                className={`color-swatch ${localColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => selectColor(c)}
                title={c}
              />
            ))}
            <input
              type="color"
              value={localColor}
              className="color-custom"
              onChange={e => selectColor(e.target.value)}
              title="Custom color"
            />
          </div>
        </div>
      )}

      {/* Stroke width (not for eraser or text) */}
      {!isText && localSub !== 'eraser' && (
        <div className="panel-section">
          <div className="prop-row" style={{ gap: 8 }}>
            <span className="prop-label" style={{ width: 42, fontSize: 10 }}>
              Width {localWidth}
            </span>
            <input
              type="range" min={1} max={12} step={1} value={localWidth}
              className="ambient-slider"
              onChange={e => setWidth(parseInt(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Opacity */}
      {localSub !== 'eraser' && (
        <div className="panel-section">
          <div className="prop-row" style={{ gap: 8 }}>
            <span className="prop-label" style={{ width: 42, fontSize: 10 }}>
              Opacity {Math.round(localOpacity * 100)}%
            </span>
            <input
              type="range" min={0.1} max={1} step={0.05} value={localOpacity}
              className="ambient-slider"
              onChange={e => setOpacity(parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Fill toggle for shapes */}
      {isShape && !isAoe && (
        <div className="panel-section">
          <div className="prop-row">
            <span className="prop-label" style={{ flex: 1 }}>Fill</span>
            <button
              className={`toggle-btn ${localFill ? 'on' : 'off'}`}
              onClick={() => setFill(!localFill)}
            >
              {localFill ? 'Filled' : 'Outline'}
            </button>
          </div>
        </div>
      )}

      {/* Font size for text tool */}
      {isText && (
        <div className="panel-section">
          <div className="prop-row" style={{ gap: 8 }}>
            <span className="prop-label" style={{ width: 42, fontSize: 10 }}>
              Size {localFontSz}px
            </span>
            <input
              type="range" min={10} max={64} step={2} value={localFontSz}
              className="ambient-slider"
              onChange={e => setFontSize(parseInt(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Clear all */}
      <div className="panel-section">
        <button
          className="clear-lights-btn"
          style={{ width: '100%' }}
          onClick={clearDrawings}
          title="Remove all drawings from this scene"
        >
          Clear all drawings
        </button>
      </div>
    </div>
  )
}
