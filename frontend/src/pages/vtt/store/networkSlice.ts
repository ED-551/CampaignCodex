/**
 * networkSlice.ts — Socket.io connection + room state.
 *
 * Tracks what room this client is in, whether it's the GM, and the connection
 * status. UI components read this to show the room badge, disable GM-only
 * controls for players, etc.
 *
 * `setNetworkInfo` accepts a partial update so individual fields can be
 * patched (e.g. just { connected: false } on socket disconnect).
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }      from './index'

export interface NetworkState {
  connected:  boolean
  roomCode:   string | null
  isGM:       boolean
  gmToken:    string | null
  serverUrl:  string
}

export interface NetworkSlice {
  network: NetworkState

  setNetworkInfo: (patch: Partial<NetworkState>) => void
}

const DEFAULT_NETWORK: NetworkState = {
  connected:  false,
  roomCode:   null,
  isGM:       false,
  gmToken:    null,
  serverUrl:  'http://localhost:3001',
}

export const createNetworkSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  NetworkSlice
> = (set) => ({
  network: { ...DEFAULT_NETWORK },

  setNetworkInfo: (patch) => set(state => {
    Object.assign(state.network, patch)
  }),
})
