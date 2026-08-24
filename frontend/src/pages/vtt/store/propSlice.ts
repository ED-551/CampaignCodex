/**
 * propSlice.ts — Freely placed scenery images.
 *
 * Props are the layer between the scene background and the tokens: a tavern
 * dropped onto a world map, furniture inside a room, a rug, a spell overlay.
 * The background can only hold one image, and tokens carry creature state
 * (HP, conditions, initiative) that scenery has no use for, so props are
 * their own thing.
 *
 * Stored keyed by id for the same reason as tokens: canvas managers subscribe
 * to the record and diff it, and O(1) lookup keeps drag updates cheap.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Prop }         from '../types'

export interface PropSlice {
  props: Record<string, Prop>
  /** Currently selected prop, if any. Props and tokens select independently. */
  selectedPropId: string | null

  addProp:    (prop: Prop) => void
  updateProp: (id: string, changes: Partial<Prop>) => void
  deleteProp: (id: string) => void
  clearProps: () => void

  selectProp: (id: string | null) => void

  /** Move a prop above every other prop so it is not buried. */
  bringPropToFront: (id: string) => void
  /** Move a prop below every other prop — usually to put a map back underneath. */
  sendPropToBack:   (id: string) => void

  getSelectedProp: () => Prop | null
}

export const createPropSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  PropSlice
> = (set, get) => ({
  props: {},
  selectedPropId: null,

  addProp: (prop) => set(state => {
    state.props[prop.id] = prop
  }),

  updateProp: (id, changes) => set(state => {
    const prop = state.props[id]
    if (prop) Object.assign(prop, changes)
  }),

  deleteProp: (id) => set(state => {
    delete state.props[id]
    if (state.selectedPropId === id) state.selectedPropId = null
  }),

  clearProps: () => set(state => {
    state.props = {}
    state.selectedPropId = null
  }),

  selectProp: (id) => set(state => {
    state.selectedPropId = id
  }),

  bringPropToFront: (id) => set(state => {
    const prop = state.props[id]
    if (!prop) return
    const highest = Math.max(0, ...Object.values(state.props).map(p => p.z))
    prop.z = highest + 1
  }),

  sendPropToBack: (id) => set(state => {
    const prop = state.props[id]
    if (!prop) return
    const lowest = Math.min(0, ...Object.values(state.props).map(p => p.z))
    prop.z = lowest - 1
  }),

  getSelectedProp: () => {
    const { props, selectedPropId } = get()
    return selectedPropId ? props[selectedPropId] ?? null : null
  },
})
