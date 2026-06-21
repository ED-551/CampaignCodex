/**
 * ProfilePage — public view of a user's profile card.
 *
 * Route: /profile/:username
 * The card displays in the viewer's browser using the profile owner's chosen theme.
 * Action buttons (friend request, message) are shown for other users' profiles only.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  BookOpen, ArrowLeft, MessageCircle, UserPlus, UserCheck, Clock,
  Swords, Shield, Users, Scroll,
} from 'lucide-react'
import { useAuth }   from '../context/AuthContext'
import { useDM }     from '../context/DMContext'
import { useSocial } from '../context/SocialContext'
import { api }       from '../utils/api'

// ─── Per-theme token/accent mappings ─────────────────────────────────────────
const THEMES = {
  default: {
    topBar:       'via-codex-gold',
    cardBorder:   'border-codex-border',
    accent:       'text-codex-gold',
    accentBg:     'bg-codex-gold/10',
    accentBorder: 'border-codex-gold/30',
    coinRing:     'border-codex-gold/60 bg-codex-gold/15 text-codex-gold',
    chip:         'bg-codex-gold/10 text-codex-gold border border-codex-gold/30',
    statVal:      'text-codex-gold',
    label:        null,
  },
  shadowdark: {
    topBar:       'via-amber-500',
    cardBorder:   'border-amber-600/50',
    accent:       'text-amber-500',
    accentBg:     'bg-amber-500/10',
    accentBorder: 'border-amber-500/30',
    coinRing:     'border-amber-500/60 bg-amber-500/15 text-amber-400',
    chip:         'bg-amber-500/10 text-amber-500 border border-amber-500/30',
    statVal:      'text-amber-500',
    label:        'Shadowdark',
  },
  morkborg: {
    topBar:       'via-yellow-300',
    cardBorder:   'border-yellow-300/50',
    accent:       'text-yellow-300',
    accentBg:     'bg-yellow-300/10',
    accentBorder: 'border-yellow-300/30',
    coinRing:     'border-yellow-300/60 bg-yellow-300/15 text-yellow-300',
    chip:         'bg-yellow-300/10 text-yellow-300 border border-yellow-300/30',
    statVal:      'text-yellow-300',
    label:        'Mörk Borg',
  },
  nimble: {
    topBar:       'via-emerald-400',
    cardBorder:   'border-emerald-400/50',
    accent:       'text-emerald-400',
    accentBg:     'bg-emerald-400/10',
    accentBorder: 'border-emerald-400/30',
    coinRing:     'border-emerald-400/60 bg-emerald-400/15 text-emerald-400',
    chip:         'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30',
    statVal:      'text-emerald-400',
    label:        'Nimble RPG',
  },
}

const GAME_LABELS = {
  shadowdark: 'Shadowdark',
  morkborg:   'Mörk Borg',
  nimble:     'Nimble RPG',
}

const ROLE_LABELS = {
  player: 'Player',
  dm:     'Game Master',
  both:   'Player & GM',
}

export default function ProfilePage() {
  const { username }    = useParams()
  const { user }        = useAuth()
  const navigate        = useNavigate()
  const { openDM }      = useDM()
  const { getFriendStatus, sendFriendRequest, outgoingSet } = useSocial()

  const [profile,       setProfile]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [friendLoading, setFriendLoading] = useState(false)

  const isOwnProfile = user?.username === username

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get(`/profile/${encodeURIComponent(username)}`)
      .then(({ profile }) => setProfile(profile))
      .catch(err => setError(err.message || 'Profile not found.'))
      .finally(() => setLoading(false))
  }, [username])

  async function handleFriendRequest() {
    if (!profile) return
    setFriendLoading(true)
    try { await sendFriendRequest(profile.id) } catch {}
    setFriendLoading(false)
  }

  function handleMessage() {
    if (!profile) return
    openDM(profile.id, profile.username)
  }

  if (loading) return (
    <PageShell>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-codex-muted animate-pulse">Loading profile…</p>
      </div>
    </PageShell>
  )

  if (error || !profile) return (
    <PageShell>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-codex-subtext text-sm">{error || 'Profile not found.'}</p>
        <button onClick={() => navigate(-1)}
          className="text-xs text-codex-gold hover:text-codex-goldHover transition-colors">
          ← Go back
        </button>
      </div>
    </PageShell>
  )

  const theme = THEMES[profile.profileTheme] ?? THEMES.default
  const friendStatus = isOwnProfile ? null : getFriendStatus(profile.id)

  return (
    <PageShell>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
        {/* ── Profile Card ── */}
        <div className={`bg-codex-card border ${theme.cardBorder} rounded-2xl overflow-hidden shadow-xl`}>

          {/* Themed top bar */}
          <div className={`h-px w-full bg-gradient-to-r from-transparent ${theme.topBar} to-transparent opacity-70`} />

          {/* Header section */}
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start gap-4">
              {/* Coin avatar */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 ${theme.coinRing}
                flex items-center justify-center text-xl font-bold font-display select-none`}>
                {profile.username[0].toUpperCase()}
              </div>

              {/* Name + theme badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h1 className={`text-xl font-semibold truncate ${theme.accent}`}>
                      {profile.username}
                    </h1>
                    {profile.displayName && (
                      <p className="text-sm text-codex-subtext mt-0.5">{profile.displayName}</p>
                    )}
                  </div>
                  {theme.label && (
                    <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider
                      px-2 py-0.5 rounded-full border ${theme.chip}`}>
                      {theme.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-codex-border/60 mx-6" />

          {/* Stats */}
          <div className="px-6 py-4 flex flex-col gap-2">
            {/* Campaign stats row */}
            <div className="flex items-center gap-4 flex-wrap">
              <StatItem
                icon={<Scroll size={13} />}
                label="Campaigns"
                value={profile.stats.campaigns}
                theme={theme}
              />
              <StatItem
                icon={<Shield size={13} />}
                label="GM"
                value={profile.stats.dm}
                theme={theme}
              />
              <StatItem
                icon={<Swords size={13} />}
                label="Player"
                value={profile.stats.player}
                theme={theme}
              />
              <StatItem
                icon={<Users size={13} />}
                label="Friends"
                value={profile.stats.friends}
                theme={theme}
              />
            </div>

            {/* Role preference */}
            {profile.rolePref && (
              <div className="flex items-center gap-2 mt-1">
                <Shield size={12} className="text-codex-muted flex-shrink-0" />
                <span className="text-xs text-codex-subtext">
                  Role: <span className={`font-medium ${theme.accent}`}>{ROLE_LABELS[profile.rolePref]}</span>
                </span>
              </div>
            )}

            {/* Game interests */}
            {profile.gameInterests?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs text-codex-muted flex-shrink-0">Interested in:</span>
                {profile.gameInterests.map(g => (
                  <span key={g} className={`text-[11px] px-2 py-0.5 rounded-full ${theme.chip}`}>
                    {GAME_LABELS[g] ?? g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* About section */}
          {profile.aboutText && (
            <>
              <div className="h-px bg-codex-border/60 mx-6" />
              <div className="px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-codex-muted mb-2">About</p>
                <p className="text-sm text-codex-subtext leading-relaxed whitespace-pre-wrap">
                  {profile.aboutText}
                </p>
              </div>
            </>
          )}

          {/* Action buttons — only for other users' profiles */}
          {!isOwnProfile && (
            <>
              <div className="h-px bg-codex-border/60 mx-6" />
              <div className="px-6 py-4 flex gap-3">
                <FriendButton
                  status={friendStatus}
                  loading={friendLoading}
                  theme={theme}
                  onClick={handleFriendRequest}
                />
                <button
                  onClick={handleMessage}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm
                    bg-codex-surface border border-codex-border text-codex-subtext
                    hover:text-codex-text hover:border-codex-muted transition-colors"
                >
                  <MessageCircle size={14} /> Message
                </button>
              </div>
            </>
          )}

          {/* Own profile — edit link */}
          {isOwnProfile && (
            <>
              <div className="h-px bg-codex-border/60 mx-6" />
              <div className="px-6 py-4">
                <Link
                  to="/profile/edit"
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${theme.accent}
                    hover:opacity-80 transition-opacity`}
                >
                  Edit your profile →
                </Link>
              </div>
            </>
          )}

          {/* Bottom bar */}
          <div className={`h-px w-full bg-gradient-to-r from-transparent ${theme.topBar} to-transparent opacity-30`} />
        </div>

        {/* Joined date */}
        <p className="text-center text-xs text-codex-muted mt-4">
          Member since {new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </main>
    </PageShell>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatItem({ icon, label, value, theme }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-codex-muted">{icon}</span>
      <span className={`text-sm font-bold ${theme.statVal}`}>{value}</span>
      <span className="text-xs text-codex-muted">{label}</span>
    </div>
  )
}

function FriendButton({ status, loading, theme, onClick }) {
  const configs = {
    none:             { label: 'Add Friend',     Icon: UserPlus,  disabled: false,
                        cls: `${theme.accentBg} ${theme.accent} border ${theme.accentBorder}` },
    request_sent:     { label: 'Request Sent',   Icon: Clock,     disabled: true,
                        cls: 'bg-codex-surface border border-codex-border text-codex-muted' },
    request_received: { label: 'Accept Request', Icon: UserCheck, disabled: false,
                        cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
    friends:          { label: 'Friends',        Icon: UserCheck, disabled: true,
                        cls: 'bg-codex-surface border border-codex-border text-codex-muted' },
  }
  const cfg = configs[status] ?? configs.none
  const { Icon } = cfg

  return (
    <button
      onClick={cfg.disabled ? undefined : onClick}
      disabled={loading || cfg.disabled}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
        transition-colors disabled:opacity-60 ${cfg.cls}`}
    >
      <Icon size={14} />
      {loading ? '…' : cfg.label}
    </button>
  )
}

function PageShell({ children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-codex-bg flex flex-col">
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
          <span className="text-codex-border">/</span>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-codex-subtext hover:text-codex-text transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}
