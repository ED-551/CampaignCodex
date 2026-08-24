/**
 * fogTool.ts — Hand-drawn fog geometry.
 *
 * Active only when activeTool === 'fog' AND fog.mode === 'manual'. Reads the
 * current shape mode and add/cut setting from FogPanel's module-level exports.
 *
 * Shape modes
 * ───────────
 * • rect      press, drag, release — the dragged rectangle becomes the shape.
 * • polygon   click to drop points; double-click (or Enter) closes the shape;
 *             Escape abandons it.
 * • freehand  press and drag a lasso; releasing closes it automatically.
 *
 * Whether a finished shape adds fog or cuts it away is decided by `fogCutMode`
 * at the moment it is committed. Cuts are what reveal a room; deleting the cut
 * puts the fog back.
 */

import { Graphics, Container }                    from 'pixi.js'
import { InteractionManager }                     from './interactionManager'
import { useVTTStore }                            from '../store'
import { nanoid }                                 from '../utils/nanoid'
import { fogShapeMode, fogCutMode }               from '../components/FogPanel'
import type { Point, FogShape }                   from '../types'

const ADD_COLOR = 0x60a5fa   // blue — this shape will add fog
const CUT_COLOR = 0x34d399   // green — this shape will reveal

/** Sample spacing for the freehand lasso, in world pixels. */
const FREEHAND_MIN_STEP = 6

/** Click within this many screen pixels of an existing point to close a polygon. */
const CLOSE_RADIUS_PX = 12

export class FogTool {
  private interaction: InteractionManager
  private preview:     Graphics

  private isDrawing  = false
  private start:      Point | null = null   // rect anchor
  private points:     Point[] = []          // polygon / freehand points

  constructor(uiLayer: Container, interaction: InteractionManager) {
    this.interaction = interaction

    this.preview = new Graphics()
    uiLayer.addChild(this.preview)

    interaction.registerToolHandler('fog', {
      onPointerDown: this.onPointerDown.bind(this),
      onPointerMove: this.onPointerMove.bind(this),
      onPointerUp:   this.onPointerUp.bind(this),
    })

    this.onKeyDown = this.onKeyDown.bind(this)
    window.addEventListener('keydown', this.onKeyDown)
  }

  // ── Pointer handling ────────────────────────────────────────────────────────

  private onPointerDown(world: Point, e: PointerEvent): void {
    if (e.button !== 0) return
    if (useVTTStore.getState().fog.mode !== 'manual') return

    if (fogShapeMode === 'polygon') {
      // Close when the click lands on a point we already placed — either the
      // first (closing the loop) or the last (a double-click, whose second
      // click naturally lands on the point the first one just placed).
      //
      // Deliberately not keyed off e.detail: browsers only bump the click
      // count when clicks are close in both time and space, so a GM placing
      // points quickly would trip it by accident.
      const threshold = CLOSE_RADIUS_PX / useVTTStore.getState().viewport.scale
      const near = (p: Point) => Math.hypot(p.x - world.x, p.y - world.y) <= threshold

      if (this.points.length >= 3 && (near(this.points[0]) || near(this.points[this.points.length - 1]))) {
        this.commitPolygon()
        return
      }
      if (this.points.length > 0 && near(this.points[this.points.length - 1])) {
        // Too close to be a distinct point but not yet enough to close.
        return
      }

      this.points.push(world)
      this.isDrawing = true
      this.drawPreview(world)
      return
    }

    this.isDrawing = true
    this.start     = world
    this.points    = [world]
    this.drawPreview(world)
  }

  private onPointerMove(world: Point, _e: PointerEvent): void {
    if (!this.isDrawing) return

    if (fogShapeMode === 'freehand') {
      const last = this.points[this.points.length - 1]
      if (!last || Math.hypot(world.x - last.x, world.y - last.y) >= FREEHAND_MIN_STEP) {
        this.points.push(world)
      }
    }
    this.drawPreview(world)
  }

  private onPointerUp(world: Point, _e: PointerEvent): void {
    if (!this.isDrawing) return

    if (fogShapeMode === 'rect')     { this.commitRect(world); return }
    if (fogShapeMode === 'freehand') { this.commitFreehand();  return }
    // Polygon keeps collecting points across clicks — nothing to do on release.
  }

  private onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return
    if (useVTTStore.getState().activeTool !== 'fog') return
    if (e.key === 'Enter')  this.commitPolygon()
    if (e.key === 'Escape') this.cancel()
  }

  // ── Commit ──────────────────────────────────────────────────────────────────

  private commit(points: number[]): void {
    if (points.length < 6) { this.cancel(); return }

    const shape: FogShape = {
      id:     nanoid(),
      type:   fogShapeMode,
      points,
      cut:    fogCutMode,
    }

    const store = useVTTStore.getState()
    store.execute({
      label:   fogCutMode ? 'Reveal fog' : 'Add fog',
      execute: () => useVTTStore.getState().addFogShape(shape),
      undo:    () => useVTTStore.getState().deleteFogShape(shape.id),
    })

    // Drawing fog implies wanting to see it.
    if (!store.fog.enabled) store.setFogEnabled(true)

    this.cancel()
  }

  private commitRect(end: Point): void {
    if (!this.start) { this.cancel(); return }
    const { x: x0, y: y0 } = this.start
    const { x: x1, y: y1 } = end
    if (Math.abs(x1 - x0) < 2 || Math.abs(y1 - y0) < 2) { this.cancel(); return }
    this.commit([x0, y0, x1, y0, x1, y1, x0, y1])
  }

  private commitFreehand(): void {
    this.commit(this.points.flatMap(p => [p.x, p.y]))
  }

  private commitPolygon(): void {
    this.commit(this.points.flatMap(p => [p.x, p.y]))
  }

  private cancel(): void {
    this.isDrawing = false
    this.start     = null
    this.points    = []
    this.preview.clear()
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  private drawPreview(cursor: Point): void {
    const vp    = useVTTStore.getState().viewport
    const color = fogCutMode ? CUT_COLOR : ADD_COLOR
    const toScreen = (p: Point) => ({
      x: p.x * vp.scale + vp.x,
      y: p.y * vp.scale + vp.y,
    })

    this.preview.clear()

    if (fogShapeMode === 'rect' && this.start) {
      const a = toScreen(this.start)
      const b = toScreen(cursor)
      this.preview
        .rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
        .fill({ color, alpha: 0.25 })
      this.preview
        .rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
        .stroke({ color, alpha: 0.9, width: 2 })
      return
    }

    if (this.points.length === 0) return

    const screen = this.points.map(toScreen)
    const path   = [...screen, toScreen(cursor)]

    this.preview.poly(path.flatMap(p => [p.x, p.y])).fill({ color, alpha: 0.2 })
    this.preview.moveTo(path[0].x, path[0].y)
    for (const p of path.slice(1)) this.preview.lineTo(p.x, p.y)
    this.preview.stroke({ color, alpha: 0.9, width: 2 })

    // Vertex handles make it obvious where a polygon point landed.
    if (fogShapeMode === 'polygon') {
      for (const p of screen) {
        this.preview.circle(p.x, p.y, 4).fill({ color, alpha: 1 })
      }
    }
  }

  destroy(): void {
    this.interaction.unregisterToolHandler('fog')
    window.removeEventListener('keydown', this.onKeyDown)
    this.preview.destroy()
  }
}
