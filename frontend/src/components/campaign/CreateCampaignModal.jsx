import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../../utils/api'

const GAMES = [
  {
    id:    'shadowdark',
    name:  'Shadowdark',
    desc:  'Dark, gritty OSR dungeon crawl',
    color: '#8b6914',
    bg:    'rgba(139,105,20,0.1)',
  },
  {
    id:    'morkborg',
    name:  'Mörk Borg',
    desc:  'Apocalyptic death-metal fantasy',
    color: '#c4c400',
    bg:    'rgba(196,196,0,0.08)',
  },
  {
    id:    'nimble',
    name:  'Nimble RPG',
    desc:  'Fast-paced heroic fantasy',
    color: '#4a8c5c',
    bg:    'rgba(74,140,92,0.1)',
  },
]

export default function CreateCampaignModal({ onClose, onCreated }) {
  const [step, setStep]         = useState(1)   // 1 = details, 2 = pick game
  const [name, setName]         = useState('')
  const [description, setDesc]  = useState('')
  const [gameSystem, setGame]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleCreate() {
    if (!name.trim())   { setError('Campaign name is required.'); return }
    if (!gameSystem)    { setError('Please select a game system.'); return }
    setError('')
    setLoading(true)
    try {
      const { campaign } = await api.post('/campaigns', { name: name.trim(), description, gameSystem })
      onCreated(campaign)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create campaign.')
    } finally {
      setLoading(false)
    }
  }

  const INPUT = `w-full bg-codex-bg border border-codex-border rounded-lg px-4 py-2.5 text-codex-text placeholder-codex-muted text-base sm:text-sm focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30 transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-codex-card border border-codex-border rounded-2xl shadow-card overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-codex-text">New Campaign</h2>
            <p className="text-xs text-codex-subtext mt-0.5">
              Step {step} of 2 — {step === 1 ? 'Campaign details' : 'Choose your game'}
            </p>
          </div>
          <button onClick={onClose} className="text-codex-muted hover:text-codex-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="h-px bg-codex-border" />

        <div className="px-6 py-5 flex flex-col gap-4">
          {step === 1 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-codex-text">Campaign Name</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. The Shattered Crown" className={INPUT} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-codex-text">
                  Description <span className="text-codex-subtext font-normal">(optional)</span>
                </label>
                <textarea value={description} onChange={e => setDesc(e.target.value)}
                  placeholder="A short description players will see when joining…"
                  rows={3}
                  className={INPUT + ' resize-none'} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-codex-subtext">
                Players can only add character sheets that match the campaign's game system.
                This cannot be changed after creation.
              </p>
              {GAMES.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGame(g.id)}
                  style={gameSystem === g.id
                    ? { borderColor: g.color, background: g.bg }
                    : {}}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150
                    ${gameSystem === g.id
                      ? 'border-current'
                      : 'border-codex-border bg-codex-surface hover:border-codex-muted'}`}
                >
                  <span className="block font-semibold text-codex-text" style={gameSystem === g.id ? { color: g.color } : {}}>
                    {g.name}
                  </span>
                  <span className="text-xs text-codex-subtext">{g.desc}</span>
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            {step === 2 && (
              <button onClick={() => { setError(''); setStep(1) }}
                className="flex-1 py-2.5 rounded-lg border border-codex-border text-codex-text text-sm hover:border-codex-muted transition-colors">
                ← Back
              </button>
            )}
            <button
              onClick={step === 1 ? () => { if (!name.trim()) { setError('Campaign name is required.'); return }; setError(''); setStep(2) } : handleCreate}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm transition-all disabled:opacity-50">
              {loading ? 'Creating…' : step === 1 ? 'Next →' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
