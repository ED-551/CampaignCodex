/**
 * viewportSlice.ts — Camera/zoom state.
 *
 * Kept separate from scene data because the viewport is a local UI concern
 * that is never synced to the server or other players.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Viewport }     from '../types'

export interface ViewportSlice {
  viewport: Viewport

  /** Partially update the viewport — merges into current state. */
  setViewport: (patch: Partial<Viewport>) => void

  /** Reset to default (centered, 100% zoom). */
  resetViewport: () => void
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

export const createViewportSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  ViewportSlice
> = (set) => ({
  viewport: { ...DEFAULT_VIEWPORT },

  setViewport: (patch) =>
    set(state => { Object.assign(state.viewport, patch) }),

  resetViewport: () =>
    set(state => { state.viewport = { ...DEFAULT_VIEWPORT } }),
})
