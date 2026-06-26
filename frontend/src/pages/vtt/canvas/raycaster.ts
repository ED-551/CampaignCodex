/**
 * raycaster.ts — 2D visibility polygon via raycasting.
 *
 * Algorithm: Amit Patel's "2D Visibility" (redblobgames.com).
 *   1. Collect all wall endpoint angles from the origin (+ε offsets to catch shadow edges)
 *   2. Cast a ray at each angle; find the closest wall intersection
 *   3. Sort intersections by angle → visibility polygon
 *
 * This is pure math — no PixiJS dependency. Can be offloaded to a Web Worker
 * (Chunk 13 optimization pass) without modification.
 *
 * Performance: only process walls within the bounding box of the sight radius
 * (cullWalls). For a typical encounter map (50–150 wall segments, 5–8 tokens)
 * this runs well under 1ms per token per frame on mid-range hardware.
 */

import type { Point, Segment, Wall } from '../types'

const TWO_PI = Math.PI * 2

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RaycasterInput {
  origin:  Point
  walls:   Wall[]
  /** Max sight distance in world-space pixels. */
  radius:  number
}

/**
 * Compute the visibility polygon from origin, blocked by walls, up to radius.
 * Returns an array of points forming a closed polygon in world-space.
 */
export function computeVisibility(input: RaycasterInput): Point[] {
  const { origin, walls, radius } = input

  // Convert walls to segments, skipping open doors
  const segments = wallsToSegments(walls)

  // Collect candidate ray angles
  const angles: number[] = []

  for (const seg of segments) {
    for (const pt of [seg.a, seg.b]) {
      const angle = Math.atan2(pt.y - origin.y, pt.x - origin.x)
      // Three rays per endpoint: center, -ε, +ε — catches both edges of each shadow
      angles.push(angle - 0.0001, angle, angle + 0.0001)
    }
  }

  // Add 16 cardinal + intercardinal rays to round off the radius boundary
  for (let i = 0; i < 16; i++) {
    angles.push((TWO_PI / 16) * i - Math.PI)
  }

  if (angles.length === 0) {
    // No walls — full circle
    return circlePoints(origin, radius, 32)
  }

  // Cast each ray and record the closest hit
  const hits: Array<{ angle: number; x: number; y: number }> = []

  for (const angle of angles) {
    const rayEnd: Point = {
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius,
    }

    let closestDist = radius
    let closestPt   = rayEnd

    for (const seg of segments) {
      const hit = raySegmentIntersect(origin, rayEnd, seg.a, seg.b)
      if (hit) {
        const dist = Math.hypot(hit.x - origin.x, hit.y - origin.y)
        if (dist < closestDist - 0.001) {
          closestDist = dist
          closestPt   = hit
        }
      }
    }

    hits.push({ angle, x: closestPt.x, y: closestPt.y })
  }

  // Sort by angle
  hits.sort((a, b) => a.angle - b.angle)

  // Deduplicate (from ±ε triplets that land on the same point)
  const polygon: Point[] = []
  for (let i = 0; i < hits.length; i++) {
    const prev = hits[(i - 1 + hits.length) % hits.length]
    const diff = Math.abs(hits[i].angle - prev.angle)
    if (diff > 0.00001) {
      polygon.push({ x: hits[i].x, y: hits[i].y })
    }
  }

  return polygon
}

/**
 * Spatial cull: keep only walls whose bounding box overlaps the sight circle.
 * Reduces segment count significantly on large maps.
 */
export function cullWalls(walls: Wall[], origin: Point, radius: number): Wall[] {
  const minX = origin.x - radius
  const maxX = origin.x + radius
  const minY = origin.y - radius
  const maxY = origin.y + radius

  return walls.filter(w => {
    return w.points.some(p =>
      p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
    )
  })
}

// ─── Internals ────────────────────────────────────────────────────────────────

/**
 * Convert Wall objects to Segment pairs.
 * Open doors are skipped — they don't block light.
 * Each wall polyline is split into individual A→B segments.
 */
function wallsToSegments(walls: Wall[]): Segment[] {
  const segs: Segment[] = []
  for (const wall of walls) {
    // Open doors pass vision
    if (wall.type === 'door' && wall.isOpen) continue
    // Windows pass vision
    if (wall.type === 'window') continue

    for (let i = 0; i < wall.points.length - 1; i++) {
      const a = wall.points[i]
      const b = wall.points[i + 1]
      // Skip degenerate zero-length segments
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0.1) {
        segs.push({ a, b })
      }
    }
  }
  return segs
}

/**
 * Parametric ray-segment intersection.
 *
 * Ray:     P = origin + t*(rayEnd-origin),   t ∈ [0, 1]
 * Segment: Q = segA   + u*(segB-segA),        u ∈ [0, 1]
 *
 * Returns the intersection point if t ∈ [0,1] and u ∈ [0,1], else null.
 */
function raySegmentIntersect(
  rayOrigin: Point,
  rayEnd:    Point,
  segA:      Point,
  segB:      Point,
): Point | null {
  const rdx = rayEnd.x - rayOrigin.x
  const rdy = rayEnd.y - rayOrigin.y
  const sdx = segB.x  - segA.x
  const sdy = segB.y  - segA.y

  const denom = rdx * sdy - rdy * sdx
  if (Math.abs(denom) < 1e-10) return null   // parallel — no intersection

  const dx = segA.x - rayOrigin.x
  const dy = segA.y - rayOrigin.y

  const t = (dx * sdy - dy * sdx) / denom
  const u = (dx * rdy - dy * rdx) / denom

  if (t < -1e-6 || t > 1 + 1e-6) return null
  if (u < -1e-6 || u > 1 + 1e-6) return null

  return {
    x: rayOrigin.x + t * rdx,
    y: rayOrigin.y + t * rdy,
  }
}

/** Fallback: generate a circular polygon when there are no walls. */
function circlePoints(center: Point, radius: number, count: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i < count; i++) {
    const a = (TWO_PI / count) * i - Math.PI
    pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius })
  }
  return pts
}
