/**
 * WallPanel.tsx — Sub-toolbar for wall type selection.
 *
 * Visible only when the Wall tool (W) is active.
 * Lets the GM choose wall type before drawing: wall, door, window, invisible.
 * The selected type is stored in local state and read by WallTool.
 *
 * We expose the type via a Zustand slice-compatible approach: store it in a
 * simple React state here and relay it to the WallTool instance via a ref
 * callback. For now we use a simple module-level variable since WallTool
 * reads from it synchronously on pointer-down.
 */

import { useState }      from 'react'
import { useVTTStore }   from '../store'
import type { WallType } from '../types'

interface WallTypeDef {
  type:  WallType
  label: string
  color: string
  desc:  string
}

const WALL_TYPES: WallTypeDef[] = [
  { type: 'wall',      label: 'Wall',      color: '#aaaacc', desc: 'Blocks vision and movement' },
  { type: 'door',      label: 'Door',      color: '#f59e0b', desc: 'Toggle open/closed' },
  { type: 'window',    label: 'Window',    color: '#22d3ee', desc: 'Blocks movement, passes vision' },
  { type: 'invisible', label: 'Invisible', color: '#a855f7', desc: 'Blocks vision, invisible to players' },
]

/** Module-level so WallTool can read without needing a React ref chain. */
export let selectedWallType: WallType = 'wall'

export function WallPanel() {
  const activeTool = useVTTStore(s => s.activeTool)
  const [active, setActive] = useState<WallType>('wall')

  if (activeTool !== 'wall') return null

  function select(type: WallType) {
    setActive(type)
    selectedWallType = type
  }

  return (
    <aside className="side-panel left-panel">
      <div className="panel-header">
        <span className="panel-title">Wall Type</span>
        <span className="panel-hint">Click canvas to start · Double-click to finish · Esc to cancel</span>
      </div>

      <div className="wall-type-list">
        {WALL_TYPES.map(({ type, label, color, desc }) => (
          <button
            key={type}
            className={`wall-type-btn ${active === type ? 'active' : ''}`}
            onClick={() => select(type)}
            style={active === type ? { borderColor: color } : undefined}
          >
            <span className="wall-type-swatch" style={{ background: color }} />
            <span className="wall-type-info">
              <span className="wall-type-name">{label}</span>
              <span className="wall-type-desc">{desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="panel-section">
        <div className="panel-hint" style={{ marginTop: 4 }}>
          <strong>Tips:</strong><br />
          Snap to grid intersections automatically.<br />
          Hover near an existing endpoint to snap to it.
        </div>
      </div>
    </aside>
  )
}
