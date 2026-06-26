/**
 * viewport.ts — Pan and zoom the world container.
 *
 * The viewport is a camera transform applied to the `world` Container:
 *   world.position = { x: viewport.x, y: viewport.y }
 *   world.scale    = viewport.scale
 *
 * Pan controls:
 *   • Middle mouse button drag
 *   • Space + left mouse drag
 *
 * Zoom controls:
 *   • Scroll wheel — zooms toward the cursor position (not the canvas center)
 *   • Numpad + / - or = / - keys
 *
 * The viewport state lives in the Zustand store so other components (e.g. the
 * coordinate display) can read it. The canvas itself drives the store; the
 * store does not drive the canvas directly.
 *
 * Returns:
 *   screenToWorld  — convert screen-space coords to world-space coords
 *   worldToScreen  — convert world-space coords to screen-space coords
 *   destroy        — remove all event listeners (call on unmount)
 */

import { Container }  from 'pixi.js'
import type { Viewport }   from '../types'

const MIN_SCALE = 0.1
const MAX_SCALE = 4.0

// Zoom step for keyboard +/- shortcuts
const KEY_ZOOM_FACTOR = 1.15

interface ViewportController {
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
  destroy: () => void
}

/**
 * Attach pan/zoom event listeners to the canvas element.
 *
 * @param canvas       The PixiJS canvas element.
 * @param world        The root world Container to transform.
 * @param getViewport  Getter for current viewport state from the store.
 * @param setViewport  Setter to update the store.
 */
export function setupViewport(
  canvas:      HTMLCanvasElement,
  world:       Container,
  getViewport: () => Viewport,
  setViewport: (patch: Partial<Viewport>) => void,
): ViewportController {

  // Apply stored viewport values to the PixiJS container
  function applyToContainer(vp: Viewport) {
    world.position.set(vp.x, vp.y)
    world.scale.set(vp.scale)
  }

  // ── Pan state ────────────────────────────────────────────────────────────────
  let isPanning    = false
  let spaceDown    = false
  let panStart     = { px: 0, py: 0, vpX: 0, vpY: 0 }

  // ── Zoom (scroll wheel) ───────────────────────────────────────────────────────
  function onWheel(e: WheelEvent) {
    e.preventDefault()

    const vp          = getViewport()
    const zoomFactor  = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newScale    = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * zoomFactor))
    if (newScale === vp.scale) return

    // Zoom toward the cursor: keep the world point under the cursor fixed
    const rect = canvas.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top

    const newX = mx - (mx - vp.x) * (newScale / vp.scale)
    const newY = my - (my - vp.y) * (newScale / vp.scale)

    const next = { x: newX, y: newY, scale: newScale }
    setViewport(next)
    applyToContainer(next)
  }

  // ── Pan (pointer events) ─────────────────────────────────────────────────────
  function onPointerDown(e: PointerEvent) {
    // Middle mouse button OR Space + left mouse
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault()
      isPanning = true
      const vp  = getViewport()
      panStart  = { px: e.clientX, py: e.clientY, vpX: vp.x, vpY: vp.y }
      canvas.style.cursor = 'grabbing'
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return
    const vp   = getViewport()
    const newX = panStart.vpX + (e.clientX - panStart.px)
    const newY = panStart.vpY + (e.clientY - panStart.py)
    const next = { ...vp, x: newX, y: newY }
    setViewport(next)
    applyToContainer(next)
  }

  function onPointerUp(e: PointerEvent) {
    if (isPanning && (e.button === 1 || e.button === 0)) {
      isPanning = false
      canvas.style.cursor = spaceDown ? 'grab' : 'default'
    }
  }

  // ── Space key (pan modifier) ──────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !e.repeat) {
      // Don't trigger if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT') return
      e.preventDefault()
      spaceDown = true
      canvas.style.cursor = isPanning ? 'grabbing' : 'grab'
    }

    // Keyboard zoom: = or + to zoom in, - to zoom out
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      zoomBy(KEY_ZOOM_FACTOR)
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      zoomBy(1 / KEY_ZOOM_FACTOR)
    }
    // Numpad 0 / Home → reset viewport
    if (e.code === 'Numpad0' || e.code === 'Home') {
      const next = { x: 0, y: 0, scale: 1 }
      setViewport(next)
      applyToContainer(next)
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spaceDown = false
      canvas.style.cursor = 'default'
    }
  }

  function zoomBy(factor: number) {
    const vp       = getViewport()
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor))
    if (newScale === vp.scale) return
    // Zoom toward canvas center when using keyboard
    const cx = canvas.width  / 2
    const cy = canvas.height / 2
    const next = {
      x:     cx - (cx - vp.x) * (newScale / vp.scale),
      y:     cy - (cy - vp.y) * (newScale / vp.scale),
      scale: newScale,
    }
    setViewport(next)
    applyToContainer(next)
  }

  // ── Attach listeners ──────────────────────────────────────────────────────────
  canvas.addEventListener('wheel',       onWheel,       { passive: false })
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup',   onPointerUp)
  window.addEventListener('keydown',     onKeyDown)
  window.addEventListener('keyup',       onKeyUp)

  // Prevent context menu on middle-click
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  // ── Coordinate helpers ────────────────────────────────────────────────────────
  function screenToWorld(sx: number, sy: number) {
    const vp = getViewport()
    return {
      x: (sx - vp.x) / vp.scale,
      y: (sy - vp.y) / vp.scale,
    }
  }

  function worldToScreen(wx: number, wy: number) {
    const vp = getViewport()
    return {
      x: wx * vp.scale + vp.x,
      y: wy * vp.scale + vp.y,
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  function destroy() {
    canvas.removeEventListener('wheel',       onWheel)
    canvas.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup',   onPointerUp)
    window.removeEventListener('keydown',     onKeyDown)
    window.removeEventListener('keyup',       onKeyUp)
  }

  return { screenToWorld, worldToScreen, destroy }
}
