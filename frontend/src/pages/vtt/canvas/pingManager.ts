/**
 * pingManager.ts — Animated ping markers on the canvas UI layer.
 *
 * Pings render in screen space (ui layer, not world) so they stay the same
 * size regardless of zoom. World coordinates are converted to screen on each
 * frame using the current viewport transform.
 *
 * Animation: three staggered rings expand from the click point and fade out
 * over PING_DURATION ms. After expiry the entry is removed.
 */

import { Graphics, Ticker } from 'pixi.js'
import type { Container }   from 'pixi.js'
import { useVTTStore }      from '../store'

const PING_DURATION = 2200   // ms until a ping disappears
const RING_COUNT    = 3
const MAX_RADIUS    = 56     // px at zoom 1 (screen space, so zoom-independent)
const BASE_COLOR    = 0xfbbf24  // amber-400

interface ActivePing {
  wx:        number   // world-space x
  wy:        number   // world-space y
  startedAt: number   // performance.now() when spawned
}

export class PingManager {
  private layer:  Container
  private gfx:    Graphics
  private pings:  ActivePing[] = []
  private tick:   (dt: Ticker) => void

  private remoteHandler: (e: Event) => void

  constructor(layer: Container) {
    this.layer = layer
    this.gfx   = new Graphics()
    this.layer.addChild(this.gfx)

    this.tick = this.onTick.bind(this)
    Ticker.shared.add(this.tick)

    // Listen for pings relayed from remote sockets
    this.remoteHandler = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
      this.addPing(x, y)
    }
    window.addEventListener('vtt:ping', this.remoteHandler)
  }

  /** Spawn a new ping at the given world coordinates. */
  addPing(wx: number, wy: number): void {
    this.pings.push({ wx, wy, startedAt: performance.now() })
  }

  private onTick(): void {
    const now = performance.now()

    // Expire old pings
    this.pings = this.pings.filter(p => now - p.startedAt < PING_DURATION)

    if (this.pings.length === 0) {
      this.gfx.clear()
      return
    }

    const { x: vpX, y: vpY, scale: vpScale } = useVTTStore.getState().viewport
    this.gfx.clear()

    for (const ping of this.pings) {
      const elapsed  = now - ping.startedAt
      const progress = elapsed / PING_DURATION   // 0 → 1

      // Screen-space center
      const sx = ping.wx * vpScale + vpX
      const sy = ping.wy * vpScale + vpY

      for (let i = 0; i < RING_COUNT; i++) {
        // Each ring is offset in time so they cascade outward
        const ringProgress = Math.min(1, (progress * RING_COUNT - i) / RING_COUNT)
        if (ringProgress <= 0) continue

        const radius = ringProgress * MAX_RADIUS
        const alpha  = (1 - ringProgress) * 0.8

        this.gfx
          .circle(sx, sy, radius)
          .stroke({ color: BASE_COLOR, alpha, width: 2.5 })
      }

      // Solid dot at center (fades at the end)
      const dotAlpha = Math.max(0, 1 - progress * 2)
      if (dotAlpha > 0) {
        this.gfx
          .circle(sx, sy, 5)
          .fill({ color: BASE_COLOR, alpha: dotAlpha })
      }
    }
  }

  destroy(): void {
    window.removeEventListener('vtt:ping', this.remoteHandler)
    Ticker.shared.remove(this.tick)
    this.gfx.destroy()
  }
}
