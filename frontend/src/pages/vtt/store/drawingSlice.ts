/**
 * drawingSlice.ts — Drawing object CRUD.
 *
 * Drawings live on either the 'drawings' layer (visible to all) or the 'gm'
 * layer (GM only). Both AoE templates and freehand annotations are stored here
 * once committed. In-progress previews are NOT in the store — they live in the
 * UI layer as temporary Graphics objects and are only committed on finish.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }      from './index'
import type { Drawing }       from '../types'

export interface DrawingSlice {
  drawings: Record<string, Drawing>

  addDrawing:    (drawing: Drawing) => void
  updateDrawing: (id: string, changes: Partial<Drawing>) => void
  deleteDrawing: (id: string) => void
  clearDrawings: () => void
}

export const createDrawingSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  DrawingSlice
> = (set) => ({
  drawings: {},

  addDrawing: (drawing) => set(state => {
    state.drawings[drawing.id] = drawing
  }),

  updateDrawing: (id, changes) => set(state => {
    if (!state.drawings[id]) return
    Object.assign(state.drawings[id], changes)
  }),

  deleteDrawing: (id) => set(state => {
    delete state.drawings[id]
  }),

  clearDrawings: () => set(state => {
    state.drawings = {}
  }),
})
