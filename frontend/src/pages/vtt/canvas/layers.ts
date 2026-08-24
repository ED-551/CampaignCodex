/**
 * layers.ts — PixiJS container hierarchy.
 *
 * All scene rendering lives inside a single `world` container that the viewport
 * transforms (pan + zoom). Within world, each layer is a named Container added
 * in z-order (first added = rendered first = bottom of stack).
 *
 * Layer purposes:
 *   background — imported map image; locked, no interaction
 *   grid       — square/hex lines rendered over the background
 *   terrain    — furniture, props, static scenery (non-combat tokens)
 *   tokens     — combatants: PCs and monsters
 *   gm         — GM-only objects invisible to players
 *   drawings   — freehand drawings, shapes, AoE templates
 *   lighting   — WebGL visibility mask (raycasting output)
 *   fog        — fog-of-war overlay
 *   ui         — rulers, selection boxes, ping markers — NEVER saved to scene
 */

import { Container, Application } from 'pixi.js'

export interface Layers {
  /** Root container — viewport transform applied here. */
  world:      Container
  background: Container
  grid:       Container
  /** Scenery images placed over the map — buildings, furniture, overlays. */
  props:      Container
  terrain:    Container
  tokens:     Container
  gm:         Container
  drawings:   Container
  lighting:   Container
  fog:        Container
  /** HUD layer — lives on stage, NOT inside world (not affected by pan/zoom). */
  ui:         Container
}

export function createLayers(app: Application): Layers {
  // `world` receives all pan/zoom transforms. Everything in the scene lives here.
  const world = new Container()
  app.stage.addChild(world)

  // Layer order within world (bottom → top)
  const background = new Container()
  const grid        = new Container()
  // Props sit above the grid so a building covers the map's own gridlines,
  // but below tokens so creatures always stand on top of the scenery.
  const props       = new Container()
  const terrain     = new Container()
  const tokens      = new Container()
  const gm          = new Container()
  const drawings    = new Container()
  const lighting    = new Container()
  const fog         = new Container()

  world.addChild(background, grid, props, terrain, tokens, gm, drawings, lighting, fog)

  // UI lives on stage directly — not transformed by the viewport
  const ui = new Container()
  app.stage.addChild(ui)

  return { world, background, grid, props, terrain, tokens, gm, drawings, lighting, fog, ui }
}
