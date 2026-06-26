/**
 * Toolbar.tsx — Fixed left-side toolbar with tool buttons and scene controls.
 *
 * Active tools: select (V), token (T), wall (W), light (L), fog (F), draw (D), measure (M)
 * Extra actions: grid toggle (#), undo (↩), redo (↪), asset library (🖼 A), combat (⚔ I)
 */

import { useVTTStore }  from '../store'
import type { Tool }    from '../types'

interface ToolDef {
  tool:     Tool
  label:    string
  key:      string
  icon:     string
  ready:    boolean
}

const TOOLS: ToolDef[] = [
  { tool: 'select',  label: 'Select',   key: 'V', icon: '↖', ready: true  },
  { tool: 'token',   label: 'Token',    key: 'T', icon: '◉', ready: true  },
  { tool: 'wall',    label: 'Wall',     key: 'W', icon: '▌', ready: true  },
  { tool: 'light',   label: 'Light',    key: 'L', icon: '💡', ready: true  },
  { tool: 'fog',     label: 'Fog',      key: 'F', icon: '☁', ready: true  },
  { tool: 'draw',    label: 'Draw',     key: 'D', icon: '✏', ready: true  },
  { tool: 'measure', label: 'Measure',  key: 'M', icon: '📏',ready: true  },
  { tool: 'ping',    label: 'Ping',     key: 'P', icon: '🔔', ready: true  },
]

interface Props {
  onOpenAssets:      () => void
  assetPanelOpen:    boolean
  onOpenCombat:      () => void
  combatPanelOpen:   boolean
  onOpenScenes:      () => void
  scenePanelOpen:    boolean
  onOpenSettings:    () => void
  settingsPanelOpen: boolean
}

export function Toolbar({ onOpenAssets, assetPanelOpen, onOpenCombat, combatPanelOpen, onOpenScenes, scenePanelOpen, onOpenSettings, settingsPanelOpen }: Props) {
  const activeTool  = useVTTStore(s => s.activeTool)
  const setTool     = useVTTStore(s => s.setTool)
  const gridVisible = useVTTStore(s => s.grid.visible)
  const setGrid     = useVTTStore(s => s.setGrid)
  const canUndo     = useVTTStore(s => s.canUndo)
  const canRedo     = useVTTStore(s => s.canRedo)
  const undo        = useVTTStore(s => s.undo)
  const redo        = useVTTStore(s => s.redo)

  return (
    <aside className="toolbar">
      {/* Tool buttons */}
      <div className="toolbar-group">
        {TOOLS.map(({ tool, label, key, icon, ready }) => (
          <button
            key={tool}
            className={[
              'tool-btn',
              activeTool === tool ? 'active' : '',
              !ready ? 'disabled' : '',
            ].join(' ').trim()}
            onClick={() => ready && setTool(tool)}
            title={`${label}  [${key}]${!ready ? '  (coming soon)' : ''}`}
            disabled={!ready}
          >
            <span className="tool-icon">{icon}</span>
            <span className="tool-key">{key}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Asset library + combat tracker toggles */}
      <div className="toolbar-group">
        <button
          className={`tool-btn ${assetPanelOpen ? 'active' : ''}`}
          onClick={onOpenAssets}
          title="Asset Library  [A]"
        >
          <span className="tool-icon">🖼</span>
          <span className="tool-key">A</span>
        </button>
        <button
          className={`tool-btn ${combatPanelOpen ? 'active' : ''}`}
          onClick={onOpenCombat}
          title="Initiative Tracker  [I]"
        >
          <span className="tool-icon">⚔</span>
          <span className="tool-key">I</span>
        </button>
        <button
          className={`tool-btn ${scenePanelOpen ? 'active' : ''}`}
          onClick={onOpenScenes}
          title="Scene Manager  [S]"
        >
          <span className="tool-icon">⛺</span>
          <span className="tool-key">S</span>
        </button>
        <button
          className={`tool-btn ${settingsPanelOpen ? 'active' : ''}`}
          onClick={onOpenSettings}
          title="Settings  [,]"
        >
          <span className="tool-icon">⚙</span>
          <span className="tool-key">,</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Grid toggle */}
      <div className="toolbar-group">
        <button
          className={`tool-btn ${gridVisible ? 'active' : ''}`}
          onClick={() => setGrid({ visible: !gridVisible })}
          title="Toggle grid  [Ctrl+G]"
        >
          <span className="tool-icon">#</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button
          className="tool-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo  [Ctrl+Z]"
        >
          <span className="tool-icon">↩</span>
        </button>
        <button
          className="tool-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo  [Ctrl+Y]"
        >
          <span className="tool-icon">↪</span>
        </button>
      </div>
    </aside>
  )
}
