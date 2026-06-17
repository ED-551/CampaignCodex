import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'

// Lazy-load character sheets
const SHEETS = {
  shadowdark: lazy(() => import('../components/character/sheets/ShadowdarkSheet')),
  morkborg:   lazy(() => import('../components/character/sheets/MorkborgSheet')),
  nimble:     lazy(() => import('../components/character/sheets/NimbleSheet')),
}

// Lazy-load character creation wizards
const WIZARDS = {
  shadowdark: lazy(() => import('../components/character/wizards/ShadowdarkWizard')),
  morkborg:   lazy(() => import('../components/character/wizards/MorkborgWizard')),
  nimble:     lazy(() => import('../components/character/wizards/NimbleWizard')),
}

export default function CharacterPage() {
  const { id }                          = useParams()
  const [searchParams]                  = useSearchParams()
  const navigate                        = useNavigate()
  const { user }                        = useAuth()
  const isNew                           = id === 'new'
  const readOnly                        = searchParams.get('readOnly') === 'true'
  const system                          = searchParams.get('system')
  const campaignId                      = searchParams.get('campaignId')

  const [character, setCharacter]       = useState(null)
  const [loading, setLoading]           = useState(!isNew)
  const [error, setError]               = useState('')
  const [saveStatus, setSaveStatus]     = useState('')
  const [creating, setCreating]         = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  // Load existing character
  useEffect(() => {
    if (isNew) return
    api.get(`/characters/${id}`)
      .then(({ character }) => setCharacter(character))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // Called by wizard when all steps are complete
  async function handleWizardComplete(sheetData) {
    setCreating(true)
    try {
      const { character } = await api.post('/characters', {
        characterName: sheetData.name || 'Unnamed',
        gameSystem:    system,
        campaignId:    campaignId || undefined,
        sheetData,
      })
      navigate(`/characters/${character.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  async function handleSave(sheetData) {
    setSaveStatus('saving')
    try {
      const updated = await api.patch(`/characters/${character.id}`, { sheetData })
      setCharacter(updated.character)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (err) {
      setSaveStatus('error')
      console.error('Auto-save failed:', err)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/characters/${character.id}`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setDeleting(false)
      setShowDeleteModal(false)
      setError(err.message)
    }
  }

  const SheetComponent  = SHEETS[character?.game_system || system]
  const WizardComponent = WIZARDS[system]
  const isOwner         = character && user && character.user_id === user.id
  // Backend includes viewer_is_gm so we don't need a separate campaign fetch
  const isGM            = character?.viewer_is_gm === true && !isOwner

  return (
    <div className="min-h-screen bg-codex-bg">
      {/* Nav */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
          {saveStatus === 'saving' && <span className="text-xs text-codex-muted animate-pulse">Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-xs text-emerald-400">Saved ✓</span>}
          {saveStatus === 'error'  && <span className="text-xs text-red-400">Save failed</span>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to={campaignId ? `/campaigns/${campaignId}` : '/dashboard'}
          className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        {/* ── New character: run the wizard ── */}
        {isNew && (
          <>
            {!system && (
              <div className="text-center text-red-400 py-24">
                No game system selected. <Link to="/dashboard" className="underline">Go back to Dashboard.</Link>
              </div>
            )}

            {system && !WizardComponent && (
              <div className="text-center text-red-400 py-24">
                Unknown game system: {system}
              </div>
            )}

            {system && WizardComponent && !creating && (
              <Suspense fallback={<WizardSkeleton />}>
                <WizardComponent
                  onComplete={handleWizardComplete}
                  onCancel={() => navigate(campaignId ? `/campaigns/${campaignId}` : '/dashboard')}
                />
              </Suspense>
            )}

            {creating && (
              <div className="text-center text-codex-muted animate-pulse py-24">
                Forging your character…
              </div>
            )}

            {error && (
              <p className="text-center text-red-400 mt-4">{error}</p>
            )}
          </>
        )}

        {/* ── Loading existing character ── */}
        {loading && !isNew && (
          <div className="text-center text-codex-muted animate-pulse py-24">Loading character sheet…</div>
        )}

        {/* ── Error loading ── */}
        {error && !isNew && (
          <div className="text-center text-red-400 py-24">{error}</div>
        )}

        {/* ── GM access banner ── */}
        {isGM && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl
            bg-codex-gold/5 border border-codex-gold/20 text-sm">
            <span className="text-codex-gold mt-0.5">⚔️</span>
            <div>
              <p className="text-codex-text font-medium">Game Master View</p>
              <p className="text-xs text-codex-subtext mt-0.5">
                You are editing <span className="text-codex-text font-medium">{character.owner_username}'s</span> sheet
                as the campaign GM. Changes save immediately and are visible to the player.
                Portrait changes are restricted to the player.
              </p>
            </div>
          </div>
        )}

        {/* ── Existing character sheet ── */}
        {character && SheetComponent && (
          <Suspense fallback={<div className="text-center text-codex-muted animate-pulse py-24">Loading sheet…</div>}>
            <SheetComponent
              character={character}
              onSave={handleSave}
              readOnly={readOnly || (!isOwner && !isGM)}
            />
          </Suspense>
        )}

        {character && !SheetComponent && (
          <div className="text-center text-red-400 py-24">
            Unknown game system: {character.game_system}
          </div>
        )}

        {/* ── Danger Zone — only visible to owner, not on new/wizard flow ── */}
        {character && isOwner && !readOnly && (
          <div className="mt-16 border-t border-codex-border pt-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-codex-muted mb-1">
                  Danger Zone
                </p>
                <p className="text-sm text-codex-subtext">
                  Permanently delete this character sheet. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-lg
                  border border-codex-border bg-codex-surface
                  text-sm text-codex-muted hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5
                  transition-all duration-150"
              >
                <Trash2 size={14} />
                Delete character
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && character && (
        <DeleteConfirmModal
          characterName={character.character_name}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({ characterName, deleting, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const confirmed = typed === characterName

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !deleting) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleting, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onCancel() }}
    >
      <div className="relative w-full max-w-md bg-codex-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
        {/* Red top stripe */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <Trash2 size={16} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-codex-text">Delete character?</h2>
              <p className="text-xs text-codex-subtext mt-0.5">This action is permanent and irreversible.</p>
            </div>
          </div>
          {!deleting && (
            <button onClick={onCancel}
              className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface ml-2">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <p className="text-sm text-codex-subtext leading-relaxed">
            You are about to permanently delete{' '}
            <span className="font-semibold text-codex-text">{characterName}</span>.
            All sheet data, stats, and gear will be lost forever.
          </p>

          {/* Name confirmation input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-codex-subtext">
              Type <span className="font-mono text-codex-text bg-codex-surface rounded px-1.5 py-0.5">{characterName}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              disabled={deleting}
              placeholder={characterName}
              autoFocus
              className="w-full bg-codex-surface border border-codex-border rounded-lg
                px-4 py-2.5 text-sm text-codex-text placeholder-codex-muted
                focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20
                transition-colors disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm
                hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!confirmed || deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm
                transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  Delete forever
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WizardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-codex-card border border-codex-border rounded-2xl p-8 animate-pulse">
        <div className="h-4 bg-codex-surface rounded w-1/3 mb-6" />
        <div className="h-8 bg-codex-surface rounded w-2/3 mb-3" />
        <div className="h-4 bg-codex-surface rounded w-full mb-2" />
        <div className="h-4 bg-codex-surface rounded w-4/5" />
      </div>
    </div>
  )
}
