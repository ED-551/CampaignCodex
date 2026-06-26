/**
 * grid.ts — Grid rendering and coordinate utilities.
 *
 * The grid is drawn as a PixiJS Graphics object inside the `grid` layer.
 * It is redrawn whenever the grid config or viewport scale changes.
 * The grid extends well beyond the visible canvas area (padding) so it never
 * appears to clip when the user pans.
 *
 * Coordinate utilities:
 *   pixelToCell  — world-space pixel → grid column/row
 *   cellToPixel  — grid column/row → world-space pixel (top-left of cell)
 *   cellCenter   — grid column/row → center pixel of that cell
 *   snapToGrid   — snap a world-space point to the nearest grid intersection
 *   worldToFeet  — convert a pixel distance to feet using cellFeet/cellSize
 */

import { Container, Graphics } from 'pixi.js'
import type { GridConfig, Point }   from '../types'

// How many extra cells to draw beyond the canvas edge in each direction.
// 20 cells gives plenty of buffer for any reasonable zoom level.
const PADDING_CELLS = 20

// ─── Drawing ──────────────────────────────────────────────────────────────────

/**
 * (Re)draws the square grid inside the given container.
 * Clears the container first, then appends a single Graphics object.
 *
 * @param container  The `grid` layer container.
 * @param cfg        Grid configuration from the store.
 * @param canvasW    Current canvas width in CSS pixels.
 * @param canvasH    Current canvas height in CSS pixels.
 * @param vpScale    Current viewport scale (zoom). Used to size the graphics
 *                   correctly in world space — we draw in world coords, PixiJS
 *                   scales to screen.
 */
export function drawSquareGrid(
  container: Container,
  cfg:       GridConfig,
  canvasW:   number,
  canvasH:   number,
  vpScale:   number,
): void {
  container.removeChildren()
  if (!cfg.visible) return

  const g = new Graphics()

  // Compute the visible world area at the current zoom
  const visibleW = canvasW  / vpScale
  const visibleH = canvasH / vpScale
  const pad      = cfg.cellSize * PADDING_CELLS

  const startX = -pad
  const startY = -pad
  const endX   = visibleW + pad
  const endY   = visibleH + pad

  // Parse hex color string → number
  const colorNum = parseInt(cfg.color.replace('#', ''), 16)

  g.setStrokeStyle({ width: 1 / vpScale, color: colorNum, alpha: cfg.opacity })

  // Vertical lines
  for (let x = startX; x <= endX; x += cfg.cellSize) {
    g.moveTo(x, startY).lineTo(x, endY)
  }
  // Horizontal lines
  for (let y = startY; y <= endY; y += cfg.cellSize) {
    g.moveTo(startX, y).lineTo(endX, y)
  }

  g.stroke()
  container.addChild(g)
}

// ─── Coordinate utilities ──────────────────────────────────────────────────────

/**
 * Convert a world-space pixel position to the grid cell it falls in.
 * Returns { col, row } — both integers (floor).
 */
export function pixelToCell(
  x: number,
  y: number,
  cellSize: number,
): { col: number; row: number } {
  return {
    col: Math.floor(x / cellSize),
    row: Math.floor(y / cellSize),
  }
}

/**
 * Convert a grid cell to the world-space pixel at the cell's top-left corner.
 */
export function cellToPixel(
  col: number,
  row: number,
  cellSize: number,
): Point {
  return { x: col * cellSize, y: row * cellSize }
}

/**
 * Convert a grid cell to the world-space pixel at the cell's center.
 */
export function cellCenter(
  col: number,
  row: number,
  cellSize: number,
): Point {
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  }
}

/**
 * Snap a world-space point to the nearest grid intersection (corner).
 * Used when placing walls and tokens with snap-to-grid enabled.
 */
export function snapToGridPoint(x: number, y: number, cellSize: number): Point {
  return {
    x: Math.round(x / cellSize) * cellSize,
    y: Math.round(y / cellSize) * cellSize,
  }
}

/**
 * Snap a world-space point to the center of the nearest grid cell.
 * Used when placing tokens (tokens are centered on their cell).
 */
export function snapToCellCenter(x: number, y: number, cellSize: number): Point {
  const col = Math.floor(x / cellSize)
  const row = Math.floor(y / cellSize)
  return cellCenter(col, row, cellSize)
}

/**
 * Convert a pixel distance to real-world feet.
 * e.g. pixelToFeet(140, 70, 5) → 10 feet
 */
export function pixelToFeet(pixels: number, cellSize: number, cellFeet: number): number {
  return (pixels / cellSize) * cellFeet
}
