/**
 * EncounterPickerModal
 *
 * Shown when the GM clicks "Start Encounter" on the campaign page.
 * Three tabs:
 *   Library  — saved encounters for this game system (cross-campaign)
 *   Blank    — start combat with just the party (no pre-loaded monsters)
 *
 * On selection, calls onStart({ encounterId?, encounterName?, blank })
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { X, Sword, Plus, Library, ExternalLink, Search, ChevronRight } from 'lucide-react'
import { api } from '../../utils/api'

const SYSTEM_META = {
  shadowdark: { label: 'Shadowdark', badge: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  morkborg:   { label: 'Mörk Borg',  badge: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

export default function EncounterPickerModal({ campaignId, gameSystem, onStart, onClose }) {
  const [tab,          setTab]          = useState('library')
  const [encounters,   setEncounters]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [starting,     setStarting]     = useState(false)
  const [startError,   setStartError]   = useState('')  // shown as red banner
  const [loadFailed,   setLoadFailed]   = useState(false) // silent load failure

  const sysMeta = SYSTEM_META[gameSystem] ?? SYSTEM_META.shadowdark

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const { encounters: list } = await api.get(`/encounters?system=${gameSystem}`)
      setEncounters(list)
    } catch {
      // Silently fail — treat as empty list so the UI stays clean.
      // Most common cause: backend hasn't been restarted after a deploy.
      setEncounters([])
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [gameSystem])

  useEffect(() => { load() }, [load])

  async function handleSelect(enc) {
    setStarting(true)
    setStartError('')
    try {
      await onStart({ encounterId: enc.id, encounterName: enc.name })
    } catch (err) {
      setStartError(err.message)
      setStarting(false)
    }
  }

  async function handleBlank() {
    setStarting(true)
    setStartError('')
    try {
      await onStart({ blank: true })
    } catch (err) {
      setStartError(err.message)
      setStarting(false)
    }
  }

  const visible = encounters.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.tags ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !starting) onClose() }}
    >
      <div className="relative w-full max-w-lg bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-codex-border shrink-0">
          <div className="flex items-center gap-2">
            <Sword size={15} className="text-codex-gold" />
            <h3 className="text-sm font-semibold text-codex-text">Start Encounter</h3>
            <span className={`text-[10px] border rounded-full px-2 py-0.5 ${sysMeta.badge}`}>
              {sysMeta.label}
            </span>
          </div>
          {!starting && (
            <button
              onClick={onClose}
              className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-codex-border shrink-0">
          <button
            onClick={() => setTab('library')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'library'
                ? 'border-codex-gold text-codex-gold'
                : 'border-transparent text-codex-subtext hover:text-codex-text'
            }`}
          >
            <Library size={12} /> Encounter Library
          </button>
          <button
            onClick={() => setTab('blank')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'blank'
                ? 'border-codex-gold text-codex-gold'
                : 'border-transparent text-codex-subtext hover:text-codex-text'
            }`}
          >
            <Plus size={12} /> Blank Encounter
          </button>
        </div>

        {/* Start error only — load failures are handled silently in the empty state */}
        {startError && (
          <div className="mx-4 mt-3 text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2 shrink-0">
            {startError}
          </div>
        )}

        {/* Library tab */}
        {tab === 'library' && (
          <>
            {/* Search */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-codex-muted pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search encounters…"
                  autoFocus
                  className="w-full bg-codex-surface border border-codex-border rounded-lg pl-9 pr-3 py-2 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 transition-colors"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {loading ? (
                <div className="text-center text-codex-muted animate-pulse py-8 text-sm">Loading…</div>
              ) : visible.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-codex-subtext mb-3">
                    {search
                      ? 'No encounters match your search.'
                      : `No ${sysMeta.label} encounters saved yet.`}
                  </p>
                  {!search && (
                    <Link
                      to={`/encounters/new?system=${gameSystem}&campaignId=${campaignId}&from=campaign`}
                      className="inline-flex items-center gap-1.5 text-xs text-codex-gold hover:text-codex-goldHover transition-colors"
                      onClick={onClose}
                    >
                      <Plus size={12} /> Create your first encounter
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {visible.map(enc => (
                    <button
                      key={enc.id}
                      disabled={starting}
                      onClick={() => handleSelect(enc)}
                      className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl hover:bg-codex-surface border border-transparent hover:border-codex-gold/30 transition-all text-left group disabled:opacity-40"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-codex-text group-hover:text-codex-gold transition-colors">
                          {enc.name}
                        </p>
                        <p className="text-xs text-codex-muted mt-0.5">
                          {enc.monster_count ?? 0} monster type{enc.monster_count !== 1 ? 's' : ''}
                          {enc.tags ? ` · ${enc.tags}` : ''}
                          {enc.times_used > 0 ? ` · Used ${enc.times_used}×` : ''}
                        </p>
                      </div>
                      {starting
                        ? <span className="w-4 h-4 border-2 border-codex-gold/30 border-t-codex-gold rounded-full animate-spin shrink-0" />
                        : <ChevronRight size={14} className="text-codex-muted group-hover:text-codex-gold transition-colors shrink-0" />
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-codex-border shrink-0 flex items-center justify-between">
              <Link
                to={`/encounters/new?system=${gameSystem}&campaignId=${campaignId}&from=campaign`}
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs text-codex-muted hover:text-codex-subtext transition-colors"
              >
                <ExternalLink size={11} /> Build new encounter
              </Link>
              <span className="text-xs text-codex-muted">
                {visible.length} encounter{visible.length !== 1 ? 's' : ''}
              </span>
            </div>
          </>
        )}

        {/* Blank tab */}
        {tab === 'blank' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10">
            <div className="w-14 h-14 rounded-full bg-codex-surface border border-codex-border flex items-center justify-center">
              <Sword size={22} className="text-codex-subtext" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-codex-text mb-1">Start a Blank Encounter</p>
              <p className="text-xs text-codex-subtext leading-relaxed max-w-xs">
                Loads the party roster and lets you add monsters on the fly during combat.
                Good for quick or improvised encounters.
              </p>
            </div>
            <button
              onClick={handleBlank}
              disabled={starting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 text-sm font-medium transition-all disabled:opacity-50"
            >
              {starting
                ? <span className="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                : <Sword size={14} />
              }
              Start Combat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
