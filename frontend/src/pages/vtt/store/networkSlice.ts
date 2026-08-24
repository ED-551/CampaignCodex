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

/** Someone currently connected to this campaign's VTT session. */
export interface VTTMember {
  id:       string
  username: string
  isGM:     boolean
}

export interface NetworkState {
  connected:  boolean
  roomCode:   string | null
  isGM:       boolean
  gmToken:    string | null
  serverUrl:  string
  /** Everyone currently in the session, including this client. */
  members:    VTTMember[]
}

export interface NetworkSlice {
  network: NetworkState

  setNetworkInfo: (patch: Partial<NetworkState>) => void
  setMembers:     (members: VTTMember[]) => void
  addMember:      (member: VTTMember) => void
  removeMember:   (userId: string) => void
}

const DEFAULT_NETWORK: NetworkState = {
  connected:  false,
  roomCode:   null,
  isGM:       false,
  gmToken:    null,
  serverUrl:  'http://localhost:3001',
  members:    [],
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

  setMembers: (members) => set(state => {
    state.network.members = members
  }),

  addMember: (member) => set(state => {
    // The same person may open a second tab; keep one row per user.
    if (state.network.members.some(m => m.id === member.id)) return
    state.network.members.push(member)
  }),

  removeMember: (userId) => set(state => {
    state.network.members = state.network.members.filter(m => m.id !== userId)
  }),
})
