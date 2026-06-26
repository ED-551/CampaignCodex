/**
 * wallManager.ts — PixiJS rendering of all walls.
 *
 * Walls are only visible to the GM. Players see the lighting shadows that
 * walls create — the wall lines themselves are hidden from player view.
 *
 * Color coding by wall type (GM view):
 *   wall       → solid white-grey line
 *   door       → gold/amber line with open/closed indicator
 *   window     → dashed cyan line
 *   invisible  → dashed purple line (low opacity)
 *
 * Each wall segment is a separate Graphics object so individual walls
 * can be updated or deleted without redrawing the entire layer.
 *
 * Door interaction: players (and GMs) can click a door to toggle it.
 * The door's midpoint gets a clickable hit area.
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { Wall, WallType }             from '../types'
import { useVTTStore }                from '../store'

// ─── Color config by wall type ────────────────────────────────────────────────

const WALL_STYLE: Record<WallType, { color: number; alpha: number; dash: boolean }> = {
  wall:      { color: 0xaaaacc, alpha: 0.85, dash: false },
  door:      { color: 0xf59e0b, alpha: 0.9,  dash: false },
  window:    { color: 0x22d3ee, alpha: 0.75, dash: true  },
  invisible: { color: 0xa855f7, alpha: 0.4,  dash: true  },
}

const WALL_WIDTH = 3

// ─── Single wall graphic ──────────────────────────────────────────────────────

class WallGraphic {
  readonly container: Container

  private line:    Graphics
  private doorBtn: Graphics | null = null
  private label:   Text    | null = null

  constructor(wall: Wall, isGM = true) {
    this.container = new Container()
    this.line      = new Graphics()
    this.container.addChild(this.line)
    this.draw(wall, isGM)
  }

  draw(wall: Wall, isGM = true): void {
    this.line.clear()
    if (this.doorBtn) { this.doorBtn.destroy(); this.doorBtn = null }
    if (this.label)   { this.label.destroy();   this.label   = null }

    if (wall.points.length < 2) return

    const style = WALL_STYLE[wall.type]

    // Draw each segment of the polyline
    for (let i = 0; i < wall.points.length - 1; i++) {
      const a = wall.points[i]
      const b = wall.points[i + 1]

      if (style.dash) {
        // Manual dashed line: alternate drawn / skipped segments
        this.drawDashed(a.x, a.y, b.x, b.y, style.color, style.alpha, 12, 6)
      } else {
        this.line.moveTo(a.x, a.y).lineTo(b.x, b.y)
      }
    }

    if (!style.dash) {
      this.line.stroke({ color: style.color, alpha: style.alpha, width: WALL_WIDTH })
    }

    // ── Door indicator ────────────────────────────────────────────────────────
    if (wall.type === 'door' && isGM) {
      // Draw a small square at the midpoint of the first segment
      const mx = (wall.points[0].x + wall.points[1].x) / 2
      const my = (wall.points[0].y + wall.points[1].y) / 2
      const sz = 10

      const btn = new Graphics()
      btn.rect(mx - sz / 2, my - sz / 2, sz, sz)
        .fill({ color: wall.isOpen ? 0x22c55e : 0xef4444, alpha: 0.9 })
      btn.rect(mx - sz / 2, my - sz / 2, sz, sz)
        .stroke({ color: 0x000000, alpha: 0.4, width: 1 })
      btn.eventMode = 'static'
      btn.cursor    = 'pointer'
      btn.on('pointerdown', (e) => {
        e.stopPropagation()
        useVTTStore.getState().toggleDoor(wall.id)
      })

      this.container.addChild(btn)
      this.doorBtn = btn

      // "O" / "C" label
      const lbl = new Text({
        text:  wall.isOpen ? 'O' : 'C',
        style: { fontSize: 8, fill: 0xffffff, fontWeight: 'bold' },
      })
      lbl.anchor.set(0.5)
      lbl.position.set(mx, my)
      this.container.addChild(lbl)
      this.label = lbl
    }
  }

  private drawDashed(
    x1: number, y1: number,
    x2: number, y2: number,
    color: number, alpha: number,
    dashLen: number, gapLen: number,
  ): void {
    const dx   = x2 - x1
    const dy   = y2 - y1
    const len  = Math.hypot(dx, dy)
    const nx   = dx / len
    const ny   = dy / len
    let   dist = 0
    let   draw = true

    while (dist < len) {
      const segLen = Math.min(draw ? dashLen : gapLen, len - dist)
      if (draw) {
        const ax = x1 + nx * dist
        const ay = y1 + ny * dist
        const bx = ax + nx * segLen
        const by = ay + ny * segLen
        this.line.moveTo(ax, ay).lineTo(bx, by)
        this.line.stroke({ color, alpha, width: WALL_WIDTH })
      }
      dist += segLen
      draw  = !draw
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

// ─── WallManager ──────────────────────────────────────────────────────────────

export class WallManager {
  private container: Container
  private graphics:  Map<string, WallGraphic> = new Map()
  private unsub:     (() => void)[] = []
  private isGM = true  // Phase A: always GM view; player view added in networking chunk

  constructor(container: Container) {
    this.container = container

    const unsubWalls = useVTTStore.subscribe(
      s => s.walls,
      (walls) => this.sync(walls),
    )
    this.unsub.push(unsubWalls)
  }

  private sync(walls: Record<string, Wall>): void {
    const nextIds = new Set(Object.keys(walls))

    // Remove deleted walls
    for (const [id, g] of this.graphics) {
      if (!nextIds.has(id)) {
        g.destroy()
        this.container.removeChild(g.container)
        this.graphics.delete(id)
      }
    }

    // Add or update
    for (const wall of Object.values(walls)) {
      const existing = this.graphics.get(wall.id)
      if (!existing) {
        const g = new WallGraphic(wall, this.isGM)
        this.graphics.set(wall.id, g)
        this.container.addChild(g.container)
      } else {
        existing.draw(wall, this.isGM)
      }
    }
  }

  destroy(): void {
    for (const unsub of this.unsub) unsub()
    for (const g of this.graphics.values()) g.destroy()
    this.graphics.clear()
  }
}
