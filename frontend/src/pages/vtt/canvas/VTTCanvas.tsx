/**
 * VTTCanvas.tsx — Mounts the PixiJS application and boots VTTEngine.
 *
 * This component's only responsibilities:
 *  1. Mount a <div> for PixiJS to attach its canvas to
 *  2. Create and destroy the Application + VTTEngine
 *  3. Handle background image drag-and-drop onto the canvas
 *  4. Show the HUD (zoom %, cursor position in feet)
 *
 * All rendering logic lives in VTTEngine and its managers, not here.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Application }        from 'pixi.js'
import { VTTEngine }          from './VTTEngine'
import { fileToDataURL }      from './background'
import { pixelToFeet }        from './grid'
import { nanoid }             from '../utils/nanoid'
import { useVTTStore }        from '../store'
import { getAsset }           from '../assets/assetDb'
import { getPlaceholder }     from '../assets/placeholders'
import type { Token }         from '../types'

export function VTTCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef    = useRef<VTTEngine | null>(null)
  const appRef       = useRef<Application | null>(null)

  const [cursorFeet, setCursorFeet] = useState<{ x: number; y: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const scale = useVTTStore(s => s.viewport.scale)

  // ── Boot PixiJS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    const app = new Application()
    app.init({
      width:           window.innerWidth,
      height:          window.innerHeight,
      backgroundColor: 0x1a1a2e,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
    }).then(() => {
      if (destroyed) { app.destroy(true); return }
      containerRef.current!.appendChild(app.canvas)
      appRef.current    = app
      engineRef.current = new VTTEngine(app)

      // Cursor tracking for the HUD
      app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
        if (!engineRef.current) return
        const w  = engineRef.current.screenToWorld(e.clientX, e.clientY)
        const g  = useVTTStore.getState().grid
        setCursorFeet({
          x: pixelToFeet(w.x, g.cellSize, g.cellFeet),
          y: pixelToFeet(w.y, g.cellSize, g.cellFeet),
        })
      })
    })

    return () => {
      destroyed = true
      engineRef.current?.destroy()
      engineRef.current = null
      appRef.current?.destroy(true, { children: true, texture: true })
      appRef.current = null
    }
  }, [])

  // ── Camera follow (initiative tracker) ────────────────────────────────────
  // Listens for 'vtt:follow-token' CustomEvents emitted by the combat store
  // when nextTurn/prevTurn fires, or when the GM clicks a swatch in the tracker.
  useEffect(() => {
    function handleFollow(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail
      const state  = useVTTStore.getState()
      const token  = state.tokens[id]
      if (!token) return

      const vp = state.viewport
      const cx = window.innerWidth  / 2
      const cy = window.innerHeight / 2
      state.setViewport({
        x:     cx - token.x * vp.scale,
        y:     cy - token.y * vp.scale,
        scale: vp.scale,
      })
    }
    window.addEventListener('vtt:follow-token', handleFollow)
    return () => window.removeEventListener('vtt:follow-token', handleFollow)
  }, [])

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  // Accepts two kinds of drops:
  //   1. Asset panel drag  → dataTransfer has 'vtt/asset-id'
  //   2. OS file drag      → dataTransfer.files has an image file (existing behaviour)
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const hasAsset = e.dataTransfer.types.includes('vtt/asset-id')
    const hasFile  = [...e.dataTransfer.items].some(i => i.type.startsWith('image/'))
    if (hasAsset || hasFile) setIsDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragOver(false), [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    // ── Path 1: Asset Library panel drop ───────────────────────────────────
    const assetId   = e.dataTransfer.getData('vtt/asset-id')
    const assetType = e.dataTransfer.getData('vtt/asset-type') as 'token' | 'background' | ''

    if (assetId) {
      const record = getPlaceholder(assetId) ?? await getAsset(assetId)
      if (!record) return

      const store = useVTTStore.getState()
      const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const sx    = e.clientX - rect.left
      const sy    = e.clientY - rect.top
      const world = engineRef.current?.screenToWorld(sx + rect.left, sy + rect.top)
                 ?? { x: sx, y: sy }

      if (assetType === 'background') {
        const scene = store.getActiveScene()
        store.loadScene({
          ...scene,
          background: { imageUrl: record.dataUrl, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, locked: false },
        })
      } else {
        // Place as a token at the drop position
        const gridCellSize = store.grid.cellSize
        const token: Token = {
          id:            nanoid(),
          layer:         'tokens',
          x:             world.x,
          y:             world.y,
          widthCells:    1,
          heightCells:   1,
          image:         record.dataUrl,
          shape:         'circle',
          color:         '#3b82f6',
          label:         record.name,
          hp:            null,
          maxHp:         null,
          ac:            null,
          sightRadius:   60,
          emitsLight:    false,
          lightBrightFt: 0,
          lightDimFt:    0,
          lightColor:    '#ffa040',
          conditions:    [],
          visible:       true,
          locked:        false,
          playerOwnerIds: [],
        }
        // Snap to nearest grid cell center
        const snap = (v: number) => Math.round(v / gridCellSize) * gridCellSize + gridCellSize / 2
        token.x = snap(token.x)
        token.y = snap(token.y)
        store.addToken(token)
      }
      return
    }

    // ── Path 2: OS filesystem image drag → set as background ───────────────
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'))
    if (!file) return

    const imageUrl = await fileToDataURL(file)
    const store    = useVTTStore.getState()
    const scene    = store.getActiveScene()
    store.loadScene({
      ...scene,
      background: { imageUrl, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, locked: false },
    })
  }, [])

  return (
    <>
      {/* PixiJS canvas container — also the drop zone */}
      <div
        ref={containerRef}
        style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'block' }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />

      {/* Drop indicator overlay */}
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-label">Drop map image here</div>
        </div>
      )}

      {/* HUD */}
      <div className="vtt-hud">
        <span className="hud-chip">{Math.round(scale * 100)}%</span>
        {cursorFeet && (
          <span className="hud-chip">
            {cursorFeet.x.toFixed(0)} ft, {cursorFeet.y.toFixed(0)} ft
          </span>
        )}
      </div>
    </>
  )
}
