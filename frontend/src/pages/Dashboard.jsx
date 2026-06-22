import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Plus, LogOut, Scroll, Users, Shield, BookOpen, Settings, Feather, MessagesSquare, Skull } from 'lucide-react'
import { useAuth }   from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useTour }   from '../context/TourContext'
import { api } from '../utils/api'
import CreateCampaignModal from '../components/campaign/CreateCampaignModal'
import CreateCharacterModal from '../components/character/CreateCharacterModal'

const GAME_LABELS = {
  shadowdark: { label: 'Shadowdark',  color: 'text-amber-500',  dot: 'bg-amber-500' },
  morkborg:   { label: 'Mörk Borg',   color: 'text-yellow-300', dot: 'bg-yellow-300' },
  nimble:     { label: 'Nimble RPG',  color: 'text-emerald-400', dot: 'bg-emerald-400' },
}

const TIER_BADGE = {
  free:     null,
  bronze:   { label: '🥉 Bronze',   cls: 'text-amber-600  border-amber-600/40' },
  silver:   { label: '🥈 Silver',   cls: 'text-slate-300  border-slate-300/40' },
  gold:     { label: '🥇 Gold',     cls: 'text-yellow-400 border-yellow-400/40' },
  platinum: { label: '🐉 Platinum', cls: 'text-purple-400 border-purple-400/40' },
}

const BESTIARY_SYSTEMS = [
  {
    id:          'shadowdark',
    label:       'Shadowdark',
    icon:        '🗡️',
    tagline:     'Dungeon crawlers, cultists, ancient horrors',
    color:       'text-amber-500',
    hoverBorder: 'border-amber-500/30 hover:border-amber-500/60',
  },
  {
    id:          'morkborg',
    label:       'Mörk Borg',
    icon:        '💀',
    tagline:     'Apocalyptic nightmares and flesh-eating filth',
    color:       'text-yellow-300',
    hoverBorder: 'border-yellow-300/20 hover:border-yellow-300/50',
  },
  {
    id:          'nimble',
    label:       'Nimble RPG',
    icon:        '🛡️',
    tagline:     'Balanced threats for any tier of play',
    color:       'text-emerald-400',
    hoverBorder: 'border-emerald-400/20 hover:border-emerald-400/50',
  },
]

export default function Dashboard() {
  const { user, logout }              = useAuth()
  const { startTour }                 = useTour()
  const { socket, connected }         = useSocket()
  const navigate                      = useNavigate()
  const [campaigns, setCampaigns]     = useState([])
  const [characters, setCharacters]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]         = useState(false)
  const [showCreateChar, setShowCreateChar] = useState(false)
  const [joinCode, setJoinCode]       = useState('')
  const [unreadRavens, setUnreadRavens] = useState(0)
  const [joinError, setJoinError]     = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [campRes, charRes] = await Promise.all([
        api.get('/campaigns'),
        api.get('/characters'),
      ])
      setCampaigns(campRes.campaigns)
      setCharacters(charRes.characters)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Fetch unread raven count on mount; real-time push via raven:received keeps it live
  useEffect(() => {
    api.get('/ravens/unread-count')
      .then(({ count }) => setUnreadRavens(Number(count) || 0))
      .catch(() => {})
  }, [])

  // Real-time: increment dot when a raven arrives; clears when user visits /ravens
  useEffect(() => {
    if (!socket || !connected) return
    function onRavenReceived() { setUnreadRavens(n => n + 1) }
    socket.on('raven:received', onRavenReceived)
    return () => socket.off('raven:received', onRavenReceived)
  }, [socket, connected])

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinError('')
    setJoinLoading(true)
    try {
      await api.post('/campaigns/join', { joinCode: joinCode.trim() })
      setJoinCode('')
      loadData()
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoinLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  async function handleDismissCampaign(campaignId) {
    try {
      await api.post(`/campaigns/${campaignId}/dismiss`)
      setCampaigns(prev => prev.filter(c => c.id !== campaignId))
    } catch (err) {
      console.error('Failed to dismiss campaign:', err)
    }
  }

  async function handleLeaveCampaign(campaignId) {
    try {
      await api.post(`/campaigns/${campaignId}/leave`)
      setCampaigns(prev => prev.filter(c => c.id !== campaignId))
    } catch (err) {
      console.error('Failed to leave campaign:', err.message)
    }
  }

  const gmCampaigns          = campaigns.filter(c => c.gm_user_id === user?.id)
  const playerCampaignsAll   = campaigns.filter(c => c.gm_user_id !== user?.id)
  const playerCampaigns      = playerCampaignsAll.filter(c => !c.is_deleted)
  const deletedPlayerCampaigns = playerCampaignsAll.filter(c => c.is_deleted)
  const tier            = TIER_BADGE[user?.supporterTier]

  return (
    <div className="min-h-screen bg-codex-bg flex flex-col">
      <Helmet><title>Dashboard — CampaignCodex</title></Helmet>
      {/* Top nav */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-codex-gold" />
            <span className="font-display text-sm text-codex-gold tracking-wide">CampaignCodex</span>
          </div>
          {/*
            Nav items — each uses px-2.5 py-2 to hit the 44×44px minimum touch
            target recommended by Apple HIG and WCAG 2.5.5. The visible icon/text
            stays the same size; only the clickable area grows.
          */}
          <div className="flex items-center gap-1">
            {tier && (
              <span className={`text-xs border rounded-full px-2.5 py-1 ${tier.cls}`}>
                {tier.label}
              </span>
            )}

            {/* Public Chatrooms */}
            <Link
              to="/chat"
              data-tour="nav-chatrooms"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
              title="Public Chatrooms"
            >
              <MessagesSquare size={16} />
              <span className="hidden sm:block text-xs">Chatrooms</span>
            </Link>

            {/* Raven Post with unread badge */}
            <Link
              to="/ravens"
              data-tour="nav-ravens"
              className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
              title="The Raven Post"
            >
              <Feather size={16} />
              <span className="hidden sm:block text-xs">Ravens</span>
              {unreadRavens > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-codex-gold
                  border-2 border-codex-bg" />
              )}
            </Link>

            {/* Settings / username */}
            <Link
              to="/settings"
              data-tour="nav-settings"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors group"
              title="Account settings"
            >
              <span className="hidden sm:block text-xs">{user?.username}</span>
              <Settings size={16} className="text-codex-muted group-hover:text-codex-gold transition-colors" />
            </Link>

            {user?.isModerator && !user?.isAdmin && (
              <button
                onClick={() => navigate('/moderator')}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-400/5 transition-colors border border-blue-400/30"
              >
                <Shield size={13} /> Mod
              </button>
            )}
            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-400/5 transition-colors border border-purple-400/30"
              >
                <Shield size={13} /> Admin
              </button>
            )}

            {/* Sign out */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-codex-subtext hover:text-codex-text hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:block text-xs">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8 w-full">

        {/* Welcome + stats row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-codex-text">
              Welcome back,{' '}
              <Link
                to="/profile/edit"
                data-tour="profile-link"
                className="text-codex-gold hover:text-codex-goldHover transition-colors underline-offset-2 hover:underline"
                title="Edit your profile"
              >
                {user?.firstName}
              </Link>
            </h1>
            <p className="text-sm text-codex-subtext mt-1">
              {user?.sheetLimit - characters.length} of {user?.sheetLimit} character sheets remaining
            </p>
          </div>
          <div className="flex gap-3" data-tour="stat-pills">
            <StatPill icon={<Scroll size={14}/>} label="Sheets"    value={characters.length} />
            <StatPill icon={<Users size={14}/>}  label="Campaigns" value={campaigns.length}  />
          </div>
        </div>

        {/* Join code bar */}
        <form onSubmit={handleJoin} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              placeholder="Enter join code  (e.g. XKF-9TRA)"
              maxLength={8}
              className="w-full bg-codex-surface border border-codex-border rounded-lg px-4 py-2.5 text-codex-text placeholder-codex-muted text-sm font-mono tracking-widest uppercase focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30 transition-colors"
            />
            {joinError && (
              <p className="absolute -bottom-5 left-0 text-xs text-red-400">{joinError}</p>
            )}
          </div>
          <button type="submit" disabled={joinLoading || !joinCode.trim()}
            className="px-5 py-2.5 rounded-lg bg-codex-surface border border-codex-border text-codex-text text-sm font-medium hover:border-codex-gold transition-colors disabled:opacity-40">
            {joinLoading ? 'Joining…' : 'Join'}
          </button>
        </form>

        {loading ? (
          <div className="text-center text-codex-muted text-sm py-16 animate-pulse">Loading your campaigns…</div>
        ) : (
          <>
            {/* GM Campaigns */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-codex-text flex items-center gap-2">
                  <Shield size={15} className="text-codex-gold" /> Campaigns I'm Running
                </h2>
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 text-xs text-codex-gold border border-codex-gold/30 rounded-lg px-3 py-1.5 hover:bg-codex-gold/10 transition-colors">
                  <Plus size={13} /> New Campaign
                </button>
              </div>

              {gmCampaigns.length === 0 ? (
                <EmptyState
                  message="You haven't created any campaigns yet."
                  action="Create your first campaign"
                  onAction={() => setShowCreate(true)}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {gmCampaigns.map(c => (
                    <CampaignCard key={c.id} campaign={c} role="gm"
                      onClick={() => navigate(`/campaigns/${c.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* Player Campaigns */}
            <section>
              <h2 className="text-base font-semibold text-codex-text flex items-center gap-2 mb-4">
                <Users size={15} className="text-codex-gold" /> Campaigns I'm Playing In
              </h2>
              {playerCampaigns.length === 0 && deletedPlayerCampaigns.length === 0 ? (
                <EmptyState message="You haven't joined any campaigns. Enter a join code above." />
              ) : (
                <div className="flex flex-col gap-3">
                  {playerCampaigns.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {playerCampaigns.map(c => (
                        <CampaignCard key={c.id} campaign={c} role="player"
                          onClick={() => navigate(`/campaigns/${c.id}`)}
                          onLeave={() => handleLeaveCampaign(c.id)} />
                      ))}
                    </div>
                  )}
                  {/* Deleted campaign tombstones — click to dismiss */}
                  {deletedPlayerCampaigns.map(c => (
                    <DeletedCampaignTombstone
                      key={c.id}
                      campaign={c}
                      onDismiss={() => handleDismissCampaign(c.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* My Characters */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-codex-text flex items-center gap-2">
                  <Scroll size={15} className="text-codex-gold" /> My Characters
                </h2>
                <button onClick={() => setShowCreateChar(true)}
                  className="flex items-center gap-1.5 text-xs text-codex-gold border border-codex-gold/30 rounded-lg px-3 py-1.5 hover:bg-codex-gold/10 transition-colors">
                  <Plus size={13} /> New Character
                </button>
              </div>

              {characters.length === 0 ? (
                <EmptyState
                  message="You haven't created any characters yet."
                  action="Create your first character"
                  onAction={() => setShowCreateChar(true)}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {characters.map(ch => (
                    <CharacterCard key={ch.id} character={ch}
                      onClick={() => navigate(`/characters/${ch.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* Bestiary */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-semibold text-codex-text flex items-center gap-2">
                  <Skull size={15} className="text-codex-gold" /> Bestiary
                </h2>
                <span className="text-xs text-codex-muted">
                  — create and manage monsters for each rule set
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BESTIARY_SYSTEMS.map(sys => (
                  <button
                    key={sys.id}
                    onClick={() => navigate(`/bestiary/${sys.id}`)}
                    className={`group flex flex-col gap-3 p-5 text-left rounded-xl border
                      bg-codex-surface transition-all duration-150
                      hover:bg-codex-card hover:shadow-lg ${sys.hoverBorder}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{sys.icon}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${sys.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        Open →
                      </span>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold text-codex-text group-hover:${sys.color} transition-colors`}>
                        {sys.label}
                      </p>
                      <p className="text-xs text-codex-muted mt-0.5">{sys.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-codex-border/30 py-4 mt-4">
        <div className="max-w-5xl mx-auto px-4">
          {/*
            Mobile:  flex-col, centered — copyright first, tour button below.
            Desktop: relative row, copyright centered via justify-center, tour
                     button absolutely pinned to the left edge (out of flow so
                     it doesn't shift the copyright off-center).
          */}
          <div className="flex flex-col items-center gap-2 sm:relative sm:flex-row sm:justify-center">
            <p className="text-xs text-codex-muted/50">
              © {new Date().getFullYear()} CampaignCodex · All rights reserved
            </p>
            <button
              onClick={startTour}
              className="text-xs text-codex-muted/40 hover:text-codex-gold transition-colors duration-150 sm:absolute sm:left-0"
              title="Replay the onboarding tour"
            >
              Take the Tour
            </button>
          </div>
        </div>
      </footer>

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={camp => setCampaigns(prev => [camp, ...prev])}
        />
      )}

      {showCreateChar && (
        <CreateCharacterModal
          onClose={() => setShowCreateChar(false)}
          campaigns={campaigns}
        />
      )}

    </div>
  )
}

function StatPill({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 bg-codex-surface border border-codex-border rounded-lg px-3 py-1.5">
      <span className="text-codex-muted">{icon}</span>
      <span className="text-xs text-codex-subtext">{label}</span>
      <span className="text-sm font-semibold text-codex-text">{value}</span>
    </div>
  )
}

function CampaignCard({ campaign, role, onClick, onLeave }) {
  const game = GAME_LABELS[campaign.game_system] ?? { label: campaign.game_system, color: 'text-codex-text', dot: 'bg-codex-muted' }
  return (
    <div className="relative group">
      <button onClick={onClick}
        className="w-full text-left bg-codex-surface border border-codex-border rounded-xl p-4 hover:border-codex-muted hover:bg-codex-card transition-all duration-150 group/card">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-codex-text text-sm group-hover/card:text-codex-gold transition-colors leading-snug">
            {campaign.name}
          </h3>
          <span className={`flex items-center gap-1.5 text-xs shrink-0 ${game.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${game.dot}`} />
            {game.label}
          </span>
        </div>
        {campaign.description && (
          <p className="text-xs text-codex-subtext line-clamp-2 mb-3">{campaign.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-codex-muted">
          <span>{role === 'gm' ? '⚔️ Game Master' : '🎲 Player'}</span>
          {role === 'gm' && (
            <span className="font-mono tracking-wider bg-codex-bg border border-codex-border rounded px-2 py-0.5">
              {campaign.join_code}
            </span>
          )}
          <span>{campaign.member_count ?? 0} players</span>
        </div>
      </button>

      {/* Player: Leave button — appears on hover */}
      {role === 'player' && onLeave && (
        <button
          onClick={e => { e.stopPropagation(); onLeave() }}
          title="Leave campaign"
          className="
            absolute bottom-3 right-3
            flex items-center justify-center h-6 rounded-lg px-2
            border border-codex-border text-codex-muted bg-codex-surface
            opacity-0 group-hover:opacity-100
            hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/5
            text-[10px] font-medium tracking-wide
            transition-all duration-150
          "
        >
          Leave
        </button>
      )}
    </div>
  )
}

function EmptyState({ message, action, onAction }) {
  return (
    <div className="border border-dashed border-codex-border rounded-xl p-8 text-center">
      <p className="text-sm text-codex-subtext mb-3">{message}</p>
      {action && onAction && (
        <button onClick={onAction}
          className="text-sm text-codex-gold hover:text-codex-goldHover transition-colors">
          {action} →
        </button>
      )}
    </div>
  )
}

function DeletedCampaignTombstone({ campaign, onDismiss }) {
  const [dismissing, setDismissing] = useState(false)
  const game = GAME_LABELS[campaign.game_system] ?? { label: campaign.game_system, color: 'text-codex-muted', dot: 'bg-codex-muted' }

  async function handleClick() {
    if (dismissing) return
    setDismissing(true)
    await onDismiss()
  }

  return (
    <button
      onClick={handleClick}
      disabled={dismissing}
      className="w-full text-left bg-codex-surface/40 border border-codex-border/50 rounded-xl p-4 transition-all duration-150 hover:border-codex-border hover:bg-codex-surface/60 opacity-60 hover:opacity-80 disabled:opacity-30 group"
      title="Click to dismiss"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-codex-muted line-through leading-snug">{campaign.name}</span>
          <span className="text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
            Deleted by GM
          </span>
        </div>
        <span className={`flex items-center gap-1.5 text-xs shrink-0 opacity-50 ${game.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${game.dot}`} />
          {game.label}
        </span>
      </div>
      <p className="text-xs text-codex-muted">
        {dismissing ? 'Removing…' : 'Click to remove from your dashboard'}
      </p>
    </button>
  )
}

const SYSTEM_ICONS = { shadowdark: '⚔️', morkborg: '💀', nimble: '🛡️' }
const SYSTEM_COLOR = {
  shadowdark: 'text-amber-500',
  morkborg:   'text-yellow-300',
  nimble:     'text-emerald-400',
}

function CharacterCard({ character, onClick }) {
  const systemLabel = GAME_LABELS[character.game_system]?.label ?? character.game_system
  const systemColor = SYSTEM_COLOR[character.game_system] ?? 'text-codex-subtext'

  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-codex-surface border border-codex-border rounded-xl hover:border-codex-gold hover:bg-codex-card transition-all duration-150 group text-center">
      {/* Portrait / system icon */}
      <div className="w-14 h-14 rounded-full bg-codex-bg border-2 border-codex-border flex items-center justify-center text-2xl group-hover:border-codex-gold/50 transition-colors overflow-hidden">
        {character.portrait_url
          ? <img src={character.portrait_url} alt={character.character_name} className="w-full h-full object-cover" />
          : SYSTEM_ICONS[character.game_system] ?? '🎲'
        }
      </div>
      <div>
        <p className="text-sm font-semibold text-codex-text group-hover:text-codex-gold transition-colors leading-tight">
          {character.character_name}
        </p>
        <p className={`text-xs mt-0.5 ${systemColor}`}>{systemLabel}</p>
      </div>
    </button>
  )
}
