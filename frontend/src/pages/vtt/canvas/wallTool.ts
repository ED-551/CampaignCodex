/**
 * wallTool.ts — Interactive wall drawing tool.
 *
 * State machine:
 *   idle      → user presses W or clicks the Wall tool button
 *   drawing   → first point placed; subsequent clicks add points
 *               double-click or Enter finishes the wall
 *   Escape    → cancel and discard the in-progress wall
 *
 * Snap behavior:
 *   • Snap to grid intersections (when snapToGrid is on)
 *   • Magnetic snap to existing wall endpoints within 12px world-space
 *
 * The in-progress wall is drawn as a preview Graphics object in the UI layer.
 * On finish, it is committed to the wall store as a permanent Wall object.
 *
 * Registers itself with InteractionManager so it receives pointer events
 * only when the Wall tool is active.
 */

import { Container, Graphics }    from 'pixi.js'
import { nanoid }                  from '../utils/nanoid'
import { snapToGridPoint }         from './grid'
import { useVTTStore }             from '../store'
import { InteractionManager }      from './interactionManager'
import { selectedWallType }        from '../components/WallPanel'
import type { Point, Wall }        from '../types'

const SNAP_RADIUS_PX = 14   // magnetic snap distance to existing endpoints (world-space px)
const PREVIEW_COLOR  = 0x60a5fa
const PREVIEW_ALPHA  = 0.8

export class WallTool {
  private preview:     Graphics        // in-progress wall preview
  private points:      Point[]  = []
  private interaction: InteractionManager

  constructor(uiLayer: Container, interaction: InteractionManager) {
    this.interaction = interaction
    this.preview     = new Graphics()
    uiLayer.addChild(this.preview)

    // Register handlers with InteractionManager
    interaction.registerToolHandler('wall', {
      onPointerDown: this.onPointerDown.bind(this),
      onPointerMove: this.onPointerMove.bind(this),
      onPointerUp:   (_w, e) => { if (e.detail === 2) this.finish() },  // double-click
    })

    window.addEventListener('keydown', this.onKeyDown.bind(this))
  }

  private onPointerDown(world: Point, e: PointerEvent): void {
    if (e.button !== 0) return
    const snapped = this.snapPoint(world)

    if (this.points.length === 0) {
      // Start new wall
      this.points.push(snapped)
    } else {
      // Add next point
      this.points.push(snapped)
      this.drawPreview(snapped)
    }
  }

  private onPointerMove(world: Point, _e: PointerEvent): void {
    if (this.points.length === 0) return
    const snapped = this.snapPoint(world)
    this.drawPreview(snapped)
  }

  private onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    if (e.code === 'Enter')  this.finish()
    if (e.code === 'Escape') this.cancel()
    if (e.code === 'KeyZ' && e.ctrlKey) { /* let history handle it */ }
  }

  /** Snap to grid AND to nearby existing wall endpoints. */
  private snapPoint(raw: Point): Point {
    const { grid, walls } = useVTTStore.getState()

    // 1. Try magnetic snap to existing wall endpoints first
    for (const wall of Object.values(walls)) {
      for (const pt of wall.points) {
        if (Math.hypot(pt.x - raw.x, pt.y - raw.y) <= SNAP_RADIUS_PX) {
          return { ...pt }
        }
      }
    }
    // Also snap to in-progress points
    for (const pt of this.points) {
      if (Math.hypot(pt.x - raw.x, pt.y - raw.y) <= SNAP_RADIUS_PX) {
        return { ...pt }
      }
    }

    // 2. Grid snap
    if (grid.snapToGrid) {
      return snapToGridPoint(raw.x, raw.y, grid.cellSize)
    }

    return raw
  }

  private drawPreview(cursor: Point): void {
    this.preview.clear()
    if (this.points.length === 0) return

    // Draw committed segments
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i]
      const b = this.points[i + 1]
      this.preview.moveTo(a.x, a.y).lineTo(b.x, b.y)
    }

    // Draw segment from last committed point to current cursor
    const last = this.points[this.points.length - 1]
    this.preview.moveTo(last.x, last.y).lineTo(cursor.x, cursor.y)

    this.preview.stroke({ color: PREVIEW_COLOR, alpha: PREVIEW_ALPHA, width: 2 })

    // Draw dots at each committed point
    for (const pt of this.points) {
      this.preview.circle(pt.x, pt.y, 4).fill({ color: PREVIEW_COLOR, alpha: 1 })
    }
  }

  private finish(): void {
    if (this.points.length < 2) {
      this.cancel()
      return
    }

    const wall: Wall = {
      id:     nanoid(),
      points: [...this.points],
      type:   selectedWallType,
      isOpen: false,
    }

    const store = useVTTStore.getState()
    store.execute({
      label:   `Draw ${selectedWallType}`,
      execute: () => useVTTStore.getState().addWall(wall),
      undo:    () => useVTTStore.getState().deleteWall(wall.id),
    })

    this.cancel()
  }

  private cancel(): void {
    this.points = []
    this.preview.clear()
  }

  destroy(): void {
    this.interaction.unregisterToolHandler('wall')
    window.removeEventListener('keydown', this.onKeyDown.bind(this))
    this.preview.destroy()
  }
}
