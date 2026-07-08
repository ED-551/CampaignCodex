/**
 * VTTEngine.ts — Owns all PixiJS managers for the lifetime of the canvas.
 *
 * VTTCanvas.tsx creates the Application and then hands it to VTTEngine.
 * The engine sets up layers, viewport, and all per-feature managers.
 * Each manager subscribes to the Zustand store independently.
 *
 * Adding a new feature (Chunk N):
 *  1. Create a new Manager/Tool class
 *  2. Instantiate it here with the appropriate layer(s)
 *  3. Call its destroy() in VTTEngine.destroy()
 */

import { Application }          from 'pixi.js'
import { createLayers } from './layers'
import type { Layers } from './layers'
import { setupViewport }        from './viewport'
import { drawSquareGrid }       from './grid'
import { BackgroundManager }    from './background'
import { TokenManager }         from './tokenManager'
import { InteractionManager }   from './interactionManager'
import { WallManager }          from './wallManager'
import { WallTool }             from './wallTool'
import { LightTool }            from './lightTool'
import { LightingEngine }       from './lightingEngine'
import { FogManager }           from './fogManager'
import { FogTool }              from './fogTool'
import { DrawingManager }       from './drawingManager'
import { DrawingTool }          from './drawingTool'
import { PingManager }          from './pingManager'
import { PingTool }             from './pingTool'
import { useVTTStore }          from '../store'
import type { Background, Viewport } from '../types'

export class VTTEngine {
  private app:            Application
  private layers:         Layers
  private viewportCtrl:   ReturnType<typeof setupViewport>
  private bgManager:      BackgroundManager
  private tokenManager:   TokenManager
  private wallManager:    WallManager
  private wallTool:       WallTool
  private lightTool:      LightTool
  private lightingEngine: LightingEngine
  private fogManager:     FogManager
  private fogTool:        FogTool
  private drawingManager: DrawingManager
  private drawingTool:    DrawingTool
  private pingManager:    PingManager
  private pingTool:       PingTool
  private interaction:    InteractionManager
  private unsubscribers:  (() => void)[] = []

  constructor(app: Application) {
    this.app    = app
    this.layers = createLayers(app)

    // ── Viewport ────────────────────────────────────────────────────────────────
    const { viewport: initVp, setViewport } = useVTTStore.getState()
    this.layers.world.position.set(initVp.x, initVp.y)
    this.layers.world.scale.set(initVp.scale)

    this.viewportCtrl = setupViewport(
      app.canvas as HTMLCanvasElement,
      this.layers.world,
      () => useVTTStore.getState().viewport,
      (patch: Partial<Viewport>) => setViewport(patch),
    )

    // ── Grid ─────────────────────────────────────────────────────────────────────
    const { grid } = useVTTStore.getState()
    drawSquareGrid(this.layers.grid, grid, app.renderer.width, app.renderer.height, initVp.scale)

    const unsubGrid = useVTTStore.subscribe(
      s => ({ grid: s.grid, scale: s.viewport.scale }),
      ({ grid: g, scale }) => {
        drawSquareGrid(this.layers.grid, g, app.renderer.width, app.renderer.height, scale)
      },
    )
    this.unsubscribers.push(unsubGrid)

    // ── Background ───────────────────────────────────────────────────────────────
    this.bgManager = new BackgroundManager(this.layers.background)

    const unsubBg = useVTTStore.subscribe(
      s => s.getActiveScene().background,
      (bg: Background | null) => {
        if (bg) this.bgManager.setBackground(bg)
        else    this.bgManager.clear()
      },
    )
    this.unsubscribers.push(unsubBg)

    // ── Interaction (must come before tools that register handlers) ───────────────
    this.interaction = new InteractionManager(
      app.canvas as HTMLCanvasElement,
      this.layers.ui,
    )

    // ── Tokens ───────────────────────────────────────────────────────────────────
    this.tokenManager = new TokenManager(this.layers.tokens)

    // ── Walls ────────────────────────────────────────────────────────────────────
    // WallManager renders existing walls; WallTool handles interactive drawing.
    // Walls live on the `gm` layer so they can be hidden from players later.
    this.wallManager = new WallManager(this.layers.gm)
    this.wallTool    = new WallTool(this.layers.ui, this.interaction)
    this.lightTool   = new LightTool(this.interaction)

    // ── Lighting ─────────────────────────────────────────────────────────────────
    // The lighting layer sits above tokens. It draws a darkness overlay and
    // cuts out visibility polygons computed from wall geometry + token sight.
    this.lightingEngine = new LightingEngine(this.layers.lighting, app)

    // ── Fog of War ───────────────────────────────────────────────────────────────
    // Fog layer sits above lighting. FogManager renders the persistent fog overlay;
    // FogTool handles the manual brush interaction (only active in manual mode).
    this.fogManager = new FogManager(this.layers.fog, app)
    this.fogTool    = new FogTool(this.layers.ui, this.interaction)

    // ── Drawings ──────────────────────────────────────────────────────────────────
    // DrawingManager renders committed shapes on the drawings layer (world container).
    // DrawingTool handles all sub-tools: freehand, line, rect, circle, polygon,
    // text, eraser, AoE templates, and the ruler (M key).
    this.drawingManager = new DrawingManager(this.layers.drawings)
    this.drawingTool    = new DrawingTool(this.layers.ui, this.interaction)

    // ── Ping markers ──────────────────────────────────────────────────────────────
    // PingManager renders animated rings on the UI layer (screen space).
    // PingTool handles click events and socket emission.
    this.pingManager = new PingManager(this.layers.ui)
    this.pingTool    = new PingTool(this.interaction, this.pingManager)

    // ── GM layer visibility ──────────────────────────────────────────────────────
    // Walls and other GM-only objects live on layers.gm. Hide the layer for
    // players and for the GM while previewing the player perspective.
    const unsubGmLayer = useVTTStore.subscribe(
      s => s.network.isGM && !s.playerPreviewMode,
      gmView => { this.layers.gm.visible = gmView },
      { fireImmediately: true },
    )
    this.unsubscribers.push(unsubGmLayer)

    // ── Window resize ────────────────────────────────────────────────────────────
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener('resize', this.handleResize)
  }

  private handleResize(): void {
    this.app.renderer.resize(window.innerWidth, window.innerHeight)
    const { grid, viewport } = useVTTStore.getState()
    drawSquareGrid(
      this.layers.grid, grid,
      this.app.renderer.width, this.app.renderer.height,
      viewport.scale,
    )
    this.lightingEngine.resize(this.app.renderer.width, this.app.renderer.height)
    this.fogManager.resize(this.app.renderer.width, this.app.renderer.height)
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const vp = useVTTStore.getState().viewport
    return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale }
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize)
    for (const unsub of this.unsubscribers) unsub()
    this.viewportCtrl.destroy()
    this.bgManager.destroy()
    this.tokenManager.destroy()
    this.wallManager.destroy()
    this.wallTool.destroy()
    this.lightTool.destroy()
    this.lightingEngine.destroy()
    this.fogManager.destroy()
    this.fogTool.destroy()
    this.drawingManager.destroy()
    this.drawingTool.destroy()
    this.pingTool.destroy()
    this.pingManager.destroy()
    this.interaction.destroy()
  }
}
