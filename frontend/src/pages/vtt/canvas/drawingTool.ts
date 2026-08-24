/**
 * drawingTool.ts — All drawing sub-tools + ruler + AoE templates.
 *
 * Registered for both 'draw' and 'measure' tools with InteractionManager.
 *
 * Sub-tools (set by DrawingPanel module-level vars)
 * ─────────────────────────────────────────────────
 * freehand    pointer-down starts, move accumulates points, up commits
 * line        pointer-down anchors start, move shows preview, up commits
 * rect        pointer-down anchors corner, move shows preview, up commits
 * circle      pointer-down anchors center, move shows radius, up commits
 * polygon     click adds points, double-click closes & commits
 * text        click places a text input at that world position
 * eraser      click removes drawing objects under the cursor
 * aoe-circle  pointer-down anchors center, move shows radius + cell count
 * aoe-cone    pointer-down anchors origin, move shows 53° cone + cell count
 * aoe-line    pointer-down anchors start, move shows 5ft-wide line + cell count
 * aoe-cube    pointer-down anchors corner, move shows square + cell count
 *
 * Measure tool (M key)
 * ────────────────────
 * Click to start ruler, click to add waypoints, double-click / Escape to finish.
 * Shows cumulative distance in feet. Supports Euclidean and 5e Chebyshev modes.
 *
 * Coordinate notes
 * ────────────────
 * All committed Drawing.points are in WORLD space.
 * All preview Graphics live on the UI layer (screen space NOT used — the UI
 * layer is inside the world container, so pointer-world coords work directly).
 *
 * Actually: the UI layer is NOT in the world container (see layers.ts). It sits
 * at the stage level to avoid viewport transform. We therefore store preview
 * points in world space and convert to screen space for drawing the preview.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { InteractionManager }                    from './interactionManager'
import { useVTTStore }                           from '../store'
import { nanoid }                                from '../utils/nanoid'
import { measurePath, formatDistance }           from './measure'
import {
  drawSubTool, drawColor, drawWidth, drawOpacity, drawFill, drawFontSize,
} from '../components/DrawingPanel'
import type { Point, Drawing, DrawingLayer }     from '../types'

// ─── AoE geometry helpers ─────────────────────────────────────────────────────

/** Count grid cells whose center is within `radius` px of `origin`. */
function countCircleCells(origin: Point, radiusPx: number, cellSize: number): number {
  let n = 0
  const r = Math.ceil(radiusPx / cellSize) + 1
  const oc = Math.floor(origin.x / cellSize)
  const or_ = Math.floor(origin.y / cellSize)
  for (let c = oc - r; c <= oc + r; c++) {
    for (let row = or_ - r; row <= or_ + r; row++) {
      const cx = (c + 0.5) * cellSize
      const cy = (row + 0.5) * cellSize
      if (Math.hypot(cx - origin.x, cy - origin.y) <= radiusPx) n++
    }
  }
  return n
}

/** Build the 4 polygon points of a 90° cone (pointing from `origin` toward `dir`).
 *  The 5e standard cone has an angle of 53.13° (width = distance at end).
 *  We use a half-angle of 26.57° → tan = 0.5. */
function conePoints(origin: Point, dir: Point, length: number): number[] {
  const dx = dir.x - origin.x
  const dy = dir.y - origin.y
  const angle = Math.atan2(dy, dx)
  const halfAngle = 26.57 * (Math.PI / 180)  // 5e cone half-angle
  const a1 = angle - halfAngle
  const a2 = angle + halfAngle
  return [
    origin.x, origin.y,
    origin.x + Math.cos(a1) * length, origin.y + Math.sin(a1) * length,
    origin.x + Math.cos(a2) * length, origin.y + Math.sin(a2) * length,
  ]
}

/** Count cells inside a convex polygon defined by flat points array. */
function countPolygonCells(flatPts: number[], cellSize: number): number {
  if (flatPts.length < 6) return 0
  const pts: Point[] = []
  for (let i = 0; i < flatPts.length; i += 2) pts.push({ x: flatPts[i], y: flatPts[i + 1] })

  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const minC = Math.floor(Math.min(...xs) / cellSize) - 1
  const maxC = Math.ceil(Math.max(...xs)  / cellSize) + 1
  const minR = Math.floor(Math.min(...ys) / cellSize) - 1
  const maxR = Math.ceil(Math.max(...ys)  / cellSize) + 1

  let n = 0
  for (let c = minC; c <= maxC; c++) {
    for (let r = minR; r <= maxR; r++) {
      const cx = (c + 0.5) * cellSize
      const cy = (r + 0.5) * cellSize
      if (pointInConvexPoly({ x: cx, y: cy }, pts)) n++
    }
  }
  return n
}

function pointInConvexPoly(pt: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    if (((yi > pt.y) !== (yj > pt.y)) &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}


// ─── Preview drawing helpers (screen space via viewport transform) ─────────────

function toScreen(p: Point): Point {
  const { viewport: vp } = useVTTStore.getState()
  return { x: p.x * vp.scale + vp.x, y: p.y * vp.scale + vp.y }
}

function toScreenFlat(pts: number[]): number[] {
  const { viewport: vp } = useVTTStore.getState()
  const out: number[] = []
  for (let i = 0; i < pts.length; i += 2) {
    out.push(pts[i] * vp.scale + vp.x, pts[i+1] * vp.scale + vp.y)
  }
  return out
}

function labelStyle(): TextStyle {
  return new TextStyle({
    fontFamily: 'ui-monospace, monospace',
    fontSize:   12,
    fill:       '#ffffff',
    stroke:     { color: '#000000', width: 3 },
  })
}

// ─── Main tool class ──────────────────────────────────────────────────────────

type Phase =
  | 'idle'
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
  | 'measure'

export class DrawingTool {
  private interaction: InteractionManager
  private previewG:   Graphics      // live shape preview
  private labelT:     Text          // distance / cell-count label
  private textInput:  HTMLInputElement | null = null

  private phase:         Phase   = 'idle'
  private startPt:       Point   = { x: 0, y: 0 }
  private polyPoints:    Point[] = []    // polygon & measure waypoints
  private freehandPts:   number[] = []  // flat world-space points
  private isPainting     = false

  constructor(uiLayer: Container, interaction: InteractionManager) {
    this.interaction = interaction

    this.previewG = new Graphics()
    uiLayer.addChild(this.previewG)

    this.labelT = new Text({ text: '', style: labelStyle() })
    this.labelT.visible = false
    uiLayer.addChild(this.labelT)

    interaction.registerToolHandler('draw',    this.makeHandler('draw'))
    interaction.registerToolHandler('measure', this.makeHandler('measure'))
  }

  private makeHandler(toolName: 'draw' | 'measure') {
    return {
      onPointerDown: (world: Point, e: PointerEvent) => this.onDown(world, e, toolName),
      onPointerMove: (world: Point, e: PointerEvent) => this.onMove(world, e),
      onPointerUp:   (world: Point, e: PointerEvent) => this.onUp(world, e),
    }
  }

  // ─── Down ────────────────────────────────────────────────────────────────────

  private onDown(world: Point, e: PointerEvent, toolName: 'draw' | 'measure'): void {
    if (toolName === 'measure') {
      this.handleMeasureDown(world, e)
      return
    }

    const sub = drawSubTool

    // Polygon: accumulate on each click, double-click commits
    if (sub === 'polygon') {
      if (this.phase === 'polygon' && e.detail >= 2) {
        this.commitPolygon()
        return
      }
      this.phase = 'polygon'
      this.polyPoints.push({ ...world })
      return
    }

    // Eraser: on click, remove topmost drawing under cursor
    if (sub === 'eraser') {
      this.eraseAt(world)
      return
    }

    // Text: show input at click position
    if (sub === 'text') {
      this.showTextInput(world, e)
      return
    }

    // All drag-based tools start here
    this.startPt   = { ...world }
    this.isPainting = true

    if (sub === 'freehand') {
      this.phase        = 'freehand'
      this.freehandPts  = [world.x, world.y]
    } else if (sub === 'aoe-circle')  { this.phase = 'aoe-circle' }
    else if (sub === 'aoe-cone')   { this.phase = 'aoe-cone' }
    else if (sub === 'aoe-line')   { this.phase = 'aoe-line' }
    else if (sub === 'aoe-cube')   { this.phase = 'aoe-cube' }
    else if (sub === 'line')       { this.phase = 'line' }
    else if (sub === 'rect')       { this.phase = 'rect' }
    else if (sub === 'circle')     { this.phase = 'circle' }
  }

  // ─── Move ────────────────────────────────────────────────────────────────────

  private onMove(world: Point, _e: PointerEvent): void {
    if (!this.isPainting && this.phase !== 'polygon' && this.phase !== 'measure') return

    if (this.phase === 'freehand' && this.isPainting) {
      this.freehandPts.push(world.x, world.y)
      this.drawFreehandPreview()
      return
    }

    this.previewG.clear()
    this.labelT.visible = false

    switch (this.phase) {
      case 'line':       this.previewLine(this.startPt, world);              break
      case 'rect':       this.previewRect(this.startPt, world);              break
      case 'circle':     this.previewCircle(this.startPt, world);            break
      case 'polygon':    this.previewPolygon(world);                         break
      case 'aoe-circle': this.previewAoeCircle(this.startPt, world);        break
      case 'aoe-cone':   this.previewAoeCone(this.startPt, world);          break
      case 'aoe-line':   this.previewAoeLine(this.startPt, world);          break
      case 'aoe-cube':   this.previewAoeCube(this.startPt, world);          break
      case 'measure':    this.drawMeasurePreview(world);                     break
    }
  }

  // ─── Up ──────────────────────────────────────────────────────────────────────

  private onUp(world: Point, _e: PointerEvent): void {
    if (!this.isPainting) return
    this.isPainting = false
    this.previewG.clear()
    this.labelT.visible = false

    switch (this.phase) {
      case 'freehand':   this.commitFreehand();                              break
      case 'line':       this.commitLine(world);                             break
      case 'rect':       this.commitRect(world);                             break
      case 'circle':     this.commitCircle(world);                           break
      case 'aoe-circle': this.commitAoeCircle(world);                       break
      case 'aoe-cone':   this.commitAoeCone(world);                         break
      case 'aoe-line':   this.commitAoeLine(world);                         break
      case 'aoe-cube':   this.commitAoeCube(world);                         break
    }

    // Reset single-drag tools
    if (!['polygon', 'measure'].includes(this.phase)) {
      this.phase = 'idle'
    }
  }

  // ─── Measure tool ────────────────────────────────────────────────────────────

  private handleMeasureDown(world: Point, e: PointerEvent): void {
    // Double-click: finish measure
    if (e.detail >= 2 && this.polyPoints.length > 0) {
      this.finishMeasure()
      return
    }
    if (this.phase !== 'measure') {
      this.phase      = 'measure'
      this.polyPoints = []
    }
    this.polyPoints.push({ ...world })
  }

  private drawMeasurePreview(current: Point): void {
    if (this.polyPoints.length === 0) return
    const pts = [...this.polyPoints, current]

    const { grid } = useVTTStore.getState()

    // Draw ruler line(s)
    this.previewG.clear()
    const s0 = toScreen(pts[0])
    this.previewG.moveTo(s0.x, s0.y)
    for (let i = 1; i < pts.length; i++) {
      const s = toScreen(pts[i])
      this.previewG.lineTo(s.x, s.y)
    }
    this.previewG
      .stroke({ color: 0xfbbf24, width: 2, alpha: 0.9 })

    // Tick marks at each waypoint
    for (const p of pts) {
      const sp = toScreen(p)
      this.previewG.circle(sp.x, sp.y, 4).fill({ color: 0xfbbf24, alpha: 0.9 })
    }

    // Distance label near endpoint — uses the scene's measurement rule
    const totalFt = measurePath(pts, grid.cellSize, grid.cellFeet, grid.measurement)
    const last    = toScreen(pts[pts.length - 1])
    this.labelT.text    = formatDistance(totalFt)
    this.labelT.x       = last.x + 8
    this.labelT.y       = last.y - 16
    this.labelT.visible = true
  }

  private finishMeasure(): void {
    this.phase      = 'idle'
    this.polyPoints = []
    this.previewG.clear()
    this.labelT.visible = false
  }

  // ─── Preview renderers ────────────────────────────────────────────────────────

  private drawFreehandPreview(): void {
    this.previewG.clear()
    const sp = toScreenFlat(this.freehandPts)
    if (sp.length < 4) return
    this.previewG.moveTo(sp[0], sp[1])
    for (let i = 2; i < sp.length; i += 2) this.previewG.lineTo(sp[i], sp[i+1])
    this.previewG.stroke({ color: drawColor, width: drawWidth, alpha: drawOpacity, cap: 'round', join: 'round' })
  }

  private previewLine(a: Point, b: Point): void {
    const sa = toScreen(a), sb = toScreen(b)
    this.previewG.moveTo(sa.x, sa.y).lineTo(sb.x, sb.y)
    this.previewG.stroke({ color: drawColor, width: drawWidth, alpha: drawOpacity, cap: 'round' })
  }

  private previewRect(a: Point, b: Point): void {
    const [sa, sb] = [toScreen(a), toScreen(b)]
    const rx = Math.min(sa.x, sb.x), ry = Math.min(sa.y, sb.y)
    const rw = Math.abs(sb.x - sa.x),  rh = Math.abs(sb.y - sa.y)
    this.previewG.rect(rx, ry, rw, rh)
    if (drawFill) this.previewG.fill({ color: drawColor, alpha: drawOpacity * 0.3 })
    this.previewG.stroke({ color: drawColor, width: drawWidth, alpha: drawOpacity })
  }

  private previewCircle(center: Point, edge: Point): void {
    const sc = toScreen(center), se = toScreen(edge)
    const r  = Math.hypot(se.x - sc.x, se.y - sc.y)
    this.previewG.circle(sc.x, sc.y, r)
    if (drawFill) this.previewG.fill({ color: drawColor, alpha: drawOpacity * 0.3 })
    this.previewG.stroke({ color: drawColor, width: drawWidth, alpha: drawOpacity })
  }

  private previewPolygon(current: Point): void {
    if (this.polyPoints.length === 0) return
    const pts = [...this.polyPoints, current]
    const s0  = toScreen(pts[0])
    this.previewG.moveTo(s0.x, s0.y)
    for (let i = 1; i < pts.length; i++) {
      const s = toScreen(pts[i])
      this.previewG.lineTo(s.x, s.y)
    }
    this.previewG.stroke({ color: drawColor, width: drawWidth, alpha: drawOpacity })
    // Show vertex dots
    for (const p of pts) {
      const s = toScreen(p)
      this.previewG.circle(s.x, s.y, 4).fill({ color: drawColor, alpha: 1 })
    }
  }

  // ─── AoE previews ────────────────────────────────────────────────────────────

  private previewAoeCircle(center: Point, edge: Point): void {
    const { grid } = useVTTStore.getState()
    const radiusPx = Math.hypot(edge.x - center.x, edge.y - center.y)
    const radiusFt = Math.round((radiusPx / grid.cellSize) * grid.cellFeet)
    const cells    = countCircleCells(center, radiusPx, grid.cellSize)
    const sc = toScreen(center), se = toScreen(edge)
    const sr = Math.hypot(se.x - sc.x, se.y - sc.y)

    this.previewG.circle(sc.x, sc.y, sr)
      .fill({ color: 0xff4444, alpha: 0.18 })
    this.previewG.circle(sc.x, sc.y, sr)
      .stroke({ color: 0xff4444, width: 2, alpha: 0.85 })

    this.labelT.text    = `${radiusFt}ft · ${cells} sq`
    this.labelT.x       = se.x + 8
    this.labelT.y       = se.y - 16
    this.labelT.visible = true
  }

  private previewAoeCone(origin: Point, dir: Point): void {
    const { grid } = useVTTStore.getState()
    const lengthPx = Math.hypot(dir.x - origin.x, dir.y - origin.y)
    const lengthFt = Math.round((lengthPx / grid.cellSize) * grid.cellFeet)
    const flatPts  = conePoints(origin, dir, lengthPx)
    const cells    = countPolygonCells(flatPts, grid.cellSize)
    const screenPts = toScreenFlat(flatPts)

    this.previewG.moveTo(screenPts[0], screenPts[1])
    for (let i = 2; i < screenPts.length; i += 2) this.previewG.lineTo(screenPts[i], screenPts[i+1])
    this.previewG.closePath()
    this.previewG.fill({ color: 0xff8800, alpha: 0.2 })
    this.previewG.stroke({ color: 0xff8800, width: 2, alpha: 0.9 })

    const sd = toScreen(dir)
    this.labelT.text    = `${lengthFt}ft · ${cells} sq`
    this.labelT.x       = sd.x + 8
    this.labelT.y       = sd.y - 16
    this.labelT.visible = true
  }

  private previewAoeLine(start: Point, end: Point): void {
    const { grid } = useVTTStore.getState()
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.hypot(dx, dy) || 1
    const halfW = grid.cellSize / 2    // 5ft width = 1 cell width / 2 on each side
    const nx = (-dy / len) * halfW
    const ny = ( dx / len) * halfW

    const flatPts = [
      start.x + nx, start.y + ny,
      end.x   + nx, end.y   + ny,
      end.x   - nx, end.y   - ny,
      start.x - nx, start.y - ny,
    ]
    const cells    = countPolygonCells(flatPts, grid.cellSize)
    const lengthFt = Math.round((len / grid.cellSize) * grid.cellFeet)
    const sp = toScreenFlat(flatPts)

    this.previewG.moveTo(sp[0], sp[1])
    for (let i = 2; i < sp.length; i += 2) this.previewG.lineTo(sp[i], sp[i+1])
    this.previewG.closePath()
    this.previewG.fill({ color: 0x44aaff, alpha: 0.2 })
    this.previewG.stroke({ color: 0x44aaff, width: 2, alpha: 0.9 })

    const se = toScreen(end)
    this.labelT.text    = `${lengthFt}ft · ${cells} sq`
    this.labelT.x       = se.x + 8
    this.labelT.y       = se.y - 16
    this.labelT.visible = true
  }

  private previewAoeCube(corner: Point, opposite: Point): void {
    const { grid } = useVTTStore.getState()
    const sc = toScreen(corner), so = toScreen(opposite)
    const rx = Math.min(sc.x, so.x), ry = Math.min(sc.y, so.y)
    const rw = Math.abs(so.x - sc.x), rh = Math.abs(so.y - sc.y)
    const sizeFt = Math.round((Math.max(rw, rh) / (grid.cellSize * useVTTStore.getState().viewport.scale)) * grid.cellFeet)
    const cells  = Math.round((rw / (grid.cellSize * useVTTStore.getState().viewport.scale)) *
                              (rh / (grid.cellSize * useVTTStore.getState().viewport.scale)))

    this.previewG.rect(rx, ry, rw, rh)
      .fill({ color: 0xaa44ff, alpha: 0.18 })
    this.previewG.rect(rx, ry, rw, rh)
      .stroke({ color: 0xaa44ff, width: 2, alpha: 0.9 })

    this.labelT.text    = `${sizeFt}×${sizeFt}ft · ${cells} sq`
    this.labelT.x       = so.x + 8
    this.labelT.y       = so.y - 16
    this.labelT.visible = true
  }

  // ─── Commit helpers ───────────────────────────────────────────────────────────

  private makeDrawing(partial: Partial<Drawing>): Drawing {
    return {
      id:       nanoid(),
      layer:    'drawings' as DrawingLayer,
      type:     'line',
      points:   [],
      color:    drawColor,
      width:    drawWidth,
      opacity:  drawOpacity,
      fill:     drawFill,
      text:     '',
      fontSize: drawFontSize,
      ...partial,
    }
  }

  private commit(drawing: Drawing): void {
    const store = useVTTStore.getState()
    store.execute({
      label:   `Draw ${drawing.type}`,
      execute: () => useVTTStore.getState().addDrawing(drawing),
      undo:    () => useVTTStore.getState().deleteDrawing(drawing.id),
    })
  }

  private commitFreehand(): void {
    if (this.freehandPts.length < 4) return
    this.commit(this.makeDrawing({ type: 'freehand', points: [...this.freehandPts] }))
    this.freehandPts = []
  }

  private commitLine(end: Point): void {
    this.commit(this.makeDrawing({
      type: 'line',
      points: [this.startPt.x, this.startPt.y, end.x, end.y],
    }))
  }

  private commitRect(end: Point): void {
    this.commit(this.makeDrawing({
      type: 'rect',
      points: [this.startPt.x, this.startPt.y, end.x, end.y],
    }))
  }

  private commitCircle(end: Point): void {
    this.commit(this.makeDrawing({
      type: 'circle',
      points: [this.startPt.x, this.startPt.y, end.x, end.y],
    }))
  }

  private commitPolygon(): void {
    if (this.polyPoints.length < 3) { this.resetPolygon(); return }
    const flat = this.polyPoints.flatMap(p => [p.x, p.y])
    this.commit(this.makeDrawing({ type: 'polygon', points: flat }))
    this.resetPolygon()
  }

  private resetPolygon(): void {
    this.phase       = 'idle'
    this.polyPoints  = []
    this.previewG.clear()
    this.labelT.visible = false
  }

  // AoE commits (saved as standard drawing shapes for persistence)

  private commitAoeCircle(end: Point): void {
    const radiusPx = Math.hypot(end.x - this.startPt.x, end.y - this.startPt.y)
    if (radiusPx < 4) return
    this.commit(this.makeDrawing({
      type:  'circle',
      color: '#ff4444',
      fill:  true,
      opacity: 0.35,
      width: 2,
      points: [this.startPt.x, this.startPt.y, end.x, end.y],
    }))
  }

  private commitAoeCone(end: Point): void {
    const lengthPx = Math.hypot(end.x - this.startPt.x, end.y - this.startPt.y)
    if (lengthPx < 4) return
    const flatPts = conePoints(this.startPt, end, lengthPx)
    this.commit(this.makeDrawing({
      type:  'polygon',
      color: '#ff8800',
      fill:  true,
      opacity: 0.35,
      width: 2,
      points: flatPts,
    }))
  }

  private commitAoeLine(end: Point): void {
    const { grid } = useVTTStore.getState()
    const dx = end.x - this.startPt.x
    const dy = end.y - this.startPt.y
    const len = Math.hypot(dx, dy) || 1
    const halfW = grid.cellSize / 2
    const nx = (-dy / len) * halfW
    const ny = ( dx / len) * halfW
    const flatPts = [
      this.startPt.x + nx, this.startPt.y + ny,
      end.x + nx,          end.y + ny,
      end.x - nx,          end.y - ny,
      this.startPt.x - nx, this.startPt.y - ny,
    ]
    this.commit(this.makeDrawing({
      type: 'polygon',
      color: '#44aaff',
      fill: true,
      opacity: 0.35,
      width: 2,
      points: flatPts,
    }))
  }

  private commitAoeCube(end: Point): void {
    this.commit(this.makeDrawing({
      type: 'rect',
      color: '#aa44ff',
      fill: true,
      opacity: 0.35,
      width: 2,
      points: [this.startPt.x, this.startPt.y, end.x, end.y],
    }))
  }

  // ─── Eraser ────────────────────────────────────────────────────────────────────

  private eraseAt(world: Point): void {
    const { drawings, grid } = useVTTStore.getState()
    const eraseRadius = grid.cellSize * 0.5   // half-cell eraser radius

    // Find topmost drawing near click point (reverse iteration = last added first)
    const all = Object.values(drawings).reverse()
    for (const d of all) {
      if (drawingHitTest(d, world, eraseRadius)) {
        const snapshot = { ...d }
        useVTTStore.getState().execute({
          label:   'Erase drawing',
          execute: () => useVTTStore.getState().deleteDrawing(snapshot.id),
          undo:    () => useVTTStore.getState().addDrawing(snapshot),
        })
        return  // erase one at a time
      }
    }
  }

  // ─── Text input ────────────────────────────────────────────────────────────────

  private showTextInput(world: Point, _e: PointerEvent): void {
    // Remove existing input if any
    this.removeTextInput()

    const { viewport: vp } = useVTTStore.getState()
    const sx = world.x * vp.scale + vp.x
    const sy = world.y * vp.scale + vp.y

    const input = document.createElement('input')
    input.type        = 'text'
    input.placeholder = 'Type label…'
    input.className   = 'vtt-text-input'
    input.style.cssText = `
      position: fixed;
      left: ${sx}px;
      top:  ${sy - 20}px;
      font-size: ${drawFontSize}px;
      color: ${drawColor};
      background: rgba(0,0,0,0.65);
      border: 1px solid ${drawColor};
      border-radius: 4px;
      padding: 2px 6px;
      outline: none;
      min-width: 80px;
      z-index: 1000;
    `
    document.body.appendChild(input)
    input.focus()
    this.textInput = input

    const commit = () => {
      const val = input.value.trim()
      if (val) {
        this.commit(this.makeDrawing({
          type:     'text',
          text:     val,
          points:   [world.x, world.y],
          fontSize: drawFontSize,
        }))
      }
      this.removeTextInput()
    }

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') commit()
      if (ev.key === 'Escape') this.removeTextInput()
      ev.stopPropagation()
    })
    input.addEventListener('blur', commit)
  }

  private removeTextInput(): void {
    if (this.textInput) {
      this.textInput.removeEventListener('blur', () => {})
      this.textInput.remove()
      this.textInput = null
    }
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────────

  handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.phase === 'polygon')  this.resetPolygon()
      if (this.phase === 'measure')  this.finishMeasure()
      this.removeTextInput()
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  destroy(): void {
    this.interaction.unregisterToolHandler('draw')
    this.interaction.unregisterToolHandler('measure')
    this.previewG.destroy()
    this.labelT.destroy()
    this.removeTextInput()
  }
}

// ─── Drawing hit-test (for eraser) ────────────────────────────────────────────

function drawingHitTest(d: Drawing, pt: Point, radius: number): boolean {
  const p = d.points
  switch (d.type) {
    case 'line': {
      if (p.length < 4) return false
      return pointToSegmentDist(pt, { x: p[0], y: p[1] }, { x: p[2], y: p[3] }) < radius
    }
    case 'freehand': {
      for (let i = 0; i < p.length - 2; i += 2) {
        if (pointToSegmentDist(pt, { x: p[i], y: p[i+1] }, { x: p[i+2], y: p[i+3] }) < radius) return true
      }
      return false
    }
    case 'rect': {
      if (p.length < 4) return false
      const cx = (p[0] + p[2]) / 2
      const cy = (p[1] + p[3]) / 2
      return Math.hypot(pt.x - cx, pt.y - cy) < Math.max(Math.abs(p[2]-p[0]), Math.abs(p[3]-p[1])) / 2 + radius
    }
    case 'circle': {
      if (p.length < 4) return false
      const r = Math.hypot(p[2]-p[0], p[3]-p[1])
      return Math.abs(Math.hypot(pt.x-p[0], pt.y-p[1]) - r) < radius
    }
    case 'text': {
      if (p.length < 2) return false
      return Math.hypot(pt.x - p[0], pt.y - p[1]) < radius * 4
    }
    case 'polygon': {
      for (let i = 0; i < p.length - 2; i += 2) {
        const next = (i + 2) % p.length
        if (pointToSegmentDist(pt, { x: p[i], y: p[i+1] }, { x: p[next], y: p[next+1] }) < radius) return true
      }
      return false
    }
    default: return false
  }
}

function pointToSegmentDist(pt: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx*dx + dy*dy
  if (lenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y)
  const t = Math.max(0, Math.min(1, ((pt.x - a.x)*dx + (pt.y - a.y)*dy) / lenSq))
  return Math.hypot(pt.x - (a.x + t*dx), pt.y - (a.y + t*dy))
}
