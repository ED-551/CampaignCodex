/**
 * lightSlice.ts — Light source CRUD state.
 *
 * Light sources are stored as Record<id, LightSource> like tokens and walls.
 * The lighting engine subscribes to this slice and marks itself dirty whenever
 * sources change. Mutations go through history for undo/redo.
 *
 * Attached lights: when attachedTokenId is set, the engine reads the token's
 * current position at recompute time rather than the stored x/y.
 */

import type { StateCreator }  from 'zustand'
import type { VTTStore }      from './index'
import type { LightSource }   from '../types'

export interface LightSlice {
  lights: Record<string, LightSource>

  addLight:    (light: LightSource) => void
  updateLight: (id: string, changes: Partial<LightSource>) => void
  deleteLight: (id: string) => void
  clearLights: () => void
}

export const createLightSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  LightSlice
> = (set) => ({
  lights: {},

  addLight: (light) => set(state => {
    state.lights[light.id] = light
  }),

  updateLight: (id, changes) => set(state => {
    if (!state.lights[id]) return
    Object.assign(state.lights[id], changes)
  }),

  deleteLight: (id) => set(state => {
    delete state.lights[id]
  }),

  clearLights: () => set(state => {
    state.lights = {}
  }),
})
