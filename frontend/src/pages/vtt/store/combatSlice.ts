/**
 * combatSlice.ts — Initiative tracker & combat state.
 *
 * Design
 * ──────
 * • combatants[] is the ordered list (sorted by initiative desc).
 *   Ties broken by initiativeBonus desc, then insertion order.
 * • activeIndex points to whose turn it is.
 * • Advancing past the last combatant wraps to 0 and increments round.
 * • startCombat() does NOT auto-roll — GM rolls manually or clicks Roll All.
 * • HP changes in the tracker are mirrored to the token via updateToken()
 *   so the canvas HUD stays in sync.
 *
 * Camera follow
 * ─────────────
 * nextTurn / prevTurn emit a custom DOM event 'vtt:follow-token' with the
 * active token's id. VTTCanvas listens and pans the viewport to center on it.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Combatant }    from '../types'

// ─── Slice type ───────────────────────────────────────────────────────────────

export interface CombatSlice {
  combatActive: boolean
  combatRound:  number
  activeIndex:  number
  combatants:   Combatant[]

  /** Begin combat: sort existing combatants and set round = 1. */
  startCombat: () => void
  /** End combat: reset all state. Does NOT clear the combatant list
   *  so it can be re-used if combat restarts. */
  endCombat:   () => void

  /** Add all tokens currently on the scene as combatants (skip duplicates). */
  addAllTokens: () => void
  /** Add a single token by id. No-op if already present. */
  addCombatant: (tokenId: string) => void
  /** Remove a combatant. Adjusts activeIndex to stay valid. */
  removeCombatant: (id: string) => void
  /** Partial-update a combatant. Triggers re-sort when initiative changes. */
  updateCombatant: (id: string, patch: Partial<Combatant>) => void
  /** Clear the full combatant list (outside of endCombat). */
  clearCombatants: () => void

  /** Roll d20+bonus for all combatants whose initiative is null. */
  rollAllInitiatives: () => void
  /** Roll d20+bonus for a single combatant. */
  rollInitiative: (id: string) => void
  /** Sort combatants by initiative desc (call after manual edits). */
  sortCombatants: () => void

  /** Advance to the next combatant's turn. */
  nextTurn: () => void
  /** Step back to the previous combatant's turn. */
  prevTurn: () => void

  /** Mirror HP change from tracker → token store. */
  syncHp: (id: string, hp: number | null) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortByInitiative(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ia = (a.initiative ?? -999) + a.initiativeBonus
    const ib = (b.initiative ?? -999) + b.initiativeBonus
    if (ib !== ia) return ib - ia
    // Tie: players before NPCs
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1
    return 0
  })
}

function emitFollowToken(id: string): void {
  window.dispatchEvent(new CustomEvent('vtt:follow-token', { detail: { id } }))
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export const createCombatSlice: StateCreator<VTTStore, [['zustand/immer', never]], [], CombatSlice> = (set, get) => ({
  combatActive: false,
  combatRound:  1,
  activeIndex:  0,
  combatants:   [],

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  startCombat: () =>
    set(state => {
      state.combatActive = true
      state.combatRound  = 1
      state.activeIndex  = 0
      state.combatants   = sortByInitiative(state.combatants)
    }),

  endCombat: () =>
    set(state => {
      state.combatActive = false
      state.combatRound  = 1
      state.activeIndex  = 0
    }),

  // ── Combatant management ────────────────────────────────────────────────────

  addAllTokens: () =>
    set(state => {
      const existing = new Set(state.combatants.map(c => c.id))
      const tokenMap  = state.tokens
      for (const tok of Object.values(tokenMap)) {
        if (existing.has(tok.id)) continue
        state.combatants.push({
          id:              tok.id,
          name:            tok.label || 'Token',
          initiative:      null,
          initiativeBonus: 0,
          hp:              tok.hp,
          maxHp:           tok.maxHp,
          ac:              tok.ac,
          color:           tok.color,
          isPlayer:        tok.playerOwnerIds.length > 0,
          conditions:      [...tok.conditions],
          isSurprised:     false,
        })
      }
    }),

  addCombatant: (tokenId) =>
    set(state => {
      if (state.combatants.some(c => c.id === tokenId)) return
      const tok = state.tokens[tokenId]
      if (!tok) return
      state.combatants.push({
        id:              tok.id,
        name:            tok.label || 'Token',
        initiative:      null,
        initiativeBonus: 0,
        hp:              tok.hp,
        maxHp:           tok.maxHp,
        ac:              tok.ac,
        color:           tok.color,
        isPlayer:        tok.playerOwnerIds.length > 0,
        conditions:      [...tok.conditions],
        isSurprised:     false,
      })
    }),

  removeCombatant: (id) =>
    set(state => {
      const idx = state.combatants.findIndex((c: Combatant) => c.id === id)
      if (idx === -1) return
      state.combatants.splice(idx, 1)
      if (state.activeIndex >= state.combatants.length) {
        state.activeIndex = Math.max(0, state.combatants.length - 1)
      }
    }),

  updateCombatant: (id, patch) =>
    set(state => {
      const c = state.combatants.find((c: Combatant) => c.id === id)
      if (!c) return
      Object.assign(c, patch)
      if ('initiative' in patch || 'initiativeBonus' in patch) {
        state.combatants = sortByInitiative(state.combatants)
      }
    }),

  clearCombatants: () =>
    set(state => {
      state.combatants  = []
      state.activeIndex = 0
    }),

  // ── Initiative rolling ──────────────────────────────────────────────────────

  rollAllInitiatives: () =>
    set(state => {
      for (const c of state.combatants) {
        if (c.initiative === null) {
          c.initiative = Math.floor(Math.random() * 20) + 1
        }
      }
      state.combatants = sortByInitiative(state.combatants)
    }),

  rollInitiative: (id) =>
    set(state => {
      const c = state.combatants.find((c: Combatant) => c.id === id)
      if (!c) return
      c.initiative = Math.floor(Math.random() * 20) + 1
      state.combatants = sortByInitiative(state.combatants)
    }),

  sortCombatants: () =>
    set(state => {
      state.combatants = sortByInitiative(state.combatants)
    }),

  // ── Turn advancement ────────────────────────────────────────────────────────

  nextTurn: () => {
    set(state => {
      if (!state.combatActive || state.combatants.length === 0) return
      state.activeIndex++
      if (state.activeIndex >= state.combatants.length) {
        state.activeIndex = 0
        state.combatRound++
      }
    })
    // Emit after state is settled
    const { combatants, activeIndex } = get()
    const active = combatants[activeIndex]
    if (active) emitFollowToken(active.id)
  },

  prevTurn: () => {
    set(state => {
      if (!state.combatActive || state.combatants.length === 0) return
      state.activeIndex--
      if (state.activeIndex < 0) {
        state.activeIndex = state.combatants.length - 1
        if (state.combatRound > 1) state.combatRound--
      }
    })
    const { combatants, activeIndex } = get()
    const active = combatants[activeIndex]
    if (active) emitFollowToken(active.id)
  },

  // ── HP sync ─────────────────────────────────────────────────────────────────

  syncHp: (id, hp) => {
    set(state => {
      const c = state.combatants.find((c: Combatant) => c.id === id)
      if (c) c.hp = hp
      // Mirror to token
      const tok = state.tokens[id]
      if (tok) tok.hp = hp
    })
  },
})
