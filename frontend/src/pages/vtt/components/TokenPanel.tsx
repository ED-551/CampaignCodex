/**
 * TokenPanel.tsx — Left sidebar: token library and placement controls.
 *
 * Appears when the Token tool (T) is active.
 * Shows a built-in library of placeholder tokens (colored circles/squares
 * by size) and any user-imported tokens (Chunk 10: Asset Library).
 *
 * Clicking a token in the library sets it as the pending template.
 * The user then clicks the canvas to place it at that location.
 */

import { useVTTStore }        from '../store'
import type { TokenTemplate } from '../store/tokenSlice'
import type { Token }         from '../types'

// ─── Built-in placeholder library ────────────────────────────────────────────

interface PlaceholderDef {
  label:      string
  shape:      Token['shape']
  color:      string
  widthCells: number
}

const PLACEHOLDERS: PlaceholderDef[] = [
  { label: 'Tiny',        shape: 'circle', color: '#94a3b8', widthCells: 1 },
  { label: 'Small',       shape: 'circle', color: '#94a3b8', widthCells: 1 },
  { label: 'Medium PC',   shape: 'circle', color: '#60a5fa', widthCells: 1 },
  { label: 'Medium NPC',  shape: 'circle', color: '#f59e0b', widthCells: 1 },
  { label: 'Monster',     shape: 'circle', color: '#ef4444', widthCells: 1 },
  { label: 'Large',       shape: 'square', color: '#f97316', widthCells: 2 },
  { label: 'Huge',        shape: 'square', color: '#a855f7', widthCells: 3 },
  { label: 'Gargantuan',  shape: 'square', color: '#ec4899', widthCells: 4 },
]

function makeTemplate(p: PlaceholderDef): TokenTemplate {
  return {
    layer:           'tokens',
    widthCells:      p.widthCells,
    heightCells:     p.widthCells,
    image:           null,
    shape:           p.shape,
    color:           p.color,
    label:           p.label,
    hp:              null,
    maxHp:           null,
    ac:              null,
    sightRadius:     60,
    emitsLight:      false,
    lightBrightFt:   0,
    lightDimFt:      0,
    lightColor:      '#ffffff',
    conditions:      [],
    visible:         true,
    locked:          false,
    playerOwnerIds:  [],
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TokenPanel() {
  const activeTool            = useVTTStore(s => s.activeTool)
  const pendingTemplate       = useVTTStore(s => s.pendingTokenTemplate)
  const setPendingTemplate    = useVTTStore(s => s.setPendingTokenTemplate)

  if (activeTool !== 'token') return null

  return (
    <aside className="side-panel left-panel">
      <div className="panel-header">
        <span className="panel-title">Token Library</span>
        <span className="panel-hint">Click to select, then click canvas to place</span>
      </div>

      <div className="token-grid">
        {PLACEHOLDERS.map((p) => {
          const tmpl     = makeTemplate(p)
          const isActive = pendingTemplate?.label === p.label &&
                           pendingTemplate?.color === p.color
          return (
            <button
              key={`${p.label}-${p.color}`}
              className={`token-lib-btn ${isActive ? 'active' : ''}`}
              onClick={() => setPendingTemplate(isActive ? null : tmpl)}
              title={p.label}
            >
              <svg width="36" height="36" viewBox="0 0 36 36">
                {p.shape === 'circle'
                  ? <circle cx="18" cy="18" r="15" fill={p.color} stroke="#000" strokeOpacity="0.3" strokeWidth="1.5" />
                  : <rect x="3" y="3" width="30" height="30" rx="3" fill={p.color} stroke="#000" strokeOpacity="0.3" strokeWidth="1.5" />
                }
              </svg>
              <span className="token-lib-label">{p.label}</span>
            </button>
          )
        })}
      </div>

      {pendingTemplate && (
        <div className="panel-hint" style={{ marginTop: 12 }}>
          Click the canvas to place <strong>{pendingTemplate.label}</strong>
        </div>
      )}
    </aside>
  )
}
