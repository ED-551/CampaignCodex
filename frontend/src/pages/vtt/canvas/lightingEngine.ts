/**
 * lightingEngine.ts — PixiJS dynamic lighting via raycasting.
 *
 * Vision model
 * ────────────
 * Two types of sources contribute to the visible area:
 *
 *   1. Token sight  — each token with sightRadius > 0 casts rays outward.
 *      The token can see everything within that radius not blocked by walls.
 *
 *   2. Light sources — each light illuminates an area regardless of which
 *      token is looking. Any area that a light source can "see" (unblocked
 *      by walls) is illuminated and visible to all player tokens.
 *      Light sources have two radii: bright (full visibility) and dim (50%).
 *
 * The final player view = union(all token sight polygons) ∪ union(all light polygons)
 *
 * Rendering
 * ─────────
 * We render to a RenderTexture used as an inverted mask on a darkness overlay:
 *   • Black background  = occluded (dark)
 *   • White fill        = bright light (fully visible)
 *   • Grey fill (50%)   = dim light zone
 *
 * The darkness overlay sits above tokens in the layer stack. Its opacity is
 * (1 - ambientLight), so at ambientLight=1 there's no darkness at all.
 *
 * Dirty flag
 * ──────────
 * Recompute only when: walls change, tokens move/added/removed,
 * lights change, grid scale changes, viewport changes (screen-space shift).
 */

import {
  Container, Graphics, RenderTexture, Sprite, Application,
} from 'pixi.js'
import { computeVisibility, cullWalls }  from './raycaster'
import { useVTTStore }                    from '../store'
import type { Point, LightSource, Token } from '../types'

export class LightingEngine {
  private app:           Application
  private container:     Container
  private darkOverlay:   Graphics
  private lightMask:     Graphics
  private maskSprite:    Sprite
  private renderTexture: RenderTexture

  private dirty  = true
  private isGM   = true

  private unsub: (() => void)[] = []

  constructor(container: Container, app: Application) {
    this.app       = app
    this.container = container

    const { width, height } = app.renderer

    // Full-screen darkness rectangle — clipped by maskSprite
    this.darkOverlay   = new Graphics()
    this.container.addChild(this.darkOverlay)

    // Render texture receives the visibility polygons (white on black)
    this.renderTexture = RenderTexture.create({ width, height })
    this.lightMask     = new Graphics()
    this.maskSprite    = new Sprite(this.renderTexture)

    // The mask sprite is the clip mask for the darkness overlay
    this.darkOverlay.mask = this.maskSprite
    this.container.addChild(this.maskSprite)

    // Subscribe to anything that changes lighting
    const markDirty = () => { this.dirty = true }
    this.unsub.push(
      useVTTStore.subscribe(s => s.walls,             markDirty),
      useVTTStore.subscribe(s => s.tokens,            markDirty),
      useVTTStore.subscribe(s => s.lights,            markDirty),
      useVTTStore.subscribe(s => s.grid.cellSize,     markDirty),
      useVTTStore.subscribe(s => s.grid.cellFeet,     markDirty),
      useVTTStore.subscribe(s => s.viewport,          markDirty),
      useVTTStore.subscribe(
        s => s.getActiveScene().ambientLight,
        markDirty,
      ),
      // GM sees a faint hint overlay; players (and GM in player-preview mode)
      // get the real masked lighting.
      useVTTStore.subscribe(
        s => s.network.isGM && !s.playerPreviewMode,
        gmView => this.setIsGM(gmView),
        { fireImmediately: true },
      ),
    )

    app.ticker.add(this.update, this)
  }

  setIsGM(isGM: boolean): void {
    this.isGM  = isGM
    this.dirty = true
  }

  private update(): void {
    if (!this.dirty) return
    this.dirty = false
    this.recompute()
  }

  private recompute(): void {
    const state        = useVTTStore.getState()
    const walls        = Object.values(state.walls)
    const tokens       = Object.values(state.tokens)
    const lights       = Object.values(state.lights)
    const { cellSize, cellFeet } = state.grid
    const ambientLight = state.getActiveScene().ambientLight
    const vp           = state.viewport
    const { width, height } = this.app.renderer

    // GM sees the same light shapes as players, but only as a faint reference
    // overlay so the map stays fully readable while prepping.
    const darknessAlpha = this.isGM
      ? (1 - ambientLight) * 0.25
      : (1 - ambientLight)

    // ── Resize render texture if needed ───────────────────────────────────────
    if (this.renderTexture.width !== width || this.renderTexture.height !== height) {
      this.renderTexture.resize(width, height)
    }

    // ── Build the darkness mask ───────────────────────────────────────────────
    // The mask sprite clips the darkness overlay: darkness renders where the
    // mask is WHITE and is hidden where the mask is BLACK. So:
    //   White background     = darkness everywhere by default.
    //   Mid-grey polygons    = dim areas (darkness at ~50%).
    //   Black polygons       = bright/lit areas (no darkness at all).
    // Dim zones are drawn first so bright zones always win in overlaps.
    this.lightMask.clear()
    this.lightMask.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: 1 })

    // Helper: convert world point to screen point
    const toScreen = (p: Point): Point => ({
      x: p.x * vp.scale + vp.x,
      y: p.y * vp.scale + vp.y,
    })

    // ── Pass 1: light source dim zones (half darkness) ────────────────────────
    for (const light of lights) {
      if (light.dimRadiusFt <= light.brightRadiusFt) continue

      const origin   = resolveOrigin(light, state.tokens)
      const radiusPx = feetToPx(light.dimRadiusFt, cellSize, cellFeet)
      const screenOrigin = toScreen(origin)
      const culled   = light.castsShadows
        ? cullWalls(walls, origin, radiusPx)
        : []
      const screenWalls = toScreenWalls(culled, vp.scale, vp.x, vp.y)

      const dimPoly = computeVisibility({
        origin: screenOrigin,
        walls:  screenWalls,
        radius: radiusPx * vp.scale,
      })

      if (dimPoly.length >= 3) {
        fillPolygon(this.lightMask, dimPoly, 0x888888, 1)
      }
    }

    // ── Pass 2: token sight (fully lit) ───────────────────────────────────────
    for (const token of tokens) {
      if (!token.visible || token.sightRadius <= 0) continue

      const radiusPx     = feetToPx(token.sightRadius, cellSize, cellFeet)
      const origin       = { x: token.x, y: token.y }
      const screenOrigin = toScreen(origin)
      const culled       = cullWalls(walls, origin, radiusPx)
      const screenWalls  = toScreenWalls(culled, vp.scale, vp.x, vp.y)

      const poly = computeVisibility({
        origin: screenOrigin,
        walls:  screenWalls,
        radius: radiusPx * vp.scale,
      })

      if (poly.length >= 3) {
        fillPolygon(this.lightMask, poly, 0x000000, 1)
      }
    }

    // ── Pass 3: light source bright zones (fully lit) ─────────────────────────
    for (const light of lights) {
      if (light.brightRadiusFt <= 0) continue

      const origin  = resolveOrigin(light, state.tokens)
      const radiusPx = feetToPx(light.brightRadiusFt, cellSize, cellFeet)
      const screenOrigin = toScreen(origin)
      const culled   = light.castsShadows
        ? cullWalls(walls, origin, radiusPx)
        : []
      const screenWalls = toScreenWalls(culled, vp.scale, vp.x, vp.y)

      const poly = computeVisibility({
        origin: screenOrigin,
        walls:  screenWalls,
        radius: radiusPx * vp.scale,
      })

      if (poly.length >= 3) {
        fillPolygon(this.lightMask, poly, 0x000000, 1)
      }
    }

    // Render mask to texture
    this.app.renderer.render({
      container: this.lightMask,
      target:    this.renderTexture,
      clear:     true,
    })

    // Draw the darkness overlay (clipped by the mask texture)
    this.darkOverlay.clear()
    this.drawDarknessRect(width, height, darknessAlpha)
  }

  private drawDarknessRect(w: number, h: number, alpha: number): void {
    if (alpha <= 0) return
    this.darkOverlay.rect(0, 0, w, h).fill({ color: 0x000000, alpha })
  }

  resize(width: number, height: number): void {
    this.renderTexture.resize(width, height)
    this.dirty = true
  }

  destroy(): void {
    this.app.ticker.remove(this.update, this)
    for (const unsub of this.unsub) unsub()
    this.lightMask.destroy()
    this.maskSprite.destroy()
    this.renderTexture.destroy()
    this.darkOverlay.destroy()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function feetToPx(feet: number, cellSize: number, cellFeet: number): number {
  return (feet / cellFeet) * cellSize
}

/** If the light is attached to a token, use the token's live position. */
function resolveOrigin(
  light:  LightSource,
  tokens: Record<string, Token>,
): Point {
  if (light.attachedTokenId) {
    const t = tokens[light.attachedTokenId]
    if (t) return { x: t.x, y: t.y }
  }
  return { x: light.x, y: light.y }
}

/** Convert walls from world-space to screen-space for raycasting (which runs in screen-space). */
function toScreenWalls(
  walls:   import('../types').Wall[],
  scale:   number,
  offX:    number,
  offY:    number,
): import('../types').Wall[] {
  return walls.map(w => ({
    ...w,
    points: w.points.map(p => ({
      x: p.x * scale + offX,
      y: p.y * scale + offY,
    })),
  }))
}

/** Draw a filled polygon into a Graphics object. */
function fillPolygon(
  g:     Graphics,
  poly:  Point[],
  color: number,
  alpha: number,
): void {
  g.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y)
  g.closePath()
  g.fill({ color, alpha })
}
