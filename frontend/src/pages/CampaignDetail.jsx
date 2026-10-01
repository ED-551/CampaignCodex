import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Sword, Plus, BookOpen, X, MessageSquare, Send, Eye, EyeOff, Users, Crown, UserPlus, Settings, Flame, Map } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Helmet } from 'react-helmet-async'
import { useSocket } from '../context/SocketContext'
import { useDM } from '../context/DMContext'
import { api } from '../utils/api'
import PageShell from '../components/layout/PageShell'
import MiniCombatTracker from '../components/combat/MiniCombatTracker'
import EncounterPickerModal from '../components/combat/EncounterPickerModal'
import DiceRollBubble from '../components/chat/DiceRollBubble'
import TierBadge from '../components/ui/TierBadge'
import { parseDiceCommand, rollDice, buildDiceMetadata, formatDiceBody } from '../utils/dice'
import { VTT_ENABLED } from '../utils/runtimeConfig'

function formatLightTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const GAME_STYLE = {
  shadowdark: { label: 'Shadowdark',  accent: '#c9a84c', badge: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  morkborg:   { label: 'Mörk Borg',   accent: '#d4d400', badge: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/30' },
  nimble:     { label: 'Nimble RPG',  accent: '#4a8c5c', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
}

export default function CampaignDetail() {
  const { id }                      = useParams()
  const { user }                    = useAuth()
  const navigate                    = useNavigate()
  const [campaign, setCampaign]     = useState(null)
  const [members, setMembers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [copied, setCopied]         = useState(false)
  const [error, setError]           = useState('')
  const [userTierMap, setUserTierMap] = useState({}) // { userId: { tier, isAdmin } }

  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteLoading,  setInviteLoading]  = useState(false)
  const [inviteError,    setInviteError]    = useState('')
  const [inviteSuccess,  setInviteSuccess]  = useState('')
  const [showInvite,     setShowInvite]     = useState(false)

  const [gmCharacter,       setGmCharacter]       = useState(null)
  const [showCharPicker,    setShowCharPicker]    = useState(false)
  const [myCharacters,      setMyCharacters]      = useState([])
  const [charPickerLoading, setCharPickerLoading] = useState(false)
  const [charPickerError,   setCharPickerError]   = useState('')

  // Combat tracker
  const [combatActive,  setCombatActive]  = useState(false)
  const [showPicker,    setShowPicker]    = useState(false)
  const [startError,    setStartError]    = useState('')
  const combatTrackerRef = useRef(null)

  // VTT session state
  const [vttSessionActive, setVttSessionActive] = useState(false)

  const { socket, connected } = useSocket()

  useEffect(() => {
    // cancelled flag prevents stale fetch results from writing to state after
    // the component unmounts or the campaign `id` changes (e.g. browser back/forward).
    // Without this guard, navigating away before the request resolves causes a
    // React DEV warning and could overwrite a new campaign's data with old data.
    let cancelled = false

    api.get(`/campaigns/${id}`)
      .then(({ campaign, members }) => {
        if (cancelled) return
        setCampaign(campaign)
        setMembers(members)
        setGmCharacter(campaign.gm_character_id ? {
          id:             campaign.gm_character_id,
          character_name: campaign.gm_character_name,
          portrait_url:   campaign.gm_portrait_url,
        } : null)

        // Build tier map from members + GM for use in chat badges
        const tierMap = {}
        if (members) {
          members.forEach(m => {
            if (m.user_id) {
              tierMap[m.user_id] = {
                tier:    m.supporter_tier ?? 'free',
                isAdmin: m.is_admin       ?? false,
              }
            }
          })
        }
        // Include GM tier if provided
        if (campaign.gm_user_id && campaign.gm_supporter_tier) {
          tierMap[campaign.gm_user_id] = {
            tier:    campaign.gm_supporter_tier,
            isAdmin: campaign.gm_is_admin ?? false,
          }
        }
        setUserTierMap(tierMap)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id])

  // ── VTT session state: initial poll + socket listener ────────────────────────
  useEffect(() => {
    if (!VTT_ENABLED) return
    let cancelled = false
    api.get(`/vtt/${id}/session`)
      .then(({ active }) => { if (!cancelled) setVttSessionActive(active) })
      .catch(() => {}) // non-critical — fail silently
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!socket || !connected) return
    function handleSessionStarted({ campaignId }) {
      if (campaignId === id) setVttSessionActive(true)
    }
    function handleSessionEnded({ campaignId }) {
      if (campaignId === id) setVttSessionActive(false)
    }
    socket.on('vtt:session_started', handleSessionStarted)
    socket.on('vtt:session_ended',   handleSessionEnded)
    return () => {
      socket.off('vtt:session_started', handleSessionStarted)
      socket.off('vtt:session_ended',   handleSessionEnded)
    }
  }, [socket, connected, id])

  function copyCode() {
    navigator.clipboard.writeText(campaign.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <PageShell><div className="text-center text-codex-muted animate-pulse py-24">Loading campaign…</div></PageShell>
  if (error)   return <PageShell><div className="text-center text-red-400 py-24">{error}</div></PageShell>
  if (!campaign) return null

  const isGM      = campaign.gm_user_id === user?.id
  const style     = GAME_STYLE[campaign.game_system] ?? GAME_STYLE.shadowdark
  const myMember  = members.find(m => m.user_id === user?.id && !m.left_at)
  const activeMembers = members.filter(m => !m.left_at)
  const formerMembers = members.filter(m => m.left_at)

  async function dismissFormerMember(memberId) {
    try {
      await api.delete(`/campaigns/${id}/members/${memberId}`)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err) {
      console.error('Failed to dismiss member:', err)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteUsername.trim()) return
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      const { member } = await api.post(`/campaigns/${id}/invite`, { username: inviteUsername.trim() })
      setMembers(prev => [...prev, member])
      setInviteSuccess(`${member.username} has been added to the campaign.`)
      setInviteUsername('')
      setTimeout(() => setInviteSuccess(''), 3000)
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleOpenCharPicker() {
    setShowCharPicker(true)
    setCharPickerLoading(true)
    setCharPickerError('')
    try {
      const { characters } = await api.get('/characters')
      setMyCharacters(characters.filter(c => c.game_system === campaign.game_system))
    } catch {
      setCharPickerError('Failed to load characters.')
    } finally {
      setCharPickerLoading(false)
    }
  }

  async function handleSetGMCharacter(characterId) {
    try {
      const { gm_character: updated } = await api.patch(`/campaigns/${id}/gm-character`, { characterId })
      setGmCharacter(updated)
      setShowCharPicker(false)
    } catch (err) {
      setCharPickerError(err.message)
    }
  }

  async function handleSetPlayerCharacter(characterId) {
    try {
      const { character: updated } = await api.patch(`/campaigns/${id}/my-character`, { characterId })
      // Update the local members list so myMember reflects the new character
      setMembers(prev => prev.map(m =>
        m.user_id === user?.id && !m.left_at
          ? { ...m, character_id: updated?.id ?? null, character_name: updated?.character_name ?? null, portrait_url: updated?.portrait_url ?? null }
          : m
      ))
      setShowCharPicker(false)
    } catch (err) {
      setCharPickerError(err.message)
    }
  }

  async function handleRemoveGMCharacter() {
    try {
      await api.patch(`/campaigns/${id}/gm-character`, { characterId: null })
      setGmCharacter(null)
    } catch (err) {
      console.error('Failed to remove GM character:', err)
    }
  }

  // ── Combat start handler ─────────────────────────────────────────────────────
  // Called by EncounterPickerModal.  Delegates to the mounted CombatTracker
  // via its imperative handle (which handles API call + socket broadcast).
  async function handleStartCombat(opts) {
    setStartError('')
    try {
      await combatTrackerRef.current?.startCombat(opts)
      setShowPicker(false)
    } catch (err) {
      setStartError(err.message)
      throw err // re-throw so the picker modal can show a spinner reset
    }
  }

  return (
    <PageShell>
      <Helmet><title>{campaign?.name ? `${campaign.name} — CampaignCodex` : 'Campaign — CampaignCodex'}</title></Helmet>
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors mb-6">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-codex-text">{campaign.name}</h1>
              <span className={`text-xs border rounded-full px-2.5 py-0.5 ${style.badge}`}>
                {style.label}
              </span>
              {isGM && <span className="text-xs text-codex-subtext border border-codex-border rounded-full px-2.5 py-0.5">⚔️ Game Master</span>}
            </div>
            {campaign.description && (
              <p className="text-sm text-codex-subtext max-w-xl">{campaign.description}</p>
            )}
            {isGM && (
              <Link
                to={`/campaigns/${id}/settings`}
                className="inline-flex items-center gap-1 text-xs text-codex-muted hover:text-codex-subtext hover:underline transition-colors w-fit"
              >
                <Settings size={11} /> Campaign Settings & Info
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2 items-stretch sm:items-end shrink-0 w-full sm:w-auto">
            {isGM && (
              <div className="flex items-center justify-between sm:justify-start gap-2 bg-codex-surface border border-codex-border rounded-lg px-3 py-2">
                <span className="text-xs text-codex-subtext">Join code</span>
                <span className="font-mono font-semibold text-codex-text tracking-widest text-sm">
                  {campaign.join_code}
                </span>
                <button onClick={copyCode} className="text-codex-muted hover:text-codex-gold transition-colors ml-1">
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {isGM && (
                <button
                  onClick={() => navigate(`/encounters/new?system=${campaign.game_system}&campaignId=${id}&from=campaign`)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-surface border border-codex-border text-codex-subtext hover:border-codex-gold/50 hover:text-codex-text transition-all"
                >
                  <Plus size={14} /> Make Encounter
                </button>
              )}
              {isGM && (
                <button
                  onClick={() => { setShowPicker(true); setStartError('') }}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 transition-all"
                >
                  <Sword size={14} /> {combatActive ? 'Combat Live ⚔' : 'Start Combat'}
                </button>
              )}
              {VTT_ENABLED && (
                <Link
                  to={`/vtt/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-surface border border-codex-border text-codex-subtext hover:border-codex-gold/50 hover:text-codex-text transition-all"
                >
                  <Map size={14} /> Launch VTT
                </Link>
              )}
              {!isGM && !myMember?.character_id && (
                <button
                  onClick={handleOpenCharPicker}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all"
                >
                  <Plus size={14} /> Add My Character
                </button>
              )}
              {!isGM && myMember?.character_id && (
                <button
                  onClick={() => navigate(`/characters/${myMember.character_id}`)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-codex-surface border border-codex-border text-codex-text hover:border-codex-gold transition-all"
                >
                  <BookOpen size={14} /> My Character Sheet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-codex-border" />

      {/* VTT Session Live Banner */}
      {VTT_ENABLED && vttSessionActive && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          {!isGM ? (
            <a
              href={`/vtt/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-fit px-5 py-2.5 rounded-xl bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400/70 transition-all text-sm font-semibold shadow-lg shadow-emerald-900/20"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              VTT Session Live — Join
            </a>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              VTT session is live
            </div>
          )}
        </div>
      )}

      {/* Player Roster */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Active Members */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-codex-text">
              Party Roster
              <span className="ml-2 text-codex-subtext font-normal text-sm">
                {activeMembers.length + (gmCharacter ? 1 : 0)} / {isGM ? (user?.campaignLimit ?? 6) : '?'} heroes
              </span>
            </h2>
            {isGM && (
              <div className="flex items-center gap-2">
                {/* My Character — compact chip when set, quiet button when not */}
                {gmCharacter ? (
                  <div className="flex items-center gap-1.5 text-xs border border-codex-gold/30 bg-codex-gold/5 rounded-lg px-2 py-1.5 group">
                    <Crown size={11} className="text-codex-gold/70 flex-shrink-0" />
                    <button
                      onClick={() => navigate(`/characters/${gmCharacter.id}?campaignId=${id}`)}
                      className="text-codex-gold/80 hover:text-codex-gold transition-colors max-w-[90px] truncate"
                      title={gmCharacter.character_name}
                    >
                      {gmCharacter.character_name}
                    </button>
                    <button
                      onClick={handleRemoveGMCharacter}
                      className="text-codex-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Remove character"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleOpenCharPicker}
                    className="flex items-center gap-1.5 text-xs text-codex-subtext hover:text-codex-text border border-codex-border hover:border-codex-gold/50 rounded-lg px-2.5 py-1.5 transition-all"
                    title="Play a character as GM"
                  >
                    <Crown size={12} /> My Character
                  </button>
                )}

                {/* Invite Player */}
                <button
                  onClick={() => { setShowInvite(v => !v); setInviteError(''); setInviteSuccess('') }}
                  className="flex items-center gap-1.5 text-xs text-codex-subtext hover:text-codex-text border border-codex-border hover:border-codex-gold/50 rounded-lg px-2.5 py-1.5 transition-all"
                >
                  <UserPlus size={12} /> Invite Player
                </button>
              </div>
            )}
          </div>

          {isGM && showInvite && (
            <form onSubmit={handleInvite} className="mb-4 flex items-center gap-2 p-3 bg-codex-surface border border-codex-border rounded-xl">
              <input
                type="text"
                value={inviteUsername}
                onChange={e => { setInviteUsername(e.target.value); setInviteError('') }}
                placeholder="Enter username…"
                disabled={inviteLoading}
                autoFocus
                className="flex-1 bg-codex-bg border border-codex-border rounded-lg px-3 py-1.5 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 transition-colors disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={inviteLoading || !inviteUsername.trim()}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-codex-gold text-codex-bg hover:bg-codex-goldHover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {inviteLoading
                  ? <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin block" />
                  : <UserPlus size={13} />}
                Add
              </button>
            </form>
          )}
          {inviteError   && <p className="text-xs text-red-400 mb-3 -mt-1 pl-1">{inviteError}</p>}
          {inviteSuccess && <p className="text-xs text-emerald-400 mb-3 -mt-1 pl-1">{inviteSuccess}</p>}

          {activeMembers.length === 0 && !(isGM && gmCharacter) ? (
            <div className="border border-dashed border-codex-border rounded-xl p-12 text-center">
              <p className="text-codex-subtext text-sm">No players have joined yet.</p>
              {isGM && (
                <p className="text-codex-muted text-xs mt-2">
                  Invite players by username or share the join code{' '}
                  <span className="font-mono text-codex-text">{campaign.join_code}</span>.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* GM's own character — shown first when set */}
              {isGM && gmCharacter && (
                <PlayerCard
                  key="gm-character"
                  member={{
                    id:             'gm-character',
                    user_id:        campaign.gm_user_id,
                    character_id:   gmCharacter.id,
                    character_name: gmCharacter.character_name,
                    portrait_url:   gmCharacter.portrait_url,
                    username:       user?.username,
                  }}
                  isGM={isGM}
                  gameSystem={campaign.game_system}
                  currentUserId={user?.id}
                  isGMEntry
                  onClick={() => navigate(`/characters/${gmCharacter.id}?campaignId=${id}`)}
                />
              )}
              {activeMembers.map(m => (
                <PlayerCard
                  key={m.id}
                  member={m}
                  isGM={isGM}
                  gameSystem={campaign.game_system}
                  currentUserId={user?.id}
                  onClick={isGM && m.character_id
                    ? () => navigate(`/characters/${m.character_id}?campaignId=${id}`)
                    : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Former Members — shown to GM only when someone has left */}
        {isGM && formerMembers.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-codex-subtext mb-4">
              Former Members
              <span className="ml-2 text-codex-muted font-normal text-xs">(left the campaign — click to dismiss)</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {formerMembers.map(m => (
                <FormerMemberCard
                  key={m.id}
                  member={m}
                  onDismiss={() => dismissFormerMember(m.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Campaign Chat + Combat Tracker ── */}
        {/* CombatTracker is ALWAYS mounted (never unmounts) so its socket               */}
        {/* subscription survives the transition from inactive → active state.            */}
        {/* When inactive: container collapses to 0 width — tracker is in DOM, invisible. */}
        <div className="flex gap-4 items-start">
          {/* Chat — full width when no combat, flex-1 when combat is live */}
          <div className={combatActive ? 'flex-1 min-w-0' : 'w-full'}>
            <CampaignChat campaignId={id} isGM={isGM} gameSystem={campaign.game_system} userTierMap={userTierMap} />
          </div>
          {/* Combat Tracker — collapses to 0 width when inactive, avoids unmount */}
          <div
            className={`shrink-0 overflow-hidden transition-all duration-300 ${combatActive ? 'w-80' : 'w-0'}`}
            style={{ height: '520px' }}
          >
            <div className="w-80 h-full">
              <MiniCombatTracker
                ref={combatTrackerRef}
                campaignId={id}
                isGM={isGM}
                gameSystem={campaign.game_system}
                onActiveChange={(active) => setCombatActive(active)}
              />
            </div>
          </div>
        </div>

      </div>

      {/* ── Encounter Picker Modal (Start Combat) ── */}
      {showPicker && (
        <EncounterPickerModal
          campaignId={id}
          gameSystem={campaign.game_system}
          onStart={handleStartCombat}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* ── Character Picker Modal (GM sets their character; players link theirs) ── */}
      {showCharPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowCharPicker(false) }}
        >
          <div className="relative w-full max-w-md bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-codex-gold/10 border border-codex-gold/30 flex items-center justify-center">
                  <Crown size={16} className="text-codex-gold" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-codex-text">Play a Character</h2>
                  <p className="text-xs text-codex-subtext mt-0.5">
                    Choose one of your {style.label} characters
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCharPicker(false)}
                className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 pb-6 flex flex-col gap-3">
              {charPickerLoading ? (
                <div className="text-center py-8 text-codex-muted text-sm animate-pulse">
                  Loading characters…
                </div>
              ) : charPickerError ? (
                <p className="text-sm text-red-400 text-center py-4">{charPickerError}</p>
              ) : myCharacters.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-codex-subtext mb-4">
                    You have no {style.label} characters yet.
                  </p>
                  <button
                    onClick={() => {
                      setShowCharPicker(false)
                      navigate(`/characters/new?system=${campaign.game_system}&campaignId=${id}`)
                    }}
                    className="flex items-center gap-1.5 text-sm text-codex-gold hover:text-codex-goldHover transition-colors mx-auto"
                  >
                    <Plus size={14} /> Create a new character
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                    {myCharacters.map(char => (
                      <button
                        key={char.id}
                        onClick={() => isGM ? handleSetGMCharacter(char.id) : handleSetPlayerCharacter(char.id)}
                        className="flex flex-col items-center gap-2 p-3 bg-codex-surface border border-codex-border rounded-xl hover:border-codex-gold/50 hover:bg-codex-card transition-all"
                      >
                        <div className="w-12 h-12 rounded-full bg-codex-bg border border-codex-border overflow-hidden flex items-center justify-center">
                          {char.portrait_url
                            ? <img src={char.portrait_url} alt={char.character_name} className="w-full h-full object-cover" />
                            : <DefaultPortrait system={campaign.game_system} />}
                        </div>
                        <span className="text-xs font-semibold text-codex-text text-center leading-tight line-clamp-2">
                          {char.character_name}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setShowCharPicker(false)
                      navigate(`/characters/new?system=${campaign.game_system}&campaignId=${id}`)
                    }}
                    className="text-xs text-codex-subtext hover:text-codex-gold transition-colors text-center mt-1"
                  >
                    + Create a new character instead
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}


function PlayerCard({ member, isGM, gameSystem, currentUserId, onClick, isGMEntry = false }) {
  const { openDM } = useDM()
  const isMe = member.user_id === currentUserId

  return (
    <div className={`relative flex flex-col items-center gap-2 p-4 bg-codex-surface border rounded-xl transition-all duration-150 group ${isGMEntry ? 'border-codex-gold/25' : 'border-codex-border'}`}>
      {/* Clickable overlay for sheet navigation */}
      {onClick && (
        <div
          onClick={onClick}
          className="absolute inset-0 rounded-xl cursor-pointer hover:border-codex-gold hover:bg-codex-card/40 z-0 transition-all"
        />
      )}

      {/* Crown badge — GM entry only */}
      {isGMEntry && (
        <div className="absolute top-2 left-2 z-10 w-4 h-4 rounded-full bg-codex-gold/20 border border-codex-gold/40 flex items-center justify-center">
          <Crown size={8} className="text-codex-gold" />
        </div>
      )}

      {/* Portrait */}
      <div className={`relative z-10 w-16 h-16 rounded-full bg-codex-bg border-2 overflow-hidden flex items-center justify-center ${isGMEntry ? 'border-codex-gold/30' : 'border-codex-border'}`}>
        {member.portrait_url ? (
          <img src={member.portrait_url} alt={member.character_name} className="w-full h-full object-cover" />
        ) : (
          <DefaultPortrait system={gameSystem} />
        )}
      </div>

      {/* Character name + username */}
      <div className="relative z-10 text-center">
        <p className={`text-sm font-semibold text-codex-text leading-tight ${onClick ? 'group-hover:text-codex-gold transition-colors' : ''}`}>
          {member.character_name || '—'}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <p className="text-xs text-codex-muted">{member.username}</p>
          <TierBadge tier={member.supporter_tier ?? 'free'} size={11} />
        </div>
      </div>

      {!member.character_id && (
        <span className="relative z-10 text-xs text-codex-muted italic">No sheet yet</span>
      )}

      {/* DM button — appears on hover, hidden for self */}
      {!isMe && (
        <button
          onClick={e => { e.stopPropagation(); openDM(member.user_id, member.username) }}
          className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity
            flex items-center gap-1 text-[10px] text-codex-subtext hover:text-codex-gold
            border border-codex-border hover:border-codex-gold/50 rounded-full px-2 py-0.5
            bg-codex-bg hover:bg-codex-surface"
          title={`DM ${member.username}`}
        >
          <MessageSquare size={9} /> DM
        </button>
      )}
    </div>
  )
}

function FormerMemberCard({ member, onDismiss }) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismiss() {
    if (dismissing) return
    setDismissing(true)
    await onDismiss()
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={dismissing}
      title="Click to dismiss from your view"
      className="relative flex flex-col items-center gap-2 p-4 bg-codex-surface/40 border border-dashed border-codex-border/50 rounded-xl transition-all duration-150 hover:border-red-500/30 hover:bg-red-500/5 group opacity-60 hover:opacity-100 disabled:opacity-30"
    >
      <div className="w-16 h-16 rounded-full bg-codex-bg border-2 border-codex-border/50 overflow-hidden flex items-center justify-center grayscale">
        {member.portrait_url ? (
          <img src={member.portrait_url} alt={member.character_name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl opacity-40">👤</span>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-codex-muted leading-tight line-through">
          {member.character_name || '—'}
        </p>
        <p className="text-xs text-codex-muted mt-0.5">{member.username}</p>
        <p className="text-[10px] text-red-400/70 mt-1">Left campaign</p>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={12} className="text-codex-muted" />
      </div>
    </button>
  )
}

function DefaultPortrait({ system }) {
  const icons = { shadowdark: '⚔️', morkborg: '💀', nimble: '🛡️' }
  return <span className="text-2xl">{icons[system] ?? '🎲'}</span>
}

// ─── Campaign Chat ────────────────────────────────────────────────────────────
// Real-time chat panel scoped to a single campaign room.
// Supports spectator mode: GM can open the session to public viewers,
// with a per-player consent flow and 60-second timeout.
function CampaignChat({ campaignId, isGM, gameSystem, userTierMap = {} }) {
  const { user }              = useAuth()
  const { socket, connected } = useSocket()

  const isSD = gameSystem === 'shadowdark'

  // Core chat state
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [chatError, setChatError] = useState('')
  const [sending, setSending]     = useState(false)
  const [joined, setJoined]       = useState(false)

  // Spectator mode state
  // spectatorStatus: null | 'pending' | 'active'
  const [spectatorStatus, setSpectatorStatus]       = useState(null)
  const [spectatorCount,  setSpectatorCount]         = useState(0)
  // GM-side: how many consents have been received
  const [consentProgress, setConsentProgress]       = useState(null) // { accepted, total }
  // Player-side: consent prompt sent by GM
  const [consentPending,  setConsentPending]         = useState(null) // { campaignId, campaignName, gmUsername, timeoutSecs }
  const [consentCountdown, setConsentCountdown]      = useState(0)
  const [lateJoinBanner,  setLateJoinBanner]         = useState(false)
  const [spectatorAction, setSpectatorAction]        = useState(false) // loading state for GM buttons

  // Torch timer (Shadowdark only) — campaign-scoped, persists outside combat
  // expiresAt is a UTC ISO string stored in the DB; remaining is computed live.
  const [lightExpiresAt,  setLightExpiresAt]  = useState(null)   // ISO string | null
  const [lightPausedSecs, setLightPausedSecs] = useState(3600)   // secs when paused
  const [lightDisplay,    setLightDisplay]    = useState(3600)   // rendered countdown
  // Derived from the live countdown so it flips false the instant the timer hits
  // zero — not just at the next re-render from an inline Date comparison.
  const lightRunning = Boolean(lightExpiresAt) && lightDisplay > 0

  const bottomRef          = useRef(null)
  const scrollContainerRef = useRef(null)
  const didScrollRef       = useRef(false)
  const inputRef           = useRef(null)
  const countdownInterval  = useRef(null)

  // ── Join room + listen for messages ────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected) return

    setJoined(false)
    setMessages([])
    setChatError('')
    setSpectatorStatus(null)
    setConsentPending(null)
    setLateJoinBanner(false)
    setSpectatorCount(0)
    setLightExpiresAt(null)
    setLightPausedSecs(3600)

    socket.emit('join_campaign', { campaignId }, ({ messages: history, spectatorModeActive, lightTimerExpiresAt, lightTimerRemaining, error }) => {
      if (error) { setChatError(error); return }
      setMessages((history ?? []).slice(-200))
      setJoined(true)
      if (spectatorModeActive) {
        setSpectatorStatus('active')
        setLateJoinBanner(true)
      }
      // Hydrate torch timer from DB state
      setLightExpiresAt(lightTimerExpiresAt ?? null)
      setLightPausedSecs(lightTimerRemaining ?? 3600)
    })

    // ── Incoming messages ──────────────────────────────────────────────────
    function handleNewMessage(msg) {
      setMessages(prev => [...prev, msg].slice(-200))
    }

    // ── Spectator: GM receives consent progress updates ────────────────────
    function handleConsentUpdate({ accepted, total }) {
      setConsentProgress({ accepted, total })
    }

    // ── Spectator: all players accepted → mode is live ────────────────────
    function handleSpectatorActive({ campaignId: cid }) {
      if (cid !== campaignId) return
      setSpectatorStatus('active')
      setConsentProgress(null)
      setConsentPending(null)
      clearInterval(countdownInterval.current)
    }

    // ── Spectator: a player declined or GM cancelled ───────────────────────
    function handleSpectatorCancelled({ campaignId: cid, reason }) {
      if (cid !== campaignId) return
      setSpectatorStatus(null)
      setConsentProgress(null)
      setConsentPending(null)
      clearInterval(countdownInterval.current)
      setChatError(reason ? `Spectator mode cancelled: ${reason}` : 'Spectator mode cancelled.')
    }

    // ── Spectator: GM closed the session ──────────────────────────────────
    function handleSpectatorEnded({ campaignId: cid }) {
      if (cid !== campaignId) return
      setSpectatorStatus(null)
      setSpectatorCount(0)
    }

    // ── Spectator: live viewer count changed ───────────────────────────────
    function handleSpectatorCountUpdate({ campaignId: cid, count }) {
      if (cid !== campaignId) return
      setSpectatorCount(count)
    }

    // ── Player: GM requested consent ───────────────────────────────────────
    function handleConsentRequested({ campaignId: cid, ...data }) {
      if (cid !== campaignId) return
      setConsentPending({ campaignId: cid, ...data })
      // Start countdown so the player can see the timeout ticking
      setConsentCountdown(data.timeoutSecs ?? 60)
      clearInterval(countdownInterval.current)
      countdownInterval.current = setInterval(() => {
        setConsentCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    // ── Torch timer: real-time sync from GM actions ────────────────────────
    function handleLightTimerUpdate({ expiresAt, remainingSecs }) {
      setLightExpiresAt(expiresAt ?? null)
      setLightPausedSecs(remainingSecs ?? 3600)
    }

    socket.on('new_message',            handleNewMessage)
    socket.on('consent_update',         handleConsentUpdate)
    socket.on('spectator_active',       handleSpectatorActive)
    socket.on('spectator_cancelled',    handleSpectatorCancelled)
    socket.on('spectator_ended',        handleSpectatorEnded)
    socket.on('spectator_count_update', handleSpectatorCountUpdate)
    socket.on('consent_requested',      handleConsentRequested)
    socket.on('light_timer_update',     handleLightTimerUpdate)

    return () => {
      socket.off('new_message',            handleNewMessage)
      socket.off('consent_update',         handleConsentUpdate)
      socket.off('spectator_active',       handleSpectatorActive)
      socket.off('spectator_cancelled',    handleSpectatorCancelled)
      socket.off('spectator_ended',        handleSpectatorEnded)
      socket.off('spectator_count_update', handleSpectatorCountUpdate)
      socket.off('consent_requested',      handleConsentRequested)
      socket.off('light_timer_update',     handleLightTimerUpdate)
      socket.emit('leave_campaign', { campaignId })
      clearInterval(countdownInterval.current)
    }
  }, [socket, connected, campaignId])

  // ── Torch timer: live countdown display ────────────────────────────────────
  // When expiresAt is set, tick every second; when null, show paused value.
  useEffect(() => {
    if (!lightExpiresAt) {
      setLightDisplay(lightPausedSecs)
      return
    }
    function tick() {
      const rem = Math.max(0, Math.floor((new Date(lightExpiresAt) - Date.now()) / 1000))
      setLightDisplay(rem)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lightExpiresAt, lightPausedSecs])

  // ── Torch timer: GM action ──────────────────────────────────────────────────
  // Sends the action to the socket server which persists to DB and broadcasts
  // 'light_timer_update' back to ALL campaign room members including the GM.
  function handleLightTimer(action, secs) {
    if (!socket || !connected || !isGM) return
    socket.emit('push_light_timer', { campaignId, action, secs })
  }

  // ── Auto-scroll to latest message ──────────────────────────────────────────
  // First render → instant jump to bottom. New messages → jump only if near bottom.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (!didScrollRef.current) {
      el.scrollTop = el.scrollHeight
      didScrollRef.current = true
    } else {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
      if (nearBottom) el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback((e) => {
    e.preventDefault()
    const raw = input.trim()
    if (!raw || !socket || !joined || sending) return
    setSending(true)
    setChatError('')

    // Dice command: /XdY
    const dice = parseDiceCommand(raw)
    if (dice) {
      const rolls    = rollDice(dice.count, dice.sides)
      const metadata = buildDiceMetadata(dice.count, dice.sides, rolls)
      const body     = formatDiceBody(user?.username ?? 'Someone', metadata)
      socket.emit('send_message', { campaignId, body, metadata }, ({ ok, error }) => {
        setSending(false)
        if (error) setChatError(error)
        else { setInput(''); inputRef.current?.focus() }
      })
      return
    }

    socket.emit('send_message', { campaignId, body: raw }, ({ ok, error }) => {
      setSending(false)
      if (error) { setChatError(error) }
      else { setInput(''); inputRef.current?.focus() }
    })
  }, [input, socket, joined, sending, campaignId, user])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
  }

  // ── GM: open spectator mode ─────────────────────────────────────────────────
  function handleSpectatorRequest() {
    if (!socket || spectatorAction) return
    setSpectatorAction(true)
    setChatError('')
    socket.emit('spectator_request', { campaignId }, ({ ok, totalNeeded, error }) => {
      setSpectatorAction(false)
      if (error) { setChatError(error); return }
      if (totalNeeded === 0) {
        // Activated immediately — spectator_active event will follow
      } else {
        setSpectatorStatus('pending')
        setConsentProgress({ accepted: 0, total: totalNeeded })
      }
    })
  }

  // ── GM: close spectator mode ────────────────────────────────────────────────
  function handleSpectatorClose() {
    if (!socket || spectatorAction) return
    setSpectatorAction(true)
    socket.emit('spectator_close', { campaignId }, ({ ok, error }) => {
      setSpectatorAction(false)
      if (error) setChatError(error)
    })
  }

  // ── Player: respond to consent request ─────────────────────────────────────
  function handleConsent(accepted) {
    if (!socket || !consentPending) return
    clearInterval(countdownInterval.current)
    setConsentPending(null)
    socket.emit('consent_response', { campaignId, accepted }, ({ ok, error }) => {
      if (error) setChatError(error)
    })
  }

  // ── Connection / join status strip ─────────────────────────────────────────
  function StatusStrip() {
    if (!connected) return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-codex-muted bg-codex-bg/40 border-b border-codex-border">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse" />
        Connecting to campaign chat…
      </div>
    )
    if (!joined) return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-codex-muted bg-codex-bg/40 border-b border-codex-border">
        <span className="w-1.5 h-1.5 rounded-full bg-codex-gold animate-pulse" />
        Joining campaign chat…
      </div>
    )
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-codex-muted border-b border-codex-border">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Campaign chat — live
        {spectatorStatus === 'active' && spectatorCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-codex-subtext">
            <Users size={10} />
            {spectatorCount} watching
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="border border-codex-border rounded-xl overflow-hidden bg-codex-surface">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-codex-border">
        <MessageSquare size={14} className="text-codex-gold" />
        <h2 className="text-sm font-semibold text-codex-text">Campaign Chat</h2>

        {/* Spectator mode indicator */}
        {spectatorStatus === 'active' && (
          <span className="ml-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
            <Eye size={9} /> LIVE — Spectators On
          </span>
        )}
        {spectatorStatus === 'pending' && (
          <span className="ml-1 flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5 animate-pulse">
            Waiting for consent…
          </span>
        )}

        {/* GM controls — pushed to the right */}
        {isGM && joined && (
          <div className="ml-auto">
            {spectatorStatus === null && (
              <button
                onClick={handleSpectatorRequest}
                disabled={spectatorAction}
                className="flex items-center gap-1.5 text-xs text-codex-subtext hover:text-codex-text border border-codex-border hover:border-codex-gold/50 rounded-lg px-2.5 py-1 transition-all disabled:opacity-40"
                title="Open this session to public spectators (requires player consent)"
              >
                <Eye size={11} />
                Open to Spectators
              </button>
            )}

            {spectatorStatus === 'pending' && consentProgress && (
              <span className="text-xs text-amber-400">
                {consentProgress.accepted}/{consentProgress.total} consented…
              </span>
            )}

            {spectatorStatus === 'active' && (
              <button
                onClick={handleSpectatorClose}
                disabled={spectatorAction}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 rounded-lg px-2.5 py-1 transition-all disabled:opacity-40"
                title="Close spectator mode — removes session from the public room list"
              >
                <EyeOff size={11} />
                Close Spectators
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Torch timer strip — Shadowdark only, visible to everyone ── */}
      {isSD && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-950/25 border-b border-amber-900/30">
          <Flame
            size={13}
            className={`shrink-0 ${lightRunning ? 'text-amber-400 animate-pulse' : 'text-codex-muted'}`}
          />
          <span className="text-[11px] font-semibold text-codex-muted uppercase tracking-wide shrink-0">
            Torch
          </span>
          <span className={`text-sm font-mono font-bold tabular-nums ${
            lightDisplay <= 300 ? 'text-red-400 animate-pulse' :
            lightDisplay <= 600 ? 'text-amber-400' :
            'text-amber-200/80'
          }`}>
            {formatLightTimer(lightDisplay)}
          </span>
          {!isGM && (
            <span className="text-[10px] text-codex-muted">
              {lightRunning ? '— burning' : '— paused'}
            </span>
          )}

          {/* GM controls — pushed right */}
          {isGM && (
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {!lightRunning
                ? <button
                    onClick={() => handleLightTimer('start')}
                    className="text-[10px] text-amber-400 hover:text-amber-300 px-2 py-0.5 border border-amber-400/30 hover:border-amber-400/60 rounded-full transition-colors"
                  >Start</button>
                : <button
                    onClick={() => handleLightTimer('pause')}
                    className="text-[10px] text-codex-muted hover:text-codex-subtext px-2 py-0.5 border border-codex-border rounded-full transition-colors"
                  >Pause</button>
              }
              <button
                onClick={() => handleLightTimer('reset', lightPausedSecs || 3600)}
                className="text-[10px] text-codex-muted hover:text-codex-subtext px-1.5 py-0.5 border border-codex-border rounded-full transition-colors"
              >Reset</button>
              <div className="flex items-center gap-0.5">
                {[600, 1800, 3600].map(s => (
                  <button
                    key={s}
                    onClick={() => handleLightTimer('reset', s)}
                    className="text-[9px] text-codex-muted hover:text-amber-400 px-1.5 py-0.5 border border-codex-border rounded transition-colors"
                  >
                    {s === 600 ? '10m' : s === 1800 ? '30m' : '1hr'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Connection / join status ── */}
      <StatusStrip />

      {/* ── Late-join spectator banner (player-only, dismissible) ── */}
      {lateJoinBanner && !isGM && (
        <div className="flex items-start justify-between gap-3 px-4 py-2.5 text-xs bg-amber-500/5 border-b border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-400">
            <Eye size={11} className="shrink-0 mt-0.5" />
            <span>
              This session is currently open to public spectators.
              You are joining as a participant — your messages are visible to viewers.
            </span>
          </div>
          <button
            onClick={() => setLateJoinBanner(false)}
            className="text-codex-muted hover:text-codex-text shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Player consent modal (rendered inside chat panel) ── */}
      {consentPending && !isGM && (
        <div className="px-4 py-4 border-b border-codex-gold/20 bg-codex-gold/5">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Eye size={14} className="text-codex-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-codex-text">
                  {consentPending.gmUsername} wants to open this session to spectators
                </p>
                <p className="text-xs text-codex-subtext mt-0.5">
                  Spectators can read the chat but cannot send messages. Do you consent?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleConsent(true)}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Allow
              </button>
              <button
                onClick={() => handleConsent(false)}
                className="flex-1 py-2 rounded-lg border border-codex-border text-codex-subtext hover:text-codex-text hover:border-codex-text text-xs font-semibold transition-colors"
              >
                Decline
              </button>
              <span className="text-xs text-codex-muted tabular-nums w-8 text-right">
                {consentCountdown}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Message log ── */}
      <div ref={scrollContainerRef} className="h-80 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {joined && messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-codex-muted italic text-center">
              No messages yet. Be the first to say something.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          // Dice roll — full-width announcement bubble
          if (msg.metadata?.type === 'dice') {
            return <DiceRollBubble key={msg.id} message={msg} />
          }

          const isMine = msg.user_id === user?.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold uppercase select-none
                ${isMine
                  ? 'bg-codex-gold/20 text-codex-gold border border-codex-gold/30'
                  : 'bg-codex-surface text-codex-subtext border border-codex-border'
                }`}>
                {msg.username?.[0] ?? '?'}
              </div>
              <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1 flex-wrap">
                  {!isMine && (
                    <>
                      <span className="text-[11px] font-medium text-codex-subtext">{msg.username}</span>
                      <TierBadge tier={userTierMap[msg.user_id]?.tier ?? 'free'} size={13} />
                    </>
                  )}
                  <span className="text-[10px] text-codex-muted">{formatChatTime(msg.created_at)}</span>
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
                  ${isMine
                    ? 'bg-codex-gold/10 border border-codex-gold/20 text-codex-text rounded-tr-sm'
                    : 'bg-codex-bg border border-codex-border text-codex-text rounded-tl-sm'
                  }`}>
                  {msg.body}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Error banner ── */}
      {chatError && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-2 text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
          <span>{chatError}</span>
          <button onClick={() => setChatError('')} className="shrink-0 hover:text-red-300">
            <X size={11} />
          </button>
        </div>
      )}

      {/* ── Input form ── */}
      <form onSubmit={handleSend} className="flex items-end gap-2 px-4 py-3 border-t border-codex-border">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setChatError('') }}
          onKeyDown={handleKeyDown}
          placeholder={joined ? 'Say something… (Enter to send, Shift+Enter for newline)' : 'Connecting…'}
          disabled={!joined || sending}
          rows={1}
          maxLength={1000}
          className="flex-1 resize-none bg-codex-bg border border-codex-border rounded-xl px-3 py-2 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20 transition-colors disabled:opacity-40 max-h-32 overflow-y-auto"
          style={{ fieldSizing: 'content' }}
        />
        <button
          type="submit"
          disabled={!joined || !input.trim() || sending}
          className="flex-shrink-0 p-2.5 rounded-xl bg-codex-gold text-codex-bg hover:bg-codex-goldHover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Send message"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin block" />
            : <Send size={15} />
          }
        </button>
      </form>
    </div>
  )
}

// ─── Format chat timestamp ────────────────────────────────────────────────────
// Returns a compact relative or clock time label for message bubbles.
function formatChatTime(ts) {
  if (!ts) return ''
  const d    = new Date(ts)
  const now  = new Date()
  const diff = Math.floor((now - d) / 1000) // seconds

  if (diff < 60)  return 'just now'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return `${m}m ago`
  }
  // Same calendar day — show time only
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  // Older — show date + time
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

