/**
 * drawingManager.ts — Renders committed Drawing objects on the drawings layer.
 *
 * On every store change: clears the container and redraws all drawings.
 * For the typical use-case (< 200 drawings per scene) this is fast enough.
 * A per-drawing sprite cache could be added in polish if needed.
 *
 * Coordinate system
 * ─────────────────
 * All Drawing.points are in world-space pixels. The drawings container sits
 * inside the world container, so they automatically transform with pan/zoom.
 *
 * Text drawings
 * ─────────────
 * Rendered as PIXI.Text objects with configurable fontSize and color. The text
 * field stores the string; points[0,1] is the anchor world position.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { useVTTStore } from '../store'
import type { Drawing } from '../types'

export class DrawingManager {
  private container: Container
  private unsub: () => void

  constructor(container: Container) {
    this.container = container

    // Re-render whenever any drawing changes
    this.unsub = useVTTStore.subscribe(
      s => s.drawings,
      () => this.redraw(),
    )

    this.redraw()
  }

  private redraw(): void {
    this.container.removeChildren().forEach(c => c.destroy({ children: true }))

    const drawings = Object.values(useVTTStore.getState().drawings)
    for (const d of drawings) {
      const child = renderDrawing(d)
      if (child) this.container.addChild(child)
    }
  }

  destroy(): void {
    this.unsub()
    this.container.removeChildren().forEach(c => c.destroy({ children: true }))
  }
}

// ─── Per-type renderers ────────────────────────────────────────────────────────

function renderDrawing(d: Drawing): Graphics | Text | null {
  if (d.type === 'text') return renderText(d)
  return renderShape(d)
}

function renderShape(d: Drawing): Graphics {
  const g = new Graphics()
  g.alpha = d.opacity

  const pts = d.points  // flat [x0,y0,x1,y1,...]

  switch (d.type) {
    case 'freehand':
      if (pts.length < 4) break
      g.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
      g.stroke({ color: d.color, width: d.width, alpha: 1, cap: 'round', join: 'round' })
      break

    case 'line': {
      if (pts.length < 4) break
      g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3])
      g.stroke({ color: d.color, width: d.width, alpha: 1, cap: 'round' })
      break
    }

    case 'rect': {
      if (pts.length < 4) break
      const rx = Math.min(pts[0], pts[2])
      const ry = Math.min(pts[1], pts[3])
      const rw = Math.abs(pts[2] - pts[0])
      const rh = Math.abs(pts[3] - pts[1])
      g.rect(rx, ry, rw, rh)
      if (d.fill) g.fill({ color: d.color, alpha: 0.3 })
      g.stroke({ color: d.color, width: d.width, alpha: 1 })
      break
    }

    case 'circle': {
      if (pts.length < 4) break
      const cx = pts[0], cy = pts[1]
      const radius = Math.hypot(pts[2] - cx, pts[3] - cy)
      g.circle(cx, cy, radius)
      if (d.fill) g.fill({ color: d.color, alpha: 0.3 })
      g.stroke({ color: d.color, width: d.width, alpha: 1 })
      break
    }

    case 'polygon': {
      if (pts.length < 6) break
      g.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
      g.closePath()
      if (d.fill) g.fill({ color: d.color, alpha: 0.3 })
      g.stroke({ color: d.color, width: d.width, alpha: 1 })
      break
    }
  }

  return g
}

function renderText(d: Drawing): Text | null {
  if (!d.text || d.points.length < 2) return null

  const style = new TextStyle({
    fontFamily:  'system-ui, sans-serif',
    fontSize:    d.fontSize || 16,
    fill:        d.color,
    stroke:      { color: '#000000', width: 2 },
    dropShadow:  false,
  })

  const t = new Text({ text: d.text, style })
  t.x     = d.points[0]
  t.y     = d.points[1]
  t.alpha = d.opacity
  return t
}
