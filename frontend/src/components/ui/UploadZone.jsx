import { useState, useRef } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'

/**
 * Reusable image upload zone.
 *
 * Props:
 *   purpose    — 'profile' | 'portrait' | 'vtt_map' | 'vtt_token' | 'general'
 *   currentUrl — existing image URL to preview
 *   onUploaded — (url: string, id: string) => void  called on success
 *   onRemoved  — () => void  called when user clears the current image
 *   accept     — mime type string, default 'image/*'
 *   label      — button label, default 'Upload Image'
 *   className  — extra class names for the wrapper
 *   compact    — bool, shows a small inline button instead of a drop zone
 */
export default function UploadZone({
  purpose = 'general',
  currentUrl,
  onUploaded,
  onRemoved,
  accept = 'image/*',
  label = 'Upload Image',
  className = '',
  compact = false,
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const inputRef                  = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('purpose', purpose)
      const token = localStorage.getItem('cc_token')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed.')
      onUploaded?.(json.url, json.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-codex-border
            text-codex-subtext text-xs hover:text-codex-text hover:border-codex-gold/40
            transition-colors disabled:opacity-50"
        >
          <Upload size={12} />
          {uploading ? 'Uploading…' : label}
        </button>
        {currentUrl && onRemoved && (
          <button
            type="button"
            onClick={onRemoved}
            className="text-codex-muted hover:text-red-400 transition-colors"
            title="Remove image"
          >
            <X size={14} />
          </button>
        )}
        {error && <span className="text-red-400 text-xs">{error}</span>}
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onInputChange} />
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer
          flex flex-col items-center justify-center gap-2 p-6 min-h-[120px]
          ${dragOver
            ? 'border-codex-gold bg-codex-gold/5'
            : 'border-codex-border hover:border-codex-gold/40 bg-codex-surface'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {currentUrl
          ? <img src={currentUrl} alt="current" className="max-h-24 max-w-full object-contain rounded-lg" />
          : <ImageIcon size={32} className="text-codex-muted" />
        }
        <span className="text-sm text-codex-subtext">
          {uploading ? 'Uploading…' : currentUrl ? 'Click or drop to replace' : 'Click or drop an image'}
        </span>
        <span className="text-xs text-codex-muted">JPEG, PNG, WebP or GIF · max 10 MB</span>

        {currentUrl && onRemoved && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemoved() }}
            className="absolute top-2 right-2 p-1 rounded-full bg-codex-card border border-codex-border
              text-codex-muted hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onInputChange} />
    </div>
  )
}
