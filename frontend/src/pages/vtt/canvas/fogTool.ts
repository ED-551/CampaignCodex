/**
 * fogTool.ts — Manual fog painting brush.
 *
 * Active only when activeTool === 'fog' AND fog.mode === 'manual'.
 * Reads brush settings (radius, mode) from FogPanel module-level exports.
 *
 * Brush behaviour
 * ───────────────
 * • Left-click / drag:  reveal cells (erase fog) when brushMode === 'reveal'
 *   OR hide cells (paint fog) when brushMode === 'hide'.
 * • Cells are committed to the store on every pointer-move during a stroke
 *   (batched per-move so large strokes remain interactive).
 * • A circle preview follows the cursor on the UI layer.
 *
 * Cell calculation
 * ────────────────
 * Given world position (wx, wy), find all cells whose center is within
 * brushRadius * cellSize pixels of (wx, wy). This gives a smooth circular
 * brush regardless of cell size.
 */

import { Graphics, Container }           from 'pixi.js'
import { InteractionManager }            from './interactionManager'
import { useVTTStore }                   from '../store'
import { fogBrushMode, fogBrushRadius }  from '../components/FogPanel'
import type { Point }                    from '../types'

export class FogTool {
  private interaction: InteractionManager
  private preview:    Graphics    // cursor ring drawn in UI layer (screen coords)
  private isPainting  = false

  constructor(uiLayer: Container, interaction: InteractionManager) {
    this.interaction = interaction

    this.preview = new Graphics()
    uiLayer.addChild(this.preview)

    interaction.registerToolHandler('fog', {
      onPointerDown: this.onPointerDown.bind(this),
      onPointerMove: this.onPointerMove.bind(this),
      onPointerUp:   this.onPointerUp.bind(this),
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private getBrushCells(worldX: number, worldY: number): string[] {
    const { grid } = useVTTStore.getState()
    const cs       = grid.cellSize
    const rPx      = fogBrushRadius * cs
    const rCells   = Math.ceil(fogBrushRadius) + 1
    const originCol = Math.floor(worldX / cs)
    const originRow = Math.floor(worldY / cs)
    const cells: string[] = []

    for (let col = originCol - rCells; col <= originCol + rCells; col++) {
      for (let row = originRow - rCells; row <= originRow + rCells; row++) {
        const cx = (col + 0.5) * cs
        const cy = (row + 0.5) * cs
        const dist = Math.hypot(cx - worldX, cy - worldY)
        if (dist <= rPx) cells.push(`${col},${row}`)
      }
    }
    return cells
  }

  private applyBrush(world: Point): void {
    const state = useVTTStore.getState()
    if (state.fog.mode !== 'manual') return
    const cells = this.getBrushCells(world.x, world.y)
    if (cells.length === 0) return
    if (fogBrushMode === 'reveal') {
      state.fogRevealCells(cells)
    } else {
      state.fogHideCells(cells)
    }
  }

  private drawPreview(screenX: number, screenY: number): void {
    const { grid, viewport } = useVTTStore.getState()
    const radiusScreen = fogBrushRadius * grid.cellSize * viewport.scale

    this.preview.clear()

    // Outer ring — shows brush size
    this.preview
      .circle(screenX, screenY, radiusScreen)
      .stroke({ color: 0xffffff, alpha: 0.7, width: 1.5 })

    // Inner dot — shows center point
    this.preview
      .circle(screenX, screenY, 2)
      .fill({ color: 0xffffff, alpha: 0.8 })
  }

  // ── ToolHandler callbacks ─────────────────────────────────────────────────────

  private onPointerDown(world: Point, e: PointerEvent): void {
    this.isPainting = true
    this.applyBrush(world)

    // Draw preview at screen coords
    const rect = (e.target as HTMLElement).getBoundingClientRect?.() ?? { left: 0, top: 0 }
    this.drawPreview(e.clientX - rect.left, e.clientY - rect.top)
  }

  private onPointerMove(world: Point, e: PointerEvent): void {
    const rect = (e.target as HTMLElement).getBoundingClientRect?.() ?? { left: 0, top: 0 }
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    this.drawPreview(sx, sy)

    if (this.isPainting) {
      this.applyBrush(world)
    }
  }

  private onPointerUp(_world: Point, _e: PointerEvent): void {
    this.isPainting = false
  }

  destroy(): void {
    this.interaction.unregisterToolHandler('fog')
    this.preview.destroy()
  }
}
