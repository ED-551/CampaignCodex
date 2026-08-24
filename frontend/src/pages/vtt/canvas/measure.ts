/**
 * measure.ts — Grid distance calculations.
 *
 * Different systems count distance differently, so the rule is a per-scene
 * setting rather than a hard-coded formula:
 *
 *   chessboard   D&D 5e — every cell costs the same, diagonals included.
 *   alternating  D&D 3.5e/Pathfinder — every second diagonal costs double.
 *   euclidean    True straight-line distance, ignoring the grid.
 *   manhattan    Cardinal moves only; no diagonal shortcut.
 *
 * All functions take world-space pixel points and return a distance in the
 * scene's own units (feet by default).
 */

import type { Point, MeasurementType } from '../types'

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  chessboard:  'Chessboard (5e)',
  alternating: 'Alternating diagonal (3.5e)',
  euclidean:   'Euclidean',
  manhattan:   'Manhattan',
}

/** Distance for a single segment, in grid cells. */
function segmentCells(a: Point, b: Point, cellSize: number, type: MeasurementType): number {
  const dc = Math.abs(b.x - a.x) / cellSize
  const dr = Math.abs(b.y - a.y) / cellSize

  switch (type) {
    case 'alternating': {
      // Diagonal steps alternate 1, 2, 1, 2… so a run of N diagonals costs
      // N + floor(N / 2).
      const diagonal = Math.min(dc, dr)
      const straight = Math.max(dc, dr) - diagonal
      return straight + diagonal + Math.floor(diagonal / 2)
    }

    case 'manhattan':
      return dc + dr

    case 'euclidean':
      return Math.hypot(dc, dr)

    case 'chessboard':
    default:
      // Scenes saved before this setting existed have no measurement rule;
      // fall back to the 5e default rather than silently changing their math.
      return Math.max(dc, dr)
  }
}

/** Total distance along a polyline, in scene units (e.g. feet). */
export function measurePath(
  points:   Point[],
  cellSize: number,
  cellFeet: number,
  type:     MeasurementType,
): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += segmentCells(points[i - 1], points[i], cellSize, type) * cellFeet
  }
  return total
}

/** Distance between exactly two points, in scene units. */
export function measureBetween(
  a: Point, b: Point,
  cellSize: number,
  cellFeet: number,
  type:     MeasurementType,
): number {
  return segmentCells(a, b, cellSize, type) * cellFeet
}

/**
 * Format a distance for display. Whole numbers stay clean; grid-based rules
 * always produce whole cells, while euclidean needs one decimal place.
 */
export function formatDistance(feet: number, unitSuffix = 'ft'): string {
  const rounded = Math.round(feet * 10) / 10
  return Number.isInteger(rounded)
    ? `${rounded} ${unitSuffix}`
    : `${rounded.toFixed(1)} ${unitSuffix}`
}
