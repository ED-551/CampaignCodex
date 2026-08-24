/**
 * gridSlice.ts — Grid configuration state.
 *
 * GridConfig is part of the Scene (it will be saved and synced), but we manage
 * it in its own slice for ergonomics. When networking is added in Chunk 9,
 * grid changes will be emitted as socket events.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { GridConfig }   from '../types'

export interface GridSlice {
  grid: GridConfig

  /** Partially update the grid config. */
  setGrid: (patch: Partial<GridConfig>) => void
}

export const DEFAULT_GRID: GridConfig = {
  type:       'square',
  cellSize:   70,     // 70px per cell at 100% zoom — comfortable at 1080p
  cellFeet:   5,      // 5 feet per cell (D&D / Shadowdark standard)
  color:      '#4a4a6a',
  opacity:    0.5,
  visible:    true,
  snapToGrid: true,
  measurement: 'chessboard',   // D&D 5e default
}

export const createGridSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  GridSlice
> = (set) => ({
  grid: { ...DEFAULT_GRID },

  setGrid: (patch) =>
    set(state => { Object.assign(state.grid, patch) }),
})
