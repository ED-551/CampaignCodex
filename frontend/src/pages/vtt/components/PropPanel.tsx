/**
 * PropPanel.tsx — Place and manage scenery images.
 *
 * This is the workflow the panel exists for: drop a world map as the scene
 * background, then drop a tavern interior on top of it as a prop, position and
 * rotate it, and build the encounter inside.
 *
 * Uploading places the image at the centre of the current view, sized so a
 * large map arrives at a workable size rather than filling the world.
 */

import { useRef, useState } from 'react'
import { useVTTStore }      from '../store'
import { nanoid }           from '../utils/nanoid'
import { uploadImage, imageSize } from '../assets/uploadImage'
import type { Prop }        from '../types'

/** Longest edge a freshly placed prop occupies on screen, in world pixels. */
const PLACED_MAX_EDGE = 600

export function PropPanel() {
  const activeTool = useVTTStore(s => s.activeTool)
  const props      = useVTTStore(s => s.props)
  const selectedId = useVTTStore(s => s.selectedPropId)
  const isGM       = useVTTStore(s => s.network.isGM)
  const preview    = useVTTStore(s => s.playerPreviewMode)

  const addProp    = useVTTStore(s => s.addProp)
  const updateProp = useVTTStore(s => s.updateProp)
  const deleteProp = useVTTStore(s => s.deleteProp)
  const selectProp = useVTTStore(s => s.selectProp)
  const toFront    = useVTTStore(s => s.bringPropToFront)
  const toBack     = useVTTStore(s => s.sendPropToBack)

  const fileRef = useRef<HTMLInputElement>(null)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (activeTool !== 'prop' || !isGM || preview) return null

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue

        const [{ url }, size] = await Promise.all([
          uploadImage(file, 'vtt_prop'),
          imageSize(file),
        ])

        // Scale the longest edge down to something manageable, keeping aspect.
        const longest = Math.max(size.width, size.height)
        const factor  = longest > PLACED_MAX_EDGE ? PLACED_MAX_EDGE / longest : 1

        // Drop it in the middle of what the GM is currently looking at.
        const vp = useVTTStore.getState().viewport
        const centre = {
          x: (window.innerWidth  / 2 - vp.x) / vp.scale,
          y: (window.innerHeight / 2 - vp.y) / vp.scale,
        }

        const prop: Prop = {
          id:       nanoid(),
          imageUrl: url,
          label:    file.name.replace(/\.[^.]+$/, ''),
          x:        centre.x,
          y:        centre.y,
          width:    size.width  * factor,
          height:   size.height * factor,
          rotation: 0,
          opacity:  1,
          z:        Math.max(0, ...Object.values(useVTTStore.getState().props).map(p => p.z)) + 1,
          visible:  true,
          locked:   false,
        }
        addProp(prop)
        selectProp(prop.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Topmost first, matching what the GM sees on the map.
  const ordered = Object.values(props).sort((a, b) => b.z - a.z)
  const selected = selectedId ? props[selectedId] : null

  return (
    <div className="side-panel left-panel">
      <div className="panel-header">
        <span className="panel-title">🏠 Scenery</span>
        <span className="panel-hint">
          Images layered over the map — buildings, furniture, overlays
        </span>
      </div>

      <div className="panel-section">
        <button
          className="net-primary-btn"
          style={{ width: '100%' }}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : '+ Add scenery image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        {error && (
          <p className="panel-hint" style={{ color: '#fca5a5', paddingTop: 6 }}>{error}</p>
        )}
      </div>

      {/* Selected prop controls */}
      {selected && (
        <div className="panel-section">
          <div className="prop-section-label">{selected.label || 'Scenery'}</div>

          <div className="prop-row" style={{ gap: 8, paddingTop: 4 }}>
            <span className="prop-label" style={{ width: 52, fontSize: 10 }}>
              Opacity {Math.round(selected.opacity * 100)}%
            </span>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={selected.opacity}
              className="ambient-slider"
              onChange={e => updateProp(selected.id, { opacity: parseFloat(e.target.value) })}
            />
          </div>

          <div className="prop-row" style={{ gap: 8, paddingTop: 4 }}>
            <span className="prop-label" style={{ width: 52, fontSize: 10 }}>
              Rotate {Math.round(selected.rotation * 180 / Math.PI)}°
            </span>
            <input
              type="range" min={0} max={Math.PI * 2} step={Math.PI / 180}
              value={selected.rotation}
              className="ambient-slider"
              onChange={e => updateProp(selected.id, { rotation: parseFloat(e.target.value) })}
            />
          </div>

          <div className="fog-brush-row" style={{ paddingTop: 6 }}>
            <button className="fog-brush-btn" onClick={() => toBack(selected.id)} title="Send behind other scenery">
              ▽ Back
            </button>
            <button className="fog-brush-btn" onClick={() => toFront(selected.id)} title="Bring in front of other scenery">
              △ Front
            </button>
          </div>

          <div className="fog-brush-row" style={{ paddingTop: 6 }}>
            <button
              className={`fog-brush-btn ${!selected.visible ? 'active hide' : ''}`}
              onClick={() => updateProp(selected.id, { visible: !selected.visible })}
              title={selected.visible ? 'Hide from players' : 'Show to players'}
            >
              {selected.visible ? '👁 Visible' : '🚫 Hidden'}
            </button>
            <button
              className={`fog-brush-btn ${selected.locked ? 'active reveal' : ''}`}
              onClick={() => updateProp(selected.id, { locked: !selected.locked })}
              title={selected.locked ? 'Unlock so it can be moved' : 'Lock so it stops catching clicks'}
            >
              {selected.locked ? '🔒 Locked' : '🔓 Unlocked'}
            </button>
          </div>

          <p className="panel-hint" style={{ paddingTop: 8 }}>
            Drag to move · corner handles resize · green handle rotates
            {' '}(hold Shift to snap to 15°)
          </p>
        </div>
      )}

      {/* Stack listing */}
      <div className="panel-section">
        <div className="prop-section-label">On the map ({ordered.length})</div>
        {ordered.length === 0 && (
          <p className="panel-hint">Nothing placed yet.</p>
        )}
        {ordered.map(p => (
          <div
            key={p.id}
            className="prop-row"
            style={{
              gap: 6,
              cursor: 'pointer',
              opacity: p.visible ? 1 : 0.55,
              background: p.id === selectedId ? 'rgba(96,165,250,0.12)' : undefined,
            }}
            onClick={() => selectProp(p.id)}
          >
            <span className="prop-label" style={{ flex: 1, fontSize: 11 }}>
              {p.locked && '🔒 '}{p.visible ? '' : '🚫 '}{p.label || 'Scenery'}
            </span>
            <button
              className="fog-brush-btn"
              style={{ padding: '2px 6px' }}
              title="Remove"
              onClick={e => { e.stopPropagation(); deleteProp(p.id) }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
