/**
 * assetDb.ts — IndexedDB persistence layer for VTT assets.
 *
 * Uses the `idb` library for a type-safe, promise-based API.
 * Stores complete asset records (including full dataUrl blobs) so assets
 * survive browser refreshes without any server.
 *
 * Schema:
 *   DB:    vtt-assets  v1
 *   Store: assets      keyPath: id
 */

import { openDB, type IDBPDatabase } from 'idb'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetRecord {
  id:         string
  name:       string
  type:       'token' | 'background'
  /** Full-resolution data URL (png/jpg/webp/svg). */
  dataUrl:    string
  /** 64×64 thumbnail data URL for quick rendering in the panel. */
  thumbnail:  string
  width:      number
  height:     number
  createdAt:  number
}

// ─── DB bootstrap ─────────────────────────────────────────────────────────────

const DB_NAME  = 'vtt-assets'
const DB_VER   = 1
const STORE    = 'assets'

let _db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VER, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    },
  })
  return _db
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function saveAsset(record: AssetRecord): Promise<void> {
  const db = await getDb()
  await db.put(STORE, record)
}

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await getDb()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAsset(id: string): Promise<AssetRecord | undefined> {
  const db = await getDb()
  return db.get(STORE, id)
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

// ─── Thumbnail generator ──────────────────────────────────────────────────────

/** Scale an image down to a 64×64 thumbnail (webp, 0.8 quality). */
export async function makeThumbnail(
  dataUrl: string
): Promise<{ thumb: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img    = new Image()
    img.onload = () => {
      const SIZE = 64
      const canvas = document.createElement('canvas')
      canvas.width  = SIZE
      canvas.height = SIZE
      const ctx  = canvas.getContext('2d')!
      const scale = Math.min(SIZE / img.width, SIZE / img.height)
      const dw    = img.width  * scale
      const dh    = img.height * scale
      ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh)
      resolve({
        thumb: canvas.toDataURL('image/webp', 0.8),
        w:     img.width,
        h:     img.height,
      })
    }
    img.onerror = reject
    img.src     = dataUrl
  })
}

/** Read a File to a data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
