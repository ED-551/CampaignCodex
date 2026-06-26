/**
 * SceneManager.tsx — Multi-scene switcher and session file I/O.
 *
 * Panel features:
 *  • List all scenes — click to switch active
 *  • Inline rename — double-click the name
 *  • Add blank scene / Duplicate active scene
 *  • Delete scene (disabled if only one)
 *  • Export session → .vtt file (full JSON snapshot)
 *  • Import .vtt file → replaces session (with confirmation)
 *
 * Opened via toolbar ⛺ button or the [S] key.
 */

import { useRef, useState }      from 'react'
import { useVTTStore }            from '../store'
import { exportVTT, importVTT, VTTImportError } from '../scene/vttFile'

interface Props {
  open:    boolean
  onClose: () => void
}

export function SceneManager({ open, onClose }: Props) {
  const scenes        = useVTTStore(s => s.scenes)
  const activeSceneId = useVTTStore(s => s.activeSceneId)

  const switchScene     = useVTTStore(s => s.switchScene)
  const addScene        = useVTTStore(s => s.addScene)
  const duplicateScene  = useVTTStore(s => s.duplicateScene)
  const renameScene     = useVTTStore(s => s.renameScene)
  const removeScene     = useVTTStore(s => s.removeScene)

  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importOk,    setImportOk]    = useState<string | null>(null)
  const [importing,   setImporting]   = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function startRename(id: string, name: string) {
    setRenamingId(id)
    setRenameValue(name)
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      renameScene(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // allow re-selecting same file
    setImportError(null)
    setImportOk(null)
    setImporting(true)
    try {
      const result = await importVTT(file)
      setImportOk(`Loaded ${result.scenesLoaded} scene${result.scenesLoaded !== 1 ? 's' : ''} from "${file.name}"`)
    } catch (err) {
      setImportError(
        err instanceof VTTImportError
          ? err.message
          : 'Import failed — file may be corrupt.'
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="scene-manager-backdrop" onClick={onClose}>
      <div className="scene-manager" onClick={e => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="scene-manager-header">
          <span className="scene-manager-title">⛺ Scenes</span>
          <button className="tracker-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* ── Scene list ───────────────────────────────────────────────── */}
        <div className="scene-list">
          {scenes.map(scene => {
            const isActive   = scene.id === activeSceneId
            const isRenaming = renamingId === scene.id

            return (
              <div
                key={scene.id}
                className={`scene-row ${isActive ? 'active' : ''}`}
                onClick={() => { if (!isRenaming) switchScene(scene.id) }}
              >
                {/* Active indicator */}
                <span className="scene-active-dot">{isActive ? '●' : '○'}</span>

                {/* Name (or rename input) */}
                {isRenaming ? (
                  <input
                    className="scene-rename-input"
                    value={renameValue}
                    autoFocus
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitRename()
                      if (e.key === 'Escape') setRenamingId(null)
                      e.stopPropagation()
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="scene-name"
                    onDoubleClick={e => { e.stopPropagation(); startRename(scene.id, scene.name) }}
                    title="Double-click to rename"
                  >
                    {scene.name}
                  </span>
                )}

                {/* Token / entity counts */}
                <span className="scene-meta">
                  {isActive
                    ? `${Object.keys(useVTTStore.getState().tokens).length}t`
                    : `${scene.tokens.length}t`
                  }
                </span>

                {/* Actions */}
                <div className="scene-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="scene-action-btn"
                    title="Rename"
                    onClick={() => startRename(scene.id, scene.name)}
                  >✎</button>
                  <button
                    className="scene-action-btn"
                    title="Duplicate"
                    onClick={() => {
                      if (!isActive) switchScene(scene.id)
                      setTimeout(() => duplicateScene(), 0)
                    }}
                  >⧉</button>
                  <button
                    className="scene-action-btn danger"
                    title="Delete scene"
                    disabled={scenes.length <= 1}
                    onClick={() => removeScene(scene.id)}
                  >✕</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Add scene ───────────────────────────────────────────────── */}
        <div className="scene-add-row">
          <button
            className="scene-add-btn"
            onClick={() => addScene(`Scene ${scenes.length + 1}`)}
          >
            + New Scene
          </button>
          <button
            className="scene-add-btn"
            onClick={duplicateScene}
            title="Duplicate current scene"
          >
            ⧉ Duplicate
          </button>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div className="scene-divider" />

        {/* ── File I/O ────────────────────────────────────────────────── */}
        <div className="scene-io-section">
          <div className="scene-io-label">Session File (.vtt)</div>

          <div className="scene-io-row">
            <button
              className="scene-io-btn export"
              onClick={exportVTT}
              title="Export all scenes to a .vtt file"
            >
              ↓ Export Session
            </button>

            <button
              className="scene-io-btn import"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              title="Import a .vtt file (replaces current session)"
            >
              {importing ? '…' : '↑ Import Session'}
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".vtt,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />

          {importError && (
            <div className="scene-io-error">⚠ {importError}</div>
          )}
          {importOk && (
            <div className="scene-io-ok">✓ {importOk}</div>
          )}

          <div className="scene-io-hint">
            Export saves all scenes with tokens, walls, lights, fog, and drawings.
            Import replaces the current session.
          </div>
        </div>
      </div>
    </div>
  )
}
