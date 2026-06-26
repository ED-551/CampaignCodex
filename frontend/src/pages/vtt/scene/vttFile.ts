/**
 * vttFile.ts — .vtt session file export and import.
 *
 * File format
 * ────────────
 * A .vtt file is a UTF-8 JSON document with the following shape:
 *
 *   {
 *     "version":       1,
 *     "app":           "campaign-vtt",
 *     "exportedAt":    "2026-06-23T...",
 *     "activeSceneId": "<uuid>",
 *     "scenes": [ ...Scene[] ]
 *   }
 *
 * Each Scene includes its tokens[], walls[], lights[], drawings[], fog,
 * grid, background, and ambientLight — a complete snapshot.
 *
 * The file is plain JSON (no compression) so it remains human-readable
 * and easily diffable in version control.
 *
 * Usage
 * ─────
 *   exportVTT()                  // triggers browser download
 *   importVTT(file, store)       // reads File, validates, loads into store
 */

import { useVTTStore }  from '../store'
import type { Scene }   from '../types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const VTT_VERSION = 1
const APP_NAME    = 'campaign-vtt'

export interface VTTSaveFile {
  version:       typeof VTT_VERSION
  app:           typeof APP_NAME
  exportedAt:    string
  activeSceneId: string
  scenes:        Scene[]
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Snapshot the current session and trigger a browser download of a .vtt file.
 */
export function exportVTT(): void {
  const store = useVTTStore.getState()

  // snapshotAndGetScenes flushes live state into scenes[] before we read them
  const scenes        = store.snapshotAndGetScenes()
  const activeSceneId = store.activeSceneId

  const payload: VTTSaveFile = {
    version:    VTT_VERSION,
    app:        APP_NAME,
    exportedAt: new Date().toISOString(),
    activeSceneId,
    scenes,
  }

  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)

  // Derive a filename from the first scene name or a timestamp
  const slug = scenes[0]?.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 32) ?? 'session'
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename  = `${slug}-${timestamp}.vtt`

  const a = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Import ───────────────────────────────────────────────────────────────────

export class VTTImportError extends Error {
  constructor(msg: string) { super(msg); this.name = 'VTTImportError' }
}

/**
 * Read a File object (from <input type="file">), validate it, and load the
 * session into the store.
 *
 * Throws `VTTImportError` on validation failure.
 */
export async function importVTT(file: File): Promise<{ scenesLoaded: number }> {
  const text = await file.text()

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new VTTImportError('File is not valid JSON.')
  }

  // Validate shape
  if (typeof data !== 'object' || data === null) {
    throw new VTTImportError('File is not a valid .vtt session file.')
  }
  const d = data as Record<string, unknown>

  if (d.version !== VTT_VERSION) {
    throw new VTTImportError(
      `Unsupported .vtt version: ${d.version}. Expected ${VTT_VERSION}.`
    )
  }
  if (d.app !== APP_NAME) {
    throw new VTTImportError(`File app tag "${d.app}" does not match "${APP_NAME}".`)
  }
  if (!Array.isArray(d.scenes) || d.scenes.length === 0) {
    throw new VTTImportError('File contains no scenes.')
  }

  const scenes        = d.scenes as Scene[]
  const activeSceneId = typeof d.activeSceneId === 'string' ? d.activeSceneId : scenes[0].id

  // Load all scenes into the store, then switch to the saved active scene
  const store = useVTTStore.getState()

  // Reset to a blank slate before importing
  // Load scenes one by one; loadScene handles both new and existing ids
  for (const scene of scenes) {
    store.loadScene(scene)
  }

  // Switch to the scene that was active when the file was exported
  const targetExists = scenes.some(s => s.id === activeSceneId)
  store.switchScene(targetExists ? activeSceneId : scenes[0].id)

  return { scenesLoaded: scenes.length }
}
