/**
 * interactionManager.ts — Canvas pointer events → store actions.
 *
 * Routes pointer events to the correct handler based on the active tool:
 *
 *  select  → click token to select, drag to move, empty-space drag = box select
 *  token   → click canvas to place a new token from the pending placement
 *
 * Additional tools (wall, draw, fog, measure) are added in their respective chunks
 * and will register themselves here via registerToolHandler().
 *
 * This class is the single point where raw DOM events become store actions.
 * It does NOT import React — it is purely imperative.
 */

import { Graphics, Container }   from 'pixi.js'
import { useVTTStore }            from '../store'
import { snapToCellCenter }       from './grid'
import { nanoid }                 from '../utils/nanoid'
import type { Token, Point }      from '../types'

interface ToolHandler {
  onPointerDown?: (world: Point, e: PointerEvent) => void
  onPointerMove?: (world: Point, e: PointerEvent) => void
  onPointerUp?:   (world: Point, e: PointerEvent) => void
}

export class InteractionManager {
  private canvas:     HTMLCanvasElement
  private boxRect:    Graphics           // box-select rectangle drawn in UI layer

  // Drag state
  private isDragging      = false
  private isBoxSelecting  = false
  private dragTokenIds:   string[]  = []
  private dragStartWorld: Point     = { x: 0, y: 0 }
  private dragStartTokenPositions: Map<string, Point> = new Map()
  private boxStart:       Point     = { x: 0, y: 0 }

  // External tool handlers (registered by wall tool, fog tool, etc.)
  private toolHandlers: Map<string, ToolHandler> = new Map()

  private handlers: {
    pointerdown: (e: PointerEvent) => void
    pointermove: (e: PointerEvent) => void
    pointerup:   (e: PointerEvent) => void
    keydown:     (e: KeyboardEvent) => void
  }

  constructor(canvas: HTMLCanvasElement, uiLayer: Container) {
    this.canvas  = canvas
    this.boxRect = new Graphics()
    uiLayer.addChild(this.boxRect)

    this.handlers = {
      pointerdown: this.onPointerDown.bind(this),
      pointermove: this.onPointerMove.bind(this),
      pointerup:   this.onPointerUp.bind(this),
      keydown:     this.onKeyDown.bind(this),
    }

    canvas.addEventListener('pointerdown', this.handlers.pointerdown)
    window.addEventListener('pointermove', this.handlers.pointermove)
    window.addEventListener('pointerup',   this.handlers.pointerup)
    window.addEventListener('keydown',     this.handlers.keydown)
  }

  /** Let tool-specific classes register their own pointer handlers. */
  registerToolHandler(tool: string, handler: ToolHandler): void {
    this.toolHandlers.set(tool, handler)
  }

  unregisterToolHandler(tool: string): void {
    this.toolHandlers.delete(tool)
  }

  // ─── Coordinate helper ────────────────────────────────────────────────────────

  private screenToWorld(sx: number, sy: number): Point {
    const vp   = useVTTStore.getState().viewport
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (sx - rect.left - vp.x) / vp.scale,
      y: (sy - rect.top  - vp.y) / vp.scale,
    }
  }

  // ─── Hit testing ──────────────────────────────────────────────────────────────

  /** Returns the topmost token at world point, or null. */
  private hitTestToken(wx: number, wy: number): Token | null {
    const { tokens, grid } = useVTTStore.getState()
    const cs               = grid.cellSize

    // Iterate in reverse so topmost (last added) wins
    const all = Object.values(tokens).reverse()
    for (const token of all) {
      if (!token.visible) continue
      const half = (token.widthCells * cs) / 2
      if (
        wx >= token.x - half && wx <= token.x + half &&
        wy >= token.y - half && wy <= token.y + half
      ) {
        return token
      }
    }
    return null
  }

  // ─── Pointer event handlers ───────────────────────────────────────────────────

  private onPointerDown(e: PointerEvent): void {
    // Skip middle mouse (pan) and right mouse (context menu)
    if (e.button !== 0) return
    // Skip if the event target is a UI overlay element (React components)
    if ((e.target as HTMLElement) !== this.canvas) return

    const world = this.screenToWorld(e.clientX, e.clientY)
    const { activeTool, grid } = useVTTStore.getState()

    // Delegate to registered tool handler if one exists for this tool
    const handler = this.toolHandlers.get(activeTool)
    if (handler?.onPointerDown) {
      handler.onPointerDown(world, e)
      return
    }

    if (activeTool === 'select') {
      this.handleSelectDown(world, e)
    } else if (activeTool === 'token') {
      this.handleTokenPlacement(world, grid.cellSize, grid.snapToGrid)
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const world = this.screenToWorld(e.clientX, e.clientY)
    const { activeTool } = useVTTStore.getState()

    const handler = this.toolHandlers.get(activeTool)
    if (handler?.onPointerMove) {
      handler.onPointerMove(world, e)
      return
    }

    if (this.isDragging) {
      this.handleTokenDrag(world)
    } else if (this.isBoxSelecting) {
      this.drawBoxSelect(world)
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0) return
    const world = this.screenToWorld(e.clientX, e.clientY)
    const { activeTool } = useVTTStore.getState()

    const handler = this.toolHandlers.get(activeTool)
    if (handler?.onPointerUp) {
      handler.onPointerUp(world, e)
      return
    }

    if (this.isDragging) {
      this.finishDrag()
    } else if (this.isBoxSelecting) {
      this.finishBoxSelect(world)
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).tagName === 'INPUT') return

    const store = useVTTStore.getState()

    // Delete selected tokens
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedTokenIds.size > 0) {
      e.preventDefault()
      const ids     = [...store.selectedTokenIds]
      const deleted = ids.map(id => ({ ...store.tokens[id] }))

      store.execute({
        label:   `Delete ${ids.length} token(s)`,
        execute: () => useVTTStore.getState().deleteTokens(ids),
        undo:    () => {
          for (const t of deleted) useVTTStore.getState().addToken(t)
        },
      })
    }

    // Arrow key nudge (1 cell per press)
    const { selectedTokenIds, tokens, grid } = store
    if (selectedTokenIds.size > 0 && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const step = grid.snapToGrid ? grid.cellSize : 4
      const dx   = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
      const dy   = e.key === 'ArrowDown'  ? step : e.key === 'ArrowUp'   ? -step : 0
      for (const id of selectedTokenIds) {
        const t = tokens[id]
        if (t) useVTTStore.getState().moveToken(id, t.x + dx, t.y + dy)
      }
    }

    // Escape → clear selection / cancel tool
    if (e.key === 'Escape') {
      useVTTStore.getState().clearSelection()
    }

    // Undo / redo
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); store.undo() }
    if (e.ctrlKey && (e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault(); store.redo()
    }

    // Ctrl+A — select all visible tokens
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault()
      useVTTStore.getState().selectTokens(Object.keys(useVTTStore.getState().tokens))
    }

    // Ctrl+D — duplicate selected tokens (offset by one cell)
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault()
      const { selectedTokenIds, tokens, grid } = useVTTStore.getState()
      if (selectedTokenIds.size === 0) return
      const offset    = grid.cellSize
      const copies: Token[] = []
      for (const id of selectedTokenIds) {
        const t = tokens[id]
        if (t) copies.push({ ...t, id: nanoid(), x: t.x + offset, y: t.y + offset })
      }
      store.execute({
        label:   `Duplicate ${copies.length} token(s)`,
        execute: () => { for (const t of copies) useVTTStore.getState().addToken(t) },
        undo:    () => { for (const t of copies) useVTTStore.getState().deleteToken(t.id) },
      })
      useVTTStore.getState().selectTokens(copies.map(t => t.id))
    }

    // Ctrl+G — toggle grid visibility
    if (e.ctrlKey && e.key === 'g') {
      e.preventDefault()
      const g = useVTTStore.getState().grid
      useVTTStore.getState().setGrid({ visible: !g.visible })
    }

    // Home / Numpad 0 — reset viewport
    if (e.key === 'Home' || e.key === '0' && e.metaKey) {
      e.preventDefault()
      useVTTStore.getState().resetViewport()
    }
  }

  // ─── Select tool helpers ───────────────────────────────────────────────────────

  private handleSelectDown(world: Point, e: PointerEvent): void {
    const hit   = this.hitTestToken(world.x, world.y)
    const store = useVTTStore.getState()

    if (hit) {
      // Token clicked: select it (additive with Shift), then prepare for drag
      if (!store.selectedTokenIds.has(hit.id)) {
        store.selectToken(hit.id, e.shiftKey)
      }

      // Prepare drag — track all currently selected tokens' start positions
      this.isDragging  = true
      this.dragTokenIds = [...useVTTStore.getState().selectedTokenIds]
      this.dragStartWorld = { ...world }
      this.dragStartTokenPositions.clear()
      for (const id of this.dragTokenIds) {
        const t = store.tokens[id]
        if (t) this.dragStartTokenPositions.set(id, { x: t.x, y: t.y })
      }
    } else {
      // Empty space: deselect (unless shift) + start box select
      if (!e.shiftKey) store.clearSelection()
      this.isBoxSelecting = true
      this.boxStart       = { ...world }
    }
  }

  private handleTokenDrag(world: Point): void {
    const { grid } = useVTTStore.getState()
    const dx = world.x - this.dragStartWorld.x
    const dy = world.y - this.dragStartWorld.y

    for (const id of this.dragTokenIds) {
      const start = this.dragStartTokenPositions.get(id)
      if (!start) continue
      let nx = start.x + dx
      let ny = start.y + dy
      if (grid.snapToGrid) {
        const snapped = snapToCellCenter(nx, ny, grid.cellSize)
        nx = snapped.x
        ny = snapped.y
      }
      // moveToken is intentionally not wrapped in history (too many events during drag)
      useVTTStore.getState().moveToken(id, nx, ny)
    }
  }

  private finishDrag(): void {
    // Record the final positions as a single undoable command
    const finalPositions = new Map<string, Point>()
    const store = useVTTStore.getState()
    for (const id of this.dragTokenIds) {
      const t = store.tokens[id]
      if (t) finalPositions.set(id, { x: t.x, y: t.y })
    }
    const startPositions = new Map(this.dragStartTokenPositions)
    const ids = [...this.dragTokenIds]

    store.execute({
      label:   `Move ${ids.length} token(s)`,
      execute: () => {
        for (const id of ids) {
          const p = finalPositions.get(id)
          if (p) useVTTStore.getState().moveToken(id, p.x, p.y)
        }
      },
      undo: () => {
        for (const id of ids) {
          const p = startPositions.get(id)
          if (p) useVTTStore.getState().moveToken(id, p.x, p.y)
        }
      },
    })

    this.isDragging   = false
    this.dragTokenIds = []
    this.dragStartTokenPositions.clear()
  }

  // ─── Box select helpers ────────────────────────────────────────────────────────

  private drawBoxSelect(world: Point): void {
    const x = Math.min(this.boxStart.x, world.x)
    const y = Math.min(this.boxStart.y, world.y)
    const w = Math.abs(world.x - this.boxStart.x)
    const h = Math.abs(world.y - this.boxStart.y)

    this.boxRect.clear()
    this.boxRect.rect(x, y, w, h)
      .fill({ color: 0x60a5fa, alpha: 0.12 })
    this.boxRect.rect(x, y, w, h)
      .stroke({ color: 0x60a5fa, width: 1, alpha: 0.7 })
  }

  private finishBoxSelect(world: Point): void {
    this.boxRect.clear()
    this.isBoxSelecting = false

    const minX = Math.min(this.boxStart.x, world.x)
    const maxX = Math.max(this.boxStart.x, world.x)
    const minY = Math.min(this.boxStart.y, world.y)
    const maxY = Math.max(this.boxStart.y, world.y)

    const { tokens, grid } = useVTTStore.getState()
    const cs = grid.cellSize

    const ids = Object.values(tokens)
      .filter(t => {
        const half = (t.widthCells * cs) / 2
        return t.x + half > minX && t.x - half < maxX &&
               t.y + half > minY && t.y - half < maxY
      })
      .map(t => t.id)

    useVTTStore.getState().selectTokens(ids)
  }

  // ─── Token placement (Token tool) ─────────────────────────────────────────────

  private handleTokenPlacement(world: Point, cellSize: number, snap: boolean): void {
    const store = useVTTStore.getState()
    // pendingTokenTemplate is set by the Token Panel when a token type is selected
    const template = store.pendingTokenTemplate
    if (!template) return

    let x = world.x
    let y = world.y
    if (snap) {
      const c = snapToCellCenter(x, y, cellSize)
      x = c.x; y = c.y
    }

    const token: Token = {
      ...template,
      id: nanoid(),
      x,
      y,
    }

    store.execute({
      label:   `Place ${token.label}`,
      execute: () => useVTTStore.getState().addToken(token),
      undo:    () => useVTTStore.getState().deleteToken(token.id),
    })
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.handlers.pointerdown)
    window.removeEventListener('pointermove',  this.handlers.pointermove)
    window.removeEventListener('pointerup',    this.handlers.pointerup)
    window.removeEventListener('keydown',      this.handlers.keydown)
    this.boxRect.destroy()
  }
}
