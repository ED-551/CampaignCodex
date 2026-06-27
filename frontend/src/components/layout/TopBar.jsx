import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, MessagesSquare, MessageCircle, Feather, Settings,
  LogOut, Shield, Menu, X, ChevronDown, Map,
} from 'lucide-react'
import { useAuth }       from '../../context/AuthContext'
import { useSocket }     from '../../context/SocketContext'
import { useScrollHide } from '../../hooks/useScrollHide'
import { useDM }         from '../../context/DMContext'
import { useSocial }     from '../../context/SocialContext'
import { api }           from '../../utils/api'

const TIER_BADGE = {
  free:     null,
  bronze:   { label: 'Bronze Member',   cls: 'text-amber-600  border-amber-600/40'  },
  silver:   { label: 'Silver Member',   cls: 'text-slate-300  border-slate-300/40'  },
  gold:     { label: 'Gold Member',     cls: 'text-yellow-400 border-yellow-400/40' },
  platinum: { label: 'Platinum Member', cls: 'text-purple-400 border-purple-400/40' },
  black:    { label: 'Obsidian Member', cls: 'text-slate-400  border-slate-400/40'  },
}

function getTierBadge(user) {
  return TIER_BADGE[user?.supporterTier] ?? null
}

// Shared nav-link classes used on both desktop and dropdowns
const NAV_LINK = 'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors'

export default function TopBar() {
  const { user, logout }                  = useAuth()
  const { socket, connected }             = useSocket()
  const navigate                          = useNavigate()
  const navVisible                        = useScrollHide()
  const { totalUnread, toggleWidget }     = useDM()
  const { totalIncoming, newFriendIds, newRequestIds } = useSocial()
  const dmBadge = totalUnread > 0 || totalIncoming > 0 || (newFriendIds?.size ?? 0) > 0 || (newRequestIds?.size ?? 0) > 0

  const [navOpen,      setNavOpen]      = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadRavens, setUnreadRavens] = useState(0)
  const userMenuRef = useRef(null)

  // Fetch initial unread raven count
  useEffect(() => {
    if (!user) return
    api.get('/ravens/unread-count')
      .then(({ count }) => setUnreadRavens(Number(count) || 0))
      .catch(() => {})
  }, [user])

  // Real-time raven badge increments
  useEffect(() => {
    if (!socket || !connected) return
    function onRavenReceived() { setUnreadRavens(n => n + 1) }
    socket.on('raven:received', onRavenReceived)
    return () => socket.off('raven:received', onRavenReceived)
  }, [socket, connected])

  // Close user dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile nav on ESC
  useEffect(() => {
    if (!navOpen) return
    function handler(e) { if (e.key === 'Escape') setNavOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navOpen])

  function handleLogout() {
    setNavOpen(false)
    setUserMenuOpen(false)
    logout()
    navigate('/', { replace: true })
  }

  const tier = getTierBadge(user)

  return (
    <>
      {/* ── Main bar ── */}
      <header className={`
        border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm
        sticky top-0 z-30
        transition-transform duration-300
        ${navVisible ? 'translate-y-0' : '-translate-y-full'}
      `}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

          {/* Left: Brand */}
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold shrink-0">
            <BookOpen size={18} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>

          {/* Right: Desktop nav */}
          <div data-tour="nav-trio" className="hidden sm:flex items-center gap-1">

            <Link
              to="/chat"
              data-tour="nav-chatrooms"
              className={NAV_LINK}
              title="Public Chatrooms"
            >
              <MessagesSquare size={16} />
              <span className="text-xs">Chatrooms</span>
            </Link>

            <Link
              to="/ravens"
              data-tour="nav-ravens"
              className={`relative ${NAV_LINK}`}
              title="The Raven Post"
            >
              <Feather size={16} />
              <span className="text-xs">Ravens</span>
              {unreadRavens > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-codex-gold border-2 border-codex-bg" />
              )}
            </Link>

            {/* VTT — accessible via Launch VTT on each campaign page */}

            {/* DM button */}
            <button
              data-tour="dm-bubble"
              onClick={toggleWidget}
              className={`relative ${NAV_LINK}`}
              title="Direct Messages"
            >
              <MessageCircle size={16} />
              <span className="text-xs">Messages</span>
              {dmBadge && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-codex-gold border-2 border-codex-bg" />
              )}
            </button>

            {/* Mod badge — visible only to non-admin moderators */}
            {user?.isModerator && !user?.isAdmin && (
              <button
                onClick={() => navigate('/moderator')}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-400/5 transition-colors border border-blue-400/30"
                title="Moderator Dashboard"
              >
                <Shield size={13} />
                <span>Mod</span>
              </button>
            )}

            {/* Admin badge */}
            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-400/5 transition-colors border border-purple-400/30"
                title="Admin Console"
              >
                <Shield size={13} />
                <span>Admin</span>
              </button>
            )}

            {/* Username dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                data-tour="nav-settings"
                onClick={() => setUserMenuOpen(v => !v)}
                className={`${NAV_LINK} gap-1`}
                title="Account"
              >
                <span className="text-xs">{user?.username}</span>
                <ChevronDown
                  size={13}
                  className={`text-codex-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-codex-surface border border-codex-border rounded-xl shadow-xl py-1 z-50">
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
                  >
                    <Settings size={13} />
                    Settings
                  </Link>
                  <div className="h-px bg-codex-border my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-codex-subtext hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: hamburger (shows unread dot when ravens waiting) */}
          <button
            onClick={() => setNavOpen(true)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
            aria-label="Open menu"
          >
            {unreadRavens > 0
              ? (
                <span className="relative">
                  <Feather size={18} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-codex-gold border border-codex-bg" />
                </span>
              )
              : <Menu size={20} />
            }
          </button>
        </div>
      </header>

      {/* ── Mobile slide-over ── */}
      {navOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
            onClick={() => setNavOpen(false)}
          />
          <div className="fixed top-0 right-0 h-screen w-72 max-w-[85vw] bg-codex-surface border-l border-codex-border z-50 sm:hidden flex flex-col shadow-2xl">

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-codex-border shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-codex-gold" />
                <span className="font-display text-sm text-codex-gold tracking-wide">Menu</span>
              </div>
              <button
                onClick={() => setNavOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-codex-muted hover:text-codex-text hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* User info */}
            <div className="px-5 py-4 border-b border-codex-border/50 shrink-0">
              <p className="text-xs text-codex-muted uppercase tracking-widest mb-0.5">Signed in as</p>
              <p className="text-sm font-medium text-codex-text">{user?.username}</p>
              {tier && (
                <span className={`inline-block mt-1.5 text-xs border rounded-full px-2 py-0.5 ${tier.cls}`}>
                  {tier.label}
                </span>
              )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
              <Link
                to="/chat"
                onClick={() => setNavOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
              >
                <MessagesSquare size={18} />
                <span className="text-base font-medium">Chatrooms</span>
              </Link>

              <Link
                to="/ravens"
                onClick={() => setNavOpen(false)}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
              >
                <Feather size={18} />
                <span className="text-base font-medium">Ravens</span>
                {unreadRavens > 0 && (
                  <span className="ml-auto text-xs font-semibold text-codex-gold bg-codex-gold/10 border border-codex-gold/30 rounded-full px-2 py-0.5">
                    {unreadRavens}
                  </span>
                )}
              </Link>

              <button
                onClick={() => { setNavOpen(false); toggleWidget() }}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors text-left w-full"
              >
                <MessageCircle size={18} />
                <span className="text-base font-medium">Messages</span>
                {dmBadge && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-codex-gold flex-shrink-0" />
                )}
              </button>

              {user?.isModerator && !user?.isAdmin && (
                <Link
                  to="/moderator"
                  onClick={() => setNavOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-400/5 transition-colors"
                >
                  <Shield size={18} />
                  <span className="text-base font-medium">Mod Dashboard</span>
                </Link>
              )}

              {user?.isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setNavOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-400/5 transition-colors"
                >
                  <Shield size={18} />
                  <span className="text-base font-medium">Admin Console</span>
                </Link>
              )}
            </nav>

            {/* Bottom: settings + sign out */}
            <div className="px-3 py-4 border-t border-codex-border/50 shrink-0 flex flex-col gap-1">
              <Link
                to="/settings"
                onClick={() => setNavOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-codex-subtext hover:text-codex-gold hover:bg-codex-gold/5 transition-colors"
              >
                <Settings size={18} />
                <span className="text-base font-medium">Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-codex-subtext hover:text-red-400 hover:bg-red-500/5 transition-colors text-left w-full"
              >
                <LogOut size={18} />
                <span className="text-base font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
