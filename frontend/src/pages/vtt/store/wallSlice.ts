/**
 * wallSlice.ts — Wall CRUD state.
 *
 * Walls are stored as Record<id, Wall> for O(1) lookup.
 * The lighting engine subscribes to this slice and marks itself dirty
 * whenever walls change. Wall mutations go through history (undo/redo).
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Wall }  from '../types'

export interface WallSlice {
  walls: Record<string, Wall>

  addWall:    (wall: Wall) => void
  updateWall: (id: string, changes: Partial<Wall>) => void
  deleteWall: (id: string) => void
  toggleDoor: (id: string) => void
  clearWalls: () => void
}

export const createWallSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  WallSlice
> = (set) => ({
  walls: {},

  addWall: (wall) => set(state => {
    state.walls[wall.id] = wall
  }),

  updateWall: (id, changes) => set(state => {
    if (!state.walls[id]) return
    Object.assign(state.walls[id], changes)
  }),

  deleteWall: (id) => set(state => {
    delete state.walls[id]
  }),

  toggleDoor: (id) => set(state => {
    const w = state.walls[id]
    if (w && w.type === 'door') w.isOpen = !w.isOpen
  }),

  clearWalls: () => set(state => {
    state.walls = {}
  }),
})
