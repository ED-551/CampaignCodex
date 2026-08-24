/**
 * propManager.ts — Renders scenery images and their selection handles.
 *
 * Each prop is a Sprite anchored at its centre so rotation behaves the way a
 * GM expects (it spins in place rather than swinging around a corner).
 *
 * When a prop is selected the GM gets an outline, four corner handles for
 * resizing and one handle above the top edge for rotating. Dragging is
 * handled here rather than in InteractionManager because the handles need
 * hit areas that move with the prop's own transform.
 *
 * Hidden props are drawn ghosted for the GM and not drawn at all for players,
 * matching how hidden tokens behave.
 */

import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js'
import { useVTTStore } from '../store'
import type { Prop }   from '../types'

const OUTLINE_COLOR = 0x60a5fa
const HANDLE_COLOR  = 0xffffff
const HANDLE_RADIUS = 6
/** Distance above the prop's top edge where the rotation handle sits. */
const ROTATE_OFFSET = 26

type DragMode =
  | { kind: 'move';   startX: number; startY: number; propX: number; propY: number }
  | { kind: 'resize'; corner: number; startW: number; startH: number; startDist: number }
  | { kind: 'rotate'; startAngle: number; startRotation: number }

export class PropManager {
  private container: Container
  private overlay:   Graphics             // selection outline + handles
  private sprites:   Map<string, Sprite> = new Map()
  private unsub:     (() => void)[] = []

  private gmView = true
  private drag:  DragMode | null = null

  constructor(container: Container) {
    this.container = container
    this.overlay   = new Graphics()
    this.container.addChild(this.overlay)

    this.unsub.push(
      useVTTStore.subscribe(s => s.props, () => this.sync()),
      useVTTStore.subscribe(s => s.selectedPropId, () => this.drawOverlay()),
      useVTTStore.subscribe(s => s.viewport, () => this.drawOverlay()),
      useVTTStore.subscribe(
        s => s.network.isGM && !s.playerPreviewMode,
        gmView => { this.gmView = gmView; this.sync() },
        { fireImmediately: true },
      ),
    )

    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp   = this.onPointerUp.bind(this)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup',   this.onPointerUp)

    this.sync()
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private sync(): void {
    const props = useVTTStore.getState().props
    const ids   = new Set(Object.keys(props))

    for (const [id, sprite] of this.sprites) {
      if (!ids.has(id)) {
        sprite.destroy()
        this.sprites.delete(id)
      }
    }

    for (const prop of Object.values(props)) {
      let sprite = this.sprites.get(prop.id)
      if (!sprite) {
        sprite = new Sprite(Texture.EMPTY)
        sprite.anchor.set(0.5)
        // Hit-testing lives in InteractionManager alongside tokens and tools,
        // so the sprite itself takes no part in event routing.
        sprite.eventMode = 'none'
        this.sprites.set(prop.id, sprite)
        this.container.addChild(sprite)

        const id = prop.id
        Assets.load(prop.imageUrl)
          .then(tex => {
            const current = this.sprites.get(id)
            if (current !== sprite) return
            sprite!.texture = tex
            // Re-apply size: width/height are expressed through scale, which
            // is meaningless until the real texture dimensions are known.
            const latest = useVTTStore.getState().props[id]
            if (latest) this.apply(sprite!, latest)
          })
          .catch(() => console.error('[props] could not load', prop.imageUrl))
      }
      this.apply(sprite, prop)
    }

    // Keep the overlay above every sprite
    this.container.setChildIndex(this.overlay, this.container.children.length - 1)
    this.drawOverlay()
  }

  private apply(sprite: Sprite, prop: Prop): void {
    sprite.position.set(prop.x, prop.y)
    sprite.width    = prop.width
    sprite.height   = prop.height
    sprite.rotation = prop.rotation
    sprite.zIndex   = prop.z
    sprite.visible  = prop.visible || this.gmView
    sprite.alpha    = prop.visible ? prop.opacity : prop.opacity * 0.4
    this.container.sortableChildren = true
  }

  /**
   * Topmost prop containing a world point, or null.
   *
   * The point is rotated back into the prop's own frame so a rotated building
   * is hit where it actually looks, not where its axis-aligned box would be.
   */
  hitTestProp(wx: number, wy: number): Prop | null {
    const state = useVTTStore.getState()
    if (!this.gmView) return null

    const candidates = Object.values(state.props)
      .filter(p => !p.locked)
      .sort((a, b) => b.z - a.z)   // topmost first

    for (const prop of candidates) {
      const dx = wx - prop.x
      const dy = wy - prop.y
      const cos = Math.cos(-prop.rotation), sin = Math.sin(-prop.rotation)
      const lx = dx * cos - dy * sin
      const ly = dx * sin + dy * cos
      if (Math.abs(lx) <= prop.width / 2 && Math.abs(ly) <= prop.height / 2) {
        return prop
      }
    }
    return null
  }

  /** Begin dragging a prop. Called by InteractionManager once it has hit one. */
  beginMove(id: string, wx: number, wy: number): void {
    const prop = useVTTStore.getState().props[id]
    if (!prop) return
    this.drag = { kind: 'move', startX: wx, startY: wy, propX: prop.x, propY: prop.y }
  }

  /** Corner offsets in the prop's local (unrotated) space. */
  private corners(prop: Prop): { x: number; y: number }[] {
    const hw = prop.width / 2, hh = prop.height / 2
    return [
      { x: -hw, y: -hh }, { x:  hw, y: -hh },
      { x:  hw, y:  hh }, { x: -hw, y:  hh },
    ]
  }

  private toWorld(prop: Prop, local: { x: number; y: number }) {
    const cos = Math.cos(prop.rotation), sin = Math.sin(prop.rotation)
    return {
      x: prop.x + local.x * cos - local.y * sin,
      y: prop.y + local.x * sin + local.y * cos,
    }
  }

  private drawOverlay(): void {
    this.overlay.clear()
    const state = useVTTStore.getState()
    if (!this.gmView) return

    const prop = state.getSelectedProp()
    if (!prop) return

    const pts = this.corners(prop).map(c => this.toWorld(prop, c))

    this.overlay.poly(pts.flatMap(p => [p.x, p.y]))
      .stroke({ color: OUTLINE_COLOR, width: 2 / state.viewport.scale, alpha: 0.95 })

    if (prop.locked) return   // locked props show the outline but no handles

    const r = HANDLE_RADIUS / state.viewport.scale
    for (const p of pts) {
      this.overlay.circle(p.x, p.y, r).fill({ color: HANDLE_COLOR, alpha: 0.95 })
      this.overlay.circle(p.x, p.y, r).stroke({ color: OUTLINE_COLOR, width: 1 / state.viewport.scale })
    }

    // Rotation handle, centred above the top edge
    const rot = this.toWorld(prop, { x: 0, y: -prop.height / 2 - ROTATE_OFFSET / state.viewport.scale })
    const top = this.toWorld(prop, { x: 0, y: -prop.height / 2 })
    this.overlay.moveTo(top.x, top.y).lineTo(rot.x, rot.y)
      .stroke({ color: OUTLINE_COLOR, width: 1.5 / state.viewport.scale, alpha: 0.8 })
    this.overlay.circle(rot.x, rot.y, r).fill({ color: 0x34d399, alpha: 0.95 })
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  /** World position of a pointer event. */
  private worldOf(e: { clientX: number; clientY: number }) {
    const vp = useVTTStore.getState().viewport
    return { x: (e.clientX - vp.x) / vp.scale, y: (e.clientY - vp.y) / vp.scale }
  }

  /** Called by the canvas before normal selection, so handles win over tokens. */
  handlePointerDown(clientX: number, clientY: number): boolean {
    const state = useVTTStore.getState()
    if (!this.gmView) return false
    const prop = state.getSelectedProp()
    if (!prop || prop.locked) return false

    const w   = this.worldOf({ clientX, clientY })
    const hit = HANDLE_RADIUS * 1.8 / state.viewport.scale

    const rot = this.toWorld(prop, { x: 0, y: -prop.height / 2 - ROTATE_OFFSET / state.viewport.scale })
    if (Math.hypot(w.x - rot.x, w.y - rot.y) <= hit) {
      this.drag = {
        kind: 'rotate',
        startAngle:    Math.atan2(w.y - prop.y, w.x - prop.x),
        startRotation: prop.rotation,
      }
      return true
    }

    const pts = this.corners(prop).map(c => this.toWorld(prop, c))
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(w.x - pts[i].x, w.y - pts[i].y) <= hit) {
        this.drag = {
          kind: 'resize', corner: i,
          startW: prop.width, startH: prop.height,
          startDist: Math.max(1, Math.hypot(w.x - prop.x, w.y - prop.y)),
        }
        return true
      }
    }
    return false
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag) return
    const state = useVTTStore.getState()
    const prop  = state.getSelectedProp()
    if (!prop) { this.drag = null; return }

    const w = this.worldOf(e)

    if (this.drag.kind === 'move') {
      state.updateProp(prop.id, {
        x: this.drag.propX + (w.x - this.drag.startX),
        y: this.drag.propY + (w.y - this.drag.startY),
      })
    } else if (this.drag.kind === 'rotate') {
      const angle = Math.atan2(w.y - prop.y, w.x - prop.x)
      let rotation = this.drag.startRotation + (angle - this.drag.startAngle)
      // Shift snaps to 15° so buildings can be squared up to the grid.
      if (e.shiftKey) {
        const step = Math.PI / 12
        rotation = Math.round(rotation / step) * step
      }
      state.updateProp(prop.id, { rotation })
    } else {
      // Resize proportionally from the centre, driven by distance to the cursor.
      const dist  = Math.max(1, Math.hypot(w.x - prop.x, w.y - prop.y))
      const ratio = dist / this.drag.startDist
      state.updateProp(prop.id, {
        width:  Math.max(8, this.drag.startW * ratio),
        height: Math.max(8, this.drag.startH * ratio),
      })
    }
    this.drawOverlay()
  }

  private onPointerUp(): void {
    this.drag = null
  }

  destroy(): void {
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup',   this.onPointerUp)
    for (const u of this.unsub) u()
    for (const s of this.sprites.values()) s.destroy()
    this.sprites.clear()
    this.overlay.destroy()
  }
}
