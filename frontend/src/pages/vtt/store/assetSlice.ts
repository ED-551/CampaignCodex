/**
 * assetSlice.ts — Zustand slice for asset library metadata.
 *
 * Stores only lightweight metadata (no blobs) so React re-renders stay cheap.
 * Full data URLs live in IndexedDB (assetDb.ts) and are fetched on demand.
 *
 * Placeholders (built-in SVG tokens) are pre-populated via App.tsx on mount
 * so the panel is immediately usable without any uploads.
 */

import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetMeta {
  id:        string
  name:      string
  type:      'token' | 'background'
  thumbnail: string   // 64×64 data URL for panel display
  width:     number
  height:    number
  createdAt: number
}

export interface AssetSlice {
  assets:       AssetMeta[]
  assetsLoaded: boolean

  /** Replace the full metadata list (called on initial load from IndexedDB). */
  setAssets: (assets: AssetMeta[]) => void

  /** Append a single new asset (called after successful upload). */
  addAssetMeta: (meta: AssetMeta) => void

  /** Remove an asset from the list (called after IndexedDB delete). */
  removeAssetMeta: (id: string) => void
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export const createAssetSlice: StateCreator<VTTStore, [['zustand/immer', never]], [], AssetSlice> = (set) => ({
  assets:       [],
  assetsLoaded: false,

  setAssets: (assets) =>
    set(state => {
      state.assets       = assets
      state.assetsLoaded = true
    }),

  addAssetMeta: (meta) =>
    set(state => {
      state.assets.push(meta)
    }),

  removeAssetMeta: (id) =>
    set(state => {
      state.assets = state.assets.filter((a: AssetMeta) => a.id !== id)
    }),
})
