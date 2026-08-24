/**
 * TokenContextMenu.tsx — Floating action bar anchored under the selected token.
 *
 * Mirrors the interaction model used by mainstream VTTs: selecting a token (or
 * right-clicking it) reveals its common actions right where the token is,
 * instead of forcing a trip to a sidebar.
 *
 * Actions: Hide/Show, Lock/Unlock, Duplicate, Layer, Delete.
 *
 * GM-only. Players never see this menu, and neither does the GM while
 * previewing the player view.
 */

import { useVTTStore }  from '../store'
import { nanoid }       from '../utils/nanoid'
import type { Token, TokenLayer } from '../types'

const LAYERS: { value: TokenLayer; label: string; hint: string }[] = [
  { value: 'terrain', label: 'Terrain', hint: 'Below tokens — props, furniture, terrain' },
  { value: 'tokens',  label: 'Tokens',  hint: 'Default layer for characters' },
  { value: 'gm',      label: 'GM',      hint: 'Visible to the GM only' },
]

/**
 * Produce the next label in a numbered series.
 *
 * "Goblin 1" → "Goblin 2", and when other copies already exist the highest
 * number in that series wins, so duplicating "Goblin 1" three times yields
 * 2, 3, 4 rather than three copies of 2. An unnumbered label gains " 2".
 */
export function nextLabelInSeries(label: string, existing: string[]): string {
  const match  = label.match(/^(.*?)(\d+)\s*$/)
  const prefix = match ? match[1] : `${label} `
  const start  = match ? parseInt(match[2], 10) : 1

  let highest = start
  const series = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)\\s*$`)
  for (const other of existing) {
    const m = other.match(series)
    if (m) highest = Math.max(highest, parseInt(m[1], 10))
  }
  return `${prefix}${highest + 1}`
}

export function TokenContextMenu() {
  const token      = useVTTStore(s => s.getSingleSelected())
  const activeTool = useVTTStore(s => s.activeTool)
  const viewport   = useVTTStore(s => s.viewport)
  const cellSize   = useVTTStore(s => s.grid.cellSize)
  const execute    = useVTTStore(s => s.execute)
  const isGM       = useVTTStore(s => s.network.isGM)
  const preview    = useVTTStore(s => s.playerPreviewMode)

  if (!token || !isGM || preview) return null
  if (activeTool !== 'select') return null

  function commit(label: string, changes: Partial<Token>) {
    if (!token) return
    const id     = token.id
    const before: Partial<Token> = {}
    for (const key of Object.keys(changes) as (keyof Token)[]) {
      // @ts-expect-error — dynamic key access across a heterogeneous partial
      before[key] = token[key]
    }
    execute({
      label,
      execute: () => useVTTStore.getState().updateToken(id, changes),
      undo:    () => useVTTStore.getState().updateToken(id, before),
    })
  }

  function duplicate() {
    if (!token) return
    const all   = Object.values(useVTTStore.getState().tokens)
    const copy: Token = {
      ...token,
      id:    nanoid(),
      label: nextLabelInSeries(token.label, all.map(t => t.label)),
      x:     token.x + cellSize,
      y:     token.y,
    }
    execute({
      label:   `Duplicate ${token.label}`,
      execute: () => useVTTStore.getState().addToken(copy),
      undo:    () => useVTTStore.getState().deleteToken(copy.id),
    })
    useVTTStore.getState().selectToken(copy.id)
  }

  function remove() {
    if (!token) return
    const snapshot = { ...token }
    execute({
      label:   `Delete ${token.label}`,
      execute: () => useVTTStore.getState().deleteToken(snapshot.id),
      undo:    () => useVTTStore.getState().addToken(snapshot),
    })
    useVTTStore.getState().clearSelection()
  }

  // Anchor the menu just below the token in screen space so it tracks pan/zoom.
  const halfHeight = (token.heightCells * cellSize) / 2
  const screenX    = token.x * viewport.scale + viewport.x
  const screenY    = (token.y + halfHeight) * viewport.scale + viewport.y

  return (
    <div
      className="fixed z-[200] -translate-x-1/2 pointer-events-auto"
      style={{ left: screenX, top: screenY + 10 }}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/85 px-1 py-1 backdrop-blur-sm shadow-lg">
        <MenuButton
          title={token.visible ? 'Hide from players' : 'Show to players'}
          active={!token.visible}
          onClick={() => commit(
            token.visible ? 'Hide token' : 'Show token',
            { visible: !token.visible },
          )}
        >
          {token.visible ? '👁' : '🚫'}
        </MenuButton>

        <MenuButton
          title={token.locked ? 'Unlock — players may move it' : 'Lock — players cannot move it'}
          active={token.locked}
          onClick={() => commit(
            token.locked ? 'Unlock token' : 'Lock token',
            { locked: !token.locked },
          )}
        >
          {token.locked ? '🔒' : '🔓'}
        </MenuButton>

        <MenuButton title="Duplicate" onClick={duplicate}>⧉</MenuButton>

        <div className="mx-0.5 h-5 w-px bg-white/10" />

        <select
          value={token.layer}
          title="Layer"
          onChange={e => commit('Change layer', { layer: e.target.value as TokenLayer })}
          className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-[11px] text-white/70 outline-none hover:text-white"
        >
          {LAYERS.map(l => (
            <option key={l.value} value={l.value} title={l.hint} className="bg-[#12141a] text-white">
              {l.label}
            </option>
          ))}
        </select>

        <div className="mx-0.5 h-5 w-px bg-white/10" />

        <MenuButton title="Delete" danger onClick={remove}>🗑</MenuButton>
      </div>
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface MenuButtonProps {
  title:    string
  active?:  boolean
  danger?:  boolean
  onClick:  () => void
  children: React.ReactNode
}

function MenuButton({ title, active, danger, onClick, children }: MenuButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        'flex h-7 w-7 items-center justify-center rounded text-xs transition-colors',
        danger
          ? 'text-white/70 hover:bg-red-500/20 hover:text-red-300'
          : active
            ? 'bg-amber-500/20 text-amber-300'
            : 'text-white/70 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
