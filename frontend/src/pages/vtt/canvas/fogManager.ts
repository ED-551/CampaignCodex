/**
 * fogManager.ts — Fog-of-War GPU rendering + explorer-mode auto-reveal.
 *
 * Rendering model (mirrors lightingEngine)
 * ────────────────────────────────────────
 * A full-screen darkOverlay (Graphics) is masked by a RenderTexture:
 *   • Black pixel  = fogged (player cannot see through)
 *   • White pixel  = cleared (fog lifted here)
 *
 * The mask is regenerated from clearedCells whenever the fog state, viewport,
 * or grid changes. Each cleared cell becomes a white rectangle at its current
 * screen position. Everything else stays black.
 *
 * Stacking with lighting
 * ──────────────────────
 * Lighting (chunk 6) and Fog (chunk 7) are independent overlays on separate
 * PixiJS layers. Combined player view:
 *   • Fog: "have I ever seen this area?" — permanent until reset
 *   • Lighting: "can I see this area right now?" — dynamic
 * Both must be clear for an area to be fully visible.
 *
 * Explorer auto-reveal
 * ────────────────────
 * When mode === 'explorer', subscribes to token positions. On every token move,
 * runs raycaster in world-space to get the visibility polygon, converts that
 * polygon to a set of grid cells, and adds them to clearedCells.
 *
 * GM view
 * ───────
 * GM sees a faint 15% grey fog outline over fogged areas (reference only).
 * The real fog mask only applies in player view.
 *
 * Performance
 * ───────────
 * • Dirty flag: only recomputes on fog/viewport/grid change, not every frame.
 * • O(|clearedCells| * constant) per frame when dirty.
 * • For typical maps (≤ 2500 cells) this is trivially fast.
 */

import {
  Application, Container, Graphics, RenderTexture, Sprite,
} from 'pixi.js'
import { useVTTStore }                from '../store'
import { computeVisibility, cullWalls } from './raycaster'
import type { Point }                 from '../types'

// ── Point-in-polygon (ray casting test) ───────────────────────────────────────

function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const intersect =
      ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function worldToCell(worldX: number, worldY: number, cellSize: number): [number, number] {
  return [Math.floor(worldX / cellSize), Math.floor(worldY / cellSize)]
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

function cellsInPolygon(poly: Point[], origin: Point, radiusPx: number, cellSize: number): string[] {
  const [originCol, originRow] = worldToCell(origin.x, origin.y, cellSize)
  const radiusCells = Math.ceil(radiusPx / cellSize) + 1
  const results: string[] = []

  for (let col = originCol - radiusCells; col <= originCol + radiusCells; col++) {
    for (let row = originRow - radiusCells; row <= originRow + radiusCells; row++) {
      const cx = (col + 0.5) * cellSize
      const cy = (row + 0.5) * cellSize
      if (pointInPolygon({ x: cx, y: cy }, poly)) {
        results.push(cellKey(col, row))
      }
    }
  }
  return results
}

// ── FogManager ────────────────────────────────────────────────────────────────

export class FogManager {
  private app:           Application
  private container:     Container
  private darkOverlay:   Graphics
  private maskGraphics:  Graphics
  private maskTexture:   RenderTexture
  private maskSprite:    Sprite

  private dirty  = true
  private isGM   = true

  private unsub: (() => void)[] = []

  constructor(container: Container, app: Application) {
    this.app       = app
    this.container = container

    const { width, height } = app.renderer

    this.darkOverlay  = new Graphics()
    this.container.addChild(this.darkOverlay)

    this.maskTexture  = RenderTexture.create({ width, height })
    this.maskGraphics = new Graphics()
    this.maskSprite   = new Sprite(this.maskTexture)

    this.darkOverlay.mask = this.maskSprite
    this.container.addChild(this.maskSprite)

    const markDirty = () => { this.dirty = true }

    this.unsub.push(
      useVTTStore.subscribe(s => s.fog,           markDirty),
      useVTTStore.subscribe(s => s.viewport,      markDirty),
      useVTTStore.subscribe(s => s.grid.cellSize, markDirty),
      // GM sees fog as a translucent reference; players (and GM in
      // player-preview mode) get fully opaque fog.
      useVTTStore.subscribe(
        s => s.network.isGM && !s.playerPreviewMode,
        gmView => this.setIsGM(gmView),
        { fireImmediately: true },
      ),
    )

    // ── Explorer auto-reveal ─────────────────────────────────────────────────
    // When any token moves, add newly-visible cells to clearedCells.
    this.unsub.push(
      useVTTStore.subscribe(s => s.tokens, () => {
        const state = useVTTStore.getState()
        if (state.fog.mode !== 'explorer' || !state.fog.enabled) return
        this.revealForAllTokens(state)
      }),
    )

    app.ticker.add(this.update, this)
  }

  setIsGM(isGM: boolean): void {
    this.isGM  = isGM
    this.dirty = true
  }

  // ── Explorer reveal ─────────────────────────────────────────────────────────

  private revealForAllTokens(state: ReturnType<typeof useVTTStore.getState>): void {
    const walls    = Object.values(state.walls)
    const { cellSize, cellFeet } = state.grid
    const newCells: string[] = []

    for (const token of Object.values(state.tokens)) {
      if (!token.visible || token.sightRadius <= 0) continue

      const radiusPx = (token.sightRadius / cellFeet) * cellSize
      const origin   = { x: token.x, y: token.y }
      const culled   = cullWalls(walls, origin, radiusPx)

      // Run raycaster in world-space (no viewport transform)
      const poly = computeVisibility({ origin, walls: culled, radius: radiusPx })
      if (poly.length >= 3) {
        const cells = cellsInPolygon(poly, origin, radiusPx, cellSize)
        newCells.push(...cells)
      }
    }

    if (newCells.length > 0) {
      useVTTStore.getState().fogRevealCells(newCells)
    }
  }

  // ── Ticker ──────────────────────────────────────────────────────────────────

  private update(): void {
    if (!this.dirty) return
    this.dirty = false
    this.recompute()
  }

  private recompute(): void {
    const state  = useVTTStore.getState()
    const fog    = state.fog
    const vp     = state.viewport
    const cs     = state.grid.cellSize
    const { width, height } = this.app.renderer

    // ── No fog ───────────────────────────────────────────────────────────────
    if (!fog.enabled) {
      this.darkOverlay.clear()
      return
    }

    // ── Resize render texture if needed ──────────────────────────────────────
    if (this.maskTexture.width !== width || this.maskTexture.height !== height) {
      this.maskTexture.resize(width, height)
    }

    // ── Build mask ───────────────────────────────────────────────────────────
    // The mask clips the fog overlay: fog renders where the mask is WHITE and
    // is hidden where the mask is BLACK.
    this.maskGraphics.clear()
    // Start fully white (everything fogged)
    this.maskGraphics.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: 1 })

    if (fog.revealAll) {
      // Short-circuit: everything cleared — no fog anywhere
      this.maskGraphics.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 1 })
    } else {
      // Punch black holes for each cleared cell (fog hidden there)
      const cellKeys = Object.keys(fog.clearedCells)
      for (const key of cellKeys) {
        const [col, row] = key.split(',').map(Number)
        // World-space top-left of cell
        const wx = col * cs
        const wy = row * cs
        // Screen-space position and size
        const sx = wx * vp.scale + vp.x
        const sy = wy * vp.scale + vp.y
        const sw = cs * vp.scale

        // Only draw cells that overlap the viewport (culling)
        if (sx + sw < 0 || sy + sw < 0 || sx > width || sy > height) continue

        this.maskGraphics.rect(sx, sy, sw, sw).fill({ color: 0x000000, alpha: 1 })
      }
    }

    this.app.renderer.render({
      container: this.maskGraphics,
      target:    this.maskTexture,
      clear:     true,
    })

    // ── Draw the fog overlay ─────────────────────────────────────────────────
    this.darkOverlay.clear()

    if (this.isGM) {
      // GM sees a faint ghost of the fog for reference
      this.darkOverlay
        .rect(0, 0, width, height)
        .fill({ color: 0x111133, alpha: 0.15 })
    } else {
      // Player sees full fog at configured opacity
      this.darkOverlay
        .rect(0, 0, width, height)
        .fill({ color: parseInt(fog.color.slice(1), 16), alpha: fog.opacity })
    }
  }

  resize(width: number, height: number): void {
    this.maskTexture.resize(width, height)
    this.dirty = true
  }

  destroy(): void {
    this.app.ticker.remove(this.update, this)
    for (const unsub of this.unsub) unsub()
    this.maskGraphics.destroy()
    this.maskSprite.destroy()
    this.maskTexture.destroy()
    this.darkOverlay.destroy()
  }
}
