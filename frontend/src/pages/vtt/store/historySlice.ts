/**
 * historySlice.ts — Undo/redo via the Command pattern.
 *
 * Every user-initiated action that should be undoable must be wrapped
 * in a Command and passed to `execute()`. Direct store mutations that
 * come from the network (socket sync) bypass history entirely.
 *
 * Max history: 50 commands. Older commands are discarded.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Command }      from '../types'

const MAX_HISTORY = 50

export interface HistorySlice {
  past:   Command[]
  future: Command[]

  /** Execute a command and push it onto the undo stack. */
  execute: (cmd: Command) => void

  /** Undo the last command. */
  undo: () => void

  /** Redo the last undone command. */
  redo: () => void

  /** Clear all history (e.g. on scene load). */
  clearHistory: () => void

  canUndo: boolean
  canRedo: boolean
}

export const createHistorySlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  HistorySlice
> = (set, get) => ({
  past:   [],
  future: [],
  canUndo: false,
  canRedo: false,

  execute: (cmd) => {
    cmd.execute()
    set(state => {
      state.past   = [...state.past, cmd].slice(-MAX_HISTORY)
      state.future = []
      state.canUndo = true
      state.canRedo = false
    })
  },

  undo: () => {
    const { past } = get()
    if (past.length === 0) return
    const cmd = past[past.length - 1]
    cmd.undo()
    set(state => {
      state.past   = state.past.slice(0, -1)
      state.future = [cmd, ...state.future]
      state.canUndo = state.past.length > 0
      state.canRedo = true
    })
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return
    const cmd = future[0]
    cmd.execute()
    set(state => {
      state.past   = [...state.past, cmd]
      state.future = state.future.slice(1)
      state.canUndo = true
      state.canRedo = state.future.length > 0
    })
  },

  clearHistory: () => set(state => {
    state.past    = []
    state.future  = []
    state.canUndo = false
    state.canRedo = false
  }),
})
