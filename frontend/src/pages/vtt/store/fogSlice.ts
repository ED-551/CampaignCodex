/**
 * fogSlice.ts — Top-level fog-of-war state.
 *
 * Design matches gridSlice: the active fog state lives at the top of the store
 * (state.fog) for O(1) reactive subscriptions. sceneSlice syncs this whenever
 * the active scene changes (same pattern as state.grid ↔ scene.grid).
 *
 * Cell coordinate system
 * ─────────────────────
 * Grid cells are addressed as integer (col, row) pairs in world space:
 *   col = Math.floor(worldX / cellSize)
 *   row = Math.floor(worldY / cellSize)
 * Stored as string keys "col,row" so negative coords are handled naturally.
 *
 * Manual mode
 * ───────────
 * All cells start invisible (fog covers everything). The GM uses the fog brush
 * to erase fog (reveal) or repaint fog (hide) over individual cells. Revealed
 * cells are stored in clearedCells.
 *
 * Explorer mode
 * ─────────────
 * All cells start invisible. As player tokens move, their visibility polygon
 * is converted to a set of grid cells and added to clearedCells. Once revealed,
 * cells never return to fog (explored = permanent). GM can reset exploration.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }    from './index'
import type { FogState, FogMode } from '../types'

export const DEFAULT_FOG: FogState = {
  mode:         'manual',
  enabled:      false,
  opacity:      0.88,
  color:        '#000000',
  revealAll:    false,
  clearedCells: {},
}

export interface FogSlice {
  fog: FogState

  setFogMode:     (mode: FogMode) => void
  setFogEnabled:  (enabled: boolean) => void
  setFogOpacity:  (opacity: number) => void
  setFogColor:    (color: string) => void

  /** Add cells to the cleared set (reveal) — used by both manual brush and explorer. */
  fogRevealCells: (cells: string[]) => void
  /** Remove cells from the cleared set (re-fog) — manual mode only. */
  fogHideCells:   (cells: string[]) => void

  /** Set revealAll flag — bypasses cell state entirely, shows whole map. */
  fogRevealAll:   () => void
  /** Clear the cleared set and revealAll — everything goes dark again. */
  fogHideAll:     () => void
  /** Clear only explorer accumulation (same as fogHideAll for explorer mode). */
  fogResetExplored: () => void
}

export const createFogSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  FogSlice
> = (set) => ({
  fog: { ...DEFAULT_FOG },

  setFogMode: (mode) => set(state => {
    state.fog.mode = mode
  }),

  setFogEnabled: (enabled) => set(state => {
    state.fog.enabled = enabled
  }),

  setFogOpacity: (opacity) => set(state => {
    state.fog.opacity = opacity
  }),

  setFogColor: (color) => set(state => {
    state.fog.color = color
  }),

  fogRevealCells: (cells) => set(state => {
    for (const c of cells) state.fog.clearedCells[c] = true
  }),

  fogHideCells: (cells) => set(state => {
    for (const c of cells) delete state.fog.clearedCells[c]
  }),

  fogRevealAll: () => set(state => {
    state.fog.revealAll = true
  }),

  fogHideAll: () => set(state => {
    state.fog.revealAll    = false
    state.fog.clearedCells = {}
  }),

  fogResetExplored: () => set(state => {
    state.fog.revealAll    = false
    state.fog.clearedCells = {}
  }),
})
