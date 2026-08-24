/**
 * sceneSlice.ts — Multi-scene management.
 *
 * Architecture
 * ─────────────
 * • `state.tokens / walls / lights / drawings / fog / grid` are the "live"
 *   top-level slices that canvas managers subscribe to. They represent the
 *   currently active scene.
 *
 * • Each `Scene` in `state.scenes[]` stores the same data as arrays (tokens,
 *   walls, etc.) so it can be serialised to a .vtt file and restored intact.
 *
 * Scene-switch lifecycle
 * ──────────────────────
 *   1. snapshotActive() — copy live top-level state back into scenes[activeIdx]
 *   2. state.activeSceneId = newId
 *   3. populateLive(scene) — copy scene arrays into live top-level state
 *
 * Every action that changes the active scene (switchScene, addScene,
 * duplicateScene, loadScene) must follow this pattern.
 */

import type { StateCreator } from 'zustand'
import { nanoid }            from '../utils/nanoid'
import type { VTTStore }     from './index'
import type { Scene, Token, Wall, LightSource, Drawing, Prop } from '../types'
import { DEFAULT_GRID }      from './gridSlice'
import { DEFAULT_FOG }       from './fogSlice'

export function makeBlankScene(name = 'New Scene'): Scene {
  return {
    id:           nanoid(),
    name,
    grid:         { ...DEFAULT_GRID },
    background:   null,
    props:        [],
    tokens:       [],
    walls:        [],
    lights:       [],
    fog:          { ...DEFAULT_FOG },
    drawings:     [],
    ambientLight: 1,
  }
}

// ─── Helpers (operate on immer draft — types inferred by immer) ──────────────

/** Convert array → Record keyed by id. */
function toRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
  const r: Record<string, T> = {}
  for (const item of arr) r[item.id] = item
  return r
}

/** Copy current live top-level state into scenes[activeSceneId]. */
function snapshotActiveTo(state: {
  scenes: Scene[];        activeSceneId: string
  props:  Record<string, Prop>
  tokens: Record<string, Token>;   walls:    Record<string, Wall>
  lights: Record<string, LightSource>; drawings: Record<string, Drawing>
  fog: Scene['fog'];      grid: Scene['grid']
}): void {
  const idx = state.scenes.findIndex(s => s.id === state.activeSceneId)
  if (idx < 0) return
  state.scenes[idx].props    = Object.values(state.props)
  state.scenes[idx].tokens   = Object.values(state.tokens)
  state.scenes[idx].walls    = Object.values(state.walls)
  state.scenes[idx].lights   = Object.values(state.lights)
  state.scenes[idx].drawings = Object.values(state.drawings)
  state.scenes[idx].fog      = { ...state.fog }
  state.scenes[idx].grid     = { ...state.grid }
}

/** Populate live top-level slices from a scene's array data. */
function populateLive(state: {
  props:  Record<string, Prop>
  tokens: Record<string, Token>;   walls:    Record<string, Wall>
  lights: Record<string, LightSource>; drawings: Record<string, Drawing>
  fog: Scene['fog'];      grid: Scene['grid']
}, scene: Scene): void {
  // Scenes saved before props existed have no array; treat that as empty.
  state.props    = toRecord(scene.props ?? [])   as Record<string, Prop>
  state.tokens   = toRecord(scene.tokens)   as Record<string, Token>
  state.walls    = toRecord(scene.walls)    as Record<string, Wall>
  state.lights   = toRecord(scene.lights)   as Record<string, LightSource>
  state.drawings = toRecord(scene.drawings) as Record<string, Drawing>
  Object.assign(state.fog,  scene.fog)
  Object.assign(state.grid, scene.grid)
}

// ─── Slice type ───────────────────────────────────────────────────────────────

export interface SceneSlice {
  scenes:        Scene[]
  activeSceneId: string

  /** Replace the active scene's full data (used when loading from file or network). */
  loadScene: (scene: Scene) => void

  /** Switch active scene by id. Snapshots current scene before switching. */
  switchScene: (id: string) => void

  /** Create a new blank scene, add it, switch to it. */
  addScene: (name?: string) => string

  /** Duplicate the active scene (including all current live state). */
  duplicateScene: () => string

  /** Rename a scene. */
  renameScene: (id: string, name: string) => void

  /** Remove a scene. Cannot remove the last one. */
  removeScene: (id: string) => void

  /** Partial update on the currently active scene (e.g. ambientLight, background). */
  updateActiveScene: (changes: Partial<Scene>) => void

  /** Convenience accessor — the currently active Scene object. */
  getActiveScene: () => Scene

  /**
   * Snapshot all live state into scenes[] then return all scenes.
   * Used by the export function to get a complete picture.
   */
  snapshotAndGetScenes: () => Scene[]
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export const createSceneSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  SceneSlice
> = (set, get) => {
  const initial = makeBlankScene('Scene 1')
  return {
    scenes:        [initial],
    activeSceneId: initial.id,

    loadScene: (scene) => set(state => {
      const idx = state.scenes.findIndex((s: Scene) => s.id === scene.id)
      if (idx >= 0) {
        state.scenes[idx] = scene
      } else {
        state.scenes.push(scene)
      }
      // If this is the active scene (or we're replacing/adding as active), populate live state
      if (scene.id === state.activeSceneId || idx < 0) {
        state.activeSceneId = scene.id
        populateLive(state, scene)
      }
    }),

    switchScene: (id) => set(state => {
      const target = state.scenes.find((s: Scene) => s.id === id)
      if (!target || id === state.activeSceneId) return

      // 1. Snapshot current live state back into the active scene
      snapshotActiveTo(state)

      // 2. Switch
      state.activeSceneId = id

      // 3. Load the new scene's data into live top-level slices
      populateLive(state, target)
    }),

    addScene: (name = 'New Scene') => {
      const scene = makeBlankScene(name)
      set(state => {
        // Snapshot current scene before leaving it
        snapshotActiveTo(state)
        state.scenes.push(scene)
        state.activeSceneId = scene.id
        // New blank scene — populate live with empty state
        populateLive(state, scene)
      })
      return scene.id
    },

    duplicateScene: () => {
      // Snapshot first so getActiveScene() returns complete data
      set(state => { snapshotActiveTo(state) })

      const src  = get().getActiveScene()
      const copy = JSON.parse(JSON.stringify(src)) as Scene
      copy.id    = nanoid()
      copy.name  = `${src.name} (copy)`

      set(state => {
        state.scenes.push(copy)
        state.activeSceneId = copy.id
        populateLive(state, copy)
      })
      return copy.id
    },

    renameScene: (id, name) => set(state => {
      const s = state.scenes.find((sc: Scene) => sc.id === id)
      if (s) s.name = name
    }),

    removeScene: (id) => set(state => {
      if (state.scenes.length <= 1) return
      const wasActive = state.activeSceneId === id
      state.scenes = state.scenes.filter((s: Scene) => s.id !== id)
      if (wasActive) {
        const next = state.scenes[0]
        state.activeSceneId = next.id
        populateLive(state, next)
      }
    }),

    updateActiveScene: (changes) => set(state => {
      const idx = state.scenes.findIndex((s: Scene) => s.id === state.activeSceneId)
      if (idx >= 0) Object.assign(state.scenes[idx], changes)
    }),

    getActiveScene: () => {
      const { scenes, activeSceneId } = get()
      return scenes.find(s => s.id === activeSceneId) ?? scenes[0]
    },

    snapshotAndGetScenes: () => {
      set(state => { snapshotActiveTo(state) })
      return get().scenes
    },
  }
}
