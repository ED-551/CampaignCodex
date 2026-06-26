/**
 * tokenSlice.ts — Token CRUD and selection state.
 *
 * Tokens are stored as a Record<id, Token> for O(1) lookup.
 * Selection is a Set<string> of token ids.
 *
 * All mutations go through this slice so that:
 *  1. The store is always the single source of truth
 *  2. The history slice can wrap these actions in Commands for undo/redo
 *  3. Socket sync (Chunk 9) can intercept these actions
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Token }        from '../types'

/** Token template used when placing a new token with the Token tool. */
export type TokenTemplate = Omit<Token, 'id' | 'x' | 'y'>

export interface TokenSlice {
  tokens: Record<string, Token>
  selectedTokenIds: Set<string>
  /** Set by TokenPanel when user selects a token type to place. */
  pendingTokenTemplate: TokenTemplate | null
  setPendingTokenTemplate: (t: TokenTemplate | null) => void

  addToken:       (token: Token) => void
  updateToken:    (id: string, changes: Partial<Token>) => void
  /** High-frequency: called every pointer-move during drag. No history entry. */
  moveToken:      (id: string, x: number, y: number) => void
  deleteToken:    (id: string) => void
  deleteTokens:   (ids: string[]) => void

  selectToken:    (id: string, additive?: boolean) => void
  selectTokens:   (ids: string[]) => void
  clearSelection: () => void

  /** Returns the single selected token, or null if 0 or 2+ are selected. */
  getSingleSelected: () => Token | null
}

export const createTokenSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  TokenSlice
> = (set, get) => ({
  tokens: {},
  selectedTokenIds: new Set(),
  pendingTokenTemplate: null,
  setPendingTokenTemplate: (t) => set(state => { state.pendingTokenTemplate = t }),

  addToken: (token) => set(state => {
    state.tokens[token.id] = token
  }),

  updateToken: (id, changes) => set(state => {
    if (!state.tokens[id]) return
    Object.assign(state.tokens[id], changes)
  }),

  moveToken: (id, x, y) => set(state => {
    if (!state.tokens[id]) return
    state.tokens[id].x = x
    state.tokens[id].y = y
  }),

  deleteToken: (id) => set(state => {
    delete state.tokens[id]
    state.selectedTokenIds.delete(id)
  }),

  deleteTokens: (ids) => set(state => {
    for (const id of ids) {
      delete state.tokens[id]
      state.selectedTokenIds.delete(id)
    }
  }),

  selectToken: (id, additive = false) => set(state => {
    if (additive) {
      if (state.selectedTokenIds.has(id)) {
        state.selectedTokenIds.delete(id)
      } else {
        state.selectedTokenIds.add(id)
      }
    } else {
      state.selectedTokenIds = new Set([id])
    }
  }),

  selectTokens: (ids) => set(state => {
    state.selectedTokenIds = new Set(ids)
  }),

  clearSelection: () => set(state => {
    state.selectedTokenIds = new Set()
  }),

  getSingleSelected: () => {
    const { tokens, selectedTokenIds } = get()
    if (selectedTokenIds.size !== 1) return null
    const [id] = selectedTokenIds
    return tokens[id] ?? null
  },
})
