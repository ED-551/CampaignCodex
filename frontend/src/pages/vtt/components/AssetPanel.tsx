/**
 * AssetPanel.tsx — Asset Library slide-in panel.
 *
 * Shows two tabs: Tokens and Backgrounds.
 * Built-in placeholder tokens are always listed first.
 * Users can upload images, which are persisted to IndexedDB and listed below.
 *
 * Drag-and-drop:
 *   - Drag a token onto the canvas → creates a Token at the drop position.
 *   - Drag a background onto the canvas → sets the scene background.
 *   - The canvas drop handler (VTTCanvas.tsx) reads 'vtt/asset-id' from
 *     dataTransfer to identify which asset was dropped.
 *
 * Also supports clicking on an asset to "quick-place" at the canvas center
 * (future enhancement — currently drag-only).
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { useVTTStore }       from '../store'
import { PLACEHOLDER_TOKENS } from '../assets/placeholders'
import {
  saveAsset, deleteAsset, listAssets,
  makeThumbnail, fileToDataUrl,
  type AssetRecord,
} from '../assets/assetDb'
import { nanoid } from '../utils/nanoid'
import type { AssetMeta } from '../store/assetSlice'

interface Props {
  open:    boolean
  onClose: () => void
}

type Tab = 'tokens' | 'backgrounds'

export function AssetPanel({ open, onClose }: Props) {
  const assets        = useVTTStore(s => s.assets)
  const assetsLoaded  = useVTTStore(s => s.assetsLoaded)
  const setAssets     = useVTTStore(s => s.setAssets)
  const addAssetMeta  = useVTTStore(s => s.addAssetMeta)
  const removeAssetMeta = useVTTStore(s => s.removeAssetMeta)

  const [tab,      setTab]      = useState<Tab>('tokens')
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load user assets from IndexedDB on first open ─────────────────────────
  useEffect(() => {
    if (!open || assetsLoaded) return
    listAssets().then(records => {
      const metas: AssetMeta[] = records.map(r => ({
        id: r.id, name: r.name, type: r.type,
        thumbnail: r.thumbnail, width: r.width,
        height: r.height, createdAt: r.createdAt,
      }))
      setAssets(metas)
    }).catch(console.error)
  }, [open, assetsLoaded, setAssets])

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setLoading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl          = await fileToDataUrl(file)
        const { thumb, w, h } = await makeThumbnail(dataUrl)
        const record: AssetRecord = {
          id:        nanoid(),
          name:      file.name.replace(/\.[^.]+$/, ''),
          type:      tab === 'backgrounds' ? 'background' : 'token',
          dataUrl,
          thumbnail: thumb,
          width:     w,
          height:    h,
          createdAt: Date.now(),
        }
        await saveAsset(record)
        addAssetMeta({
          id: record.id, name: record.name, type: record.type,
          thumbnail: record.thumbnail, width: record.width,
          height: record.height, createdAt: record.createdAt,
        })
      }
    } catch (err) {
      console.error('Asset upload failed:', err)
    } finally {
      setLoading(false)
    }
  }, [tab, addAssetMeta])

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteAsset(id)
    removeAssetMeta(id)
  }, [removeAssetMeta])

  // ── Drag start — set transfer data for canvas drop handler ────────────────
  const handleDragStart = useCallback((asset: AssetMeta | AssetRecord, e: React.DragEvent) => {
    e.dataTransfer.setData('vtt/asset-id',   asset.id)
    e.dataTransfer.setData('vtt/asset-type', asset.type)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  if (!open) return null

  // ── Filter lists ──────────────────────────────────────────────────────────
  const q = search.toLowerCase()

  const placeholders = PLACEHOLDER_TOKENS.filter(p =>
    tab === 'tokens' && p.name.toLowerCase().includes(q)
  )

  const userAssets = assets.filter(a =>
    a.type === tab.replace('s', '') &&
    a.name.toLowerCase().includes(q)
  )

  return (
    <div className="asset-panel-backdrop" onClick={onClose}>
      <aside className="asset-panel" onClick={e => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="asset-panel-header">
          <span className="asset-panel-title">🖼 Asset Library</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="net-tabs">
          <button
            className={`net-tab ${tab === 'tokens'      ? 'active' : ''}`}
            onClick={() => { setTab('tokens');      setSearch('') }}
          >
            Tokens
          </button>
          <button
            className={`net-tab ${tab === 'backgrounds' ? 'active' : ''}`}
            onClick={() => { setTab('backgrounds'); setSearch('') }}
          >
            Backgrounds
          </button>
        </div>

        {/* ── Search ──────────────────────────────────────────────────── */}
        <div className="asset-search-row">
          <input
            type="text"
            className="net-input"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className="net-primary-btn asset-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? '…' : '+ Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />
        </div>

        {/* ── Grid ────────────────────────────────────────────────────── */}
        <div className="asset-grid">

          {/* Built-in placeholders (tokens only) */}
          {placeholders.map(asset => (
            <div
              key={asset.id}
              className="asset-item placeholder"
              draggable
              onDragStart={e => handleDragStart(asset, e)}
              title={`${asset.name} (built-in)\nDrag to canvas`}
            >
              <img src={asset.thumbnail} alt={asset.name} className="asset-thumb" />
              <span className="asset-name">{asset.name}</span>
            </div>
          ))}

          {/* User-uploaded assets */}
          {userAssets.map(asset => (
            <div
              key={asset.id}
              className="asset-item"
              draggable
              onDragStart={e => handleDragStart(asset, e)}
              title={`${asset.name}\nDrag to canvas`}
            >
              <img src={asset.thumbnail} alt={asset.name} className="asset-thumb" />
              <span className="asset-name">{asset.name}</span>
              <button
                className="asset-delete-btn"
                onClick={e => handleDelete(asset.id, e)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Empty state */}
          {placeholders.length === 0 && userAssets.length === 0 && (
            <div className="asset-empty">
              {search
                ? 'No assets match your search.'
                : `No ${tab} yet. Click "+ Upload" to add images.`}
            </div>
          )}
        </div>

        <p className="asset-hint">
          Drag an asset onto the canvas to place it.
        </p>
      </aside>
    </div>
  )
}
