/**
 * sessionSlice.ts — VTT session live state + player preview mode.
 *
 * sessionActive: true when the GM has gone live (session_active in DB).
 * playerPreviewMode: true when the GM is previewing the player perspective.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'

export interface SessionSlice {
  sessionActive:     boolean
  playerPreviewMode: boolean

  setSessionActive:     (active: boolean) => void
  setPlayerPreviewMode: (active: boolean) => void
}

export const createSessionSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  SessionSlice
> = (set) => ({
  sessionActive:     false,
  playerPreviewMode: false,

  setSessionActive: (active) => set(state => { state.sessionActive = active }),
  setPlayerPreviewMode: (active) => set(state => { state.playerPreviewMode = active }),
})
