/**
 * DMWidget — floating real-time 1:1 chat panel with friends system.
 *
 * Three panels inside the widget (tabbed on the conversation list):
 *   💬 Messages — open DM threads (existing behavior)
 *   👥 Friends  — accepted friends list, click to DM
 *   🔔 Requests — incoming friend requests with Accept/Deny
 *
 * Opening a DM from elsewhere: call openDM(userId, username) from useDM().
 *
 * Block flow (intentionally 3-tap to prevent accidents):
 *   ChatPane header ··· → "Block [username]" → confirm overlay → blocked.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X, ChevronLeft, Send, Search, UserPlus,
         Users, Bell, MoreHorizontal, UserCheck, UserX, Clock, ExternalLink } from 'lucide-react'
import { useDM }     from '../../context/DMContext'
import { useSocial } from '../../context/SocialContext'
import { useAuth }   from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { api }       from '../../utils/api'
import DiceRollBubble from '../chat/DiceRollBubble'
import { parseDiceCommand, rollDice, buildDiceMetadata, formatDiceBody } from '../../utils/dice'

// ─── Tab IDs ─────────────────────────────────────────────────────────────────
const TAB_MESSAGES  = 'messages'
const TAB_FRIENDS   = 'friends'
const TAB_REQUESTS  = 'requests'

export default function DMWidget() {
  const { user }       = useAuth()
  const { connected }  = useSocket()
  const {
    openConvos, activeUserId, messages, unread, totalUnread,
    widgetOpen, openDM, closeDM, sendDM, switchTo, toggleWidget,
  } = useDM()

  if (!user) return null

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={toggleWidget}
        className={`fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${widgetOpen
            ? 'bg-codex-surface border border-codex-border text-codex-muted hover:text-codex-text'
            : 'bg-codex-gold text-codex-bg hover:bg-codex-goldHover'
          }`}
        title={widgetOpen ? 'Close messages' : 'Direct messages'}
      >
        {widgetOpen ? <X size={18} /> : <MessageCircle size={18} />}
        {!widgetOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
            rounded-full bg-red-500 text-white text-[10px] font-bold
            flex items-center justify-center leading-none">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* ── Main panel ── */}
      {widgetOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-80 h-[480px]
          bg-codex-surface border border-codex-border rounded-2xl shadow-2xl
          flex flex-col overflow-hidden">

          {activeUserId
            ? <ChatPane
                targetUserId={activeUserId}
                targetUsername={openConvos.find(c => c.userId === activeUserId)?.username ?? '…'}
                msgs={messages[activeUserId]}
                connected={connected}
                user={user}
                onBack={() => switchTo(null)}
                onClose={() => { closeDM(activeUserId); toggleWidget() }}
                sendDM={sendDM}
              />
            : <ConvoPanel
                openConvos={openConvos}
                unread={unread}
                onSelect={(userId) => switchTo(userId)}
                onClose={toggleWidget}
                onNewDM={openDM}
                closeDM={closeDM}
              />
          }
        </div>
      )}
    </>
  )
}

// ─── Tabbed ConvoPanel ────────────────────────────────────────────────────────
function ConvoPanel({ openConvos, unread, onSelect, onClose, onNewDM, closeDM }) {
  const [tab, setTab] = useState(TAB_MESSAGES)
  const { friends, incomingRequests, totalIncoming,
          respondToRequest, sendFriendRequest, getFriendStatus } = useSocial()
  const { openDM } = useDM()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border">
        <span className="text-sm font-semibold text-codex-text">Messages</span>
        <button
          onClick={onClose}
          className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-codex-border">
        <TabBtn active={tab === TAB_MESSAGES}  onClick={() => setTab(TAB_MESSAGES)}>
          <MessageCircle size={12} /> DMs
          {Object.values(unread).reduce((a, b) => a + b, 0) > 0 && (
            <span className="ml-1 text-[10px] font-bold text-codex-gold">
              {Object.values(unread).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === TAB_FRIENDS}   onClick={() => setTab(TAB_FRIENDS)}>
          <Users size={12} /> Friends
          <span className="ml-1 text-[10px] text-codex-muted">{friends.length}</span>
        </TabBtn>
        <TabBtn active={tab === TAB_REQUESTS}  onClick={() => setTab(TAB_REQUESTS)}>
          <Bell size={12} /> Requests
          {totalIncoming > 0 && (
            <span className="ml-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-codex-gold
              text-codex-bg text-[9px] font-bold flex items-center justify-center">
              {totalIncoming}
            </span>
          )}
        </TabBtn>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === TAB_MESSAGES && (
          <MessagesTab
            openConvos={openConvos}
            unread={unread}
            onSelect={onSelect}
            closeDM={closeDM}
            onNewDM={onNewDM}
          />
        )}
        {tab === TAB_FRIENDS && (
          <FriendsTab
            friends={friends}
            onDM={(friendId, friendUsername) => { openDM(friendId, friendUsername); onSelect(friendId) }}
          />
        )}
        {tab === TAB_REQUESTS && (
          <RequestsTab
            requests={incomingRequests}
            onRespond={respondToRequest}
          />
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium
        border-b-2 transition-colors
        ${active
          ? 'border-codex-gold text-codex-gold'
          : 'border-transparent text-codex-muted hover:text-codex-subtext'
        }`}
    >
      {children}
    </button>
  )
}

// ─── Messages Tab (existing DM thread list + search) ─────────────────────────
function MessagesTab({ openConvos, unread, onSelect, closeDM, onNewDM }) {
  const [searching, setSearching] = useState(false)
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState([])
  const [searchErr, setSearchErr] = useState('')
  const { getFriendStatus, sendFriendRequest, outgoingSet } = useSocial()
  const [requestingId, setRequestingId] = useState(null)
  const debounceRef = useRef(null)

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    setSearchErr('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const { users } = await api.get(`/users/search?q=${encodeURIComponent(val.trim())}`)
        setResults(users)
      } catch (err) {
        setSearchErr(err.message || 'Search failed.')
      }
    }, 300)
  }

  function startConvo(userId, username) {
    setSearching(false); setQuery(''); setResults([])
    onNewDM(userId, username)
  }

  async function handleSendRequest(userId) {
    setRequestingId(userId)
    try { await sendFriendRequest(userId) } catch {}
    setRequestingId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* New message search toggle */}
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
        <span className="text-[11px] text-codex-muted uppercase tracking-wider font-medium">
          Conversations
        </span>
        <button
          onClick={() => { setSearching(s => !s); setQuery(''); setResults([]) }}
          className="p-1.5 text-codex-muted hover:text-codex-gold hover:bg-codex-bg rounded-lg transition-colors"
          title="New message / find user"
        >
          <UserPlus size={13} />
        </button>
      </div>

      {/* Search */}
      {searching && (
        <div className="px-3 pb-2 border-b border-codex-border">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-codex-muted" />
            <input
              autoFocus
              value={query}
              onChange={handleQueryChange}
              placeholder="Search username…"
              className="w-full bg-codex-bg border border-codex-border rounded-lg pl-7 pr-3 py-1.5
                text-xs text-codex-text placeholder-codex-muted
                focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20"
            />
          </div>
          {searchErr && <p className="text-[10px] text-red-400 mt-1 px-1">{searchErr}</p>}
          {results.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {results.map(u => {
                const status = getFriendStatus(u.id)
                return (
                  <li key={u.id} className="flex items-center gap-1">
                    <button
                      onClick={() => startConvo(u.id, u.username)}
                      className="flex-1 text-left px-2 py-1.5 rounded-lg text-xs text-codex-text hover:bg-codex-bg transition-colors truncate"
                    >
                      {u.username}
                    </button>
                    {/* Friend request button */}
                    {status === 'none' && (
                      <button
                        onClick={() => handleSendRequest(u.id)}
                        disabled={requestingId === u.id}
                        className="flex-shrink-0 p-1.5 rounded-lg text-codex-muted hover:text-codex-gold hover:bg-codex-bg transition-colors disabled:opacity-40"
                        title="Send friend request"
                      >
                        <UserPlus size={12} />
                      </button>
                    )}
                    {status === 'request_sent' && (
                      <span className="flex-shrink-0 p-1.5 text-codex-muted" title="Request pending">
                        <Clock size={12} />
                      </span>
                    )}
                    {status === 'friends' && (
                      <span className="flex-shrink-0 p-1.5 text-emerald-400" title="Already friends">
                        <UserCheck size={12} />
                      </span>
                    )}
                    {status === 'request_received' && (
                      <span className="flex-shrink-0 text-[10px] text-codex-gold px-1">Sent you a request</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {query.trim() && results.length === 0 && !searchErr && (
            <p className="text-[10px] text-codex-muted mt-1.5 px-1">No users found.</p>
          )}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {openConvos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <MessageCircle size={28} className="text-codex-muted opacity-40" />
            <p className="text-xs text-codex-muted">
              No conversations yet. Click <span className="text-codex-gold">+</span> to find someone.
            </p>
          </div>
        ) : (
          <ul className="py-1 flex flex-col">
            {openConvos.map(({ userId, username }) => {
              const count = unread[userId] ?? 0
              return (
                <li key={userId} className="group relative">
                  <button
                    onClick={() => onSelect(userId)}
                    className="w-full flex items-center gap-3 px-4 py-2.5
                      hover:bg-codex-bg transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-codex-bg border border-codex-border
                      flex items-center justify-center text-sm font-bold text-codex-subtext uppercase">
                      {username[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${count > 0 ? 'font-semibold text-codex-text' : 'text-codex-text'}`}>
                        {username}
                      </p>
                    </div>
                    {count > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1
                        rounded-full bg-codex-gold text-codex-bg text-[10px] font-bold
                        flex items-center justify-center leading-none">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); closeDM(userId) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                      text-codex-muted hover:text-red-400 rounded transition-colors
                      opacity-0 group-hover:opacity-100"
                    title="Close conversation"
                  >
                    <X size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Friends Tab ──────────────────────────────────────────────────────────────
function FriendsTab({ friends, onDM }) {
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <Users size={28} className="text-codex-muted opacity-40" />
        <p className="text-xs text-codex-muted">
          No friends yet. Search for a user and send a friend request.
        </p>
      </div>
    )
  }

  return (
    <ul className="py-1 flex flex-col overflow-y-auto h-full">
      {friends.map(f => (
        <li key={f.friend_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-codex-bg transition-colors">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-codex-bg border border-codex-border
            flex items-center justify-center text-sm font-bold text-codex-subtext uppercase">
            {f.friend_username[0]}
          </div>
          <span className="flex-1 text-sm text-codex-text truncate">{f.friend_username}</span>
          <button
            onClick={() => onDM(f.friend_id, f.friend_username)}
            className="flex-shrink-0 p-1.5 rounded-lg text-codex-muted hover:text-codex-gold
              hover:bg-codex-gold/10 transition-colors"
            title={`Message ${f.friend_username}`}
          >
            <MessageCircle size={13} />
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────
function RequestsTab({ requests, onRespond }) {
  const [responding, setResponding] = useState(null)

  async function handle(requestId, action) {
    setResponding(requestId)
    try { await onRespond(requestId, action) } catch {}
    setResponding(null)
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <Bell size={28} className="text-codex-muted opacity-40" />
        <p className="text-xs text-codex-muted">No pending friend requests.</p>
      </div>
    )
  }

  return (
    <ul className="py-1 flex flex-col overflow-y-auto h-full">
      {requests.map(r => (
        <li key={r.id} className="flex items-start gap-3 px-4 py-3 border-b border-codex-border/50">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-codex-bg border border-codex-border
            flex items-center justify-center text-sm font-bold text-codex-subtext uppercase">
            {r.sender_username[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-codex-text font-medium truncate">{r.sender_username}</p>
            <p className="text-[10px] text-codex-muted mt-0.5">Wants to be your friend</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handle(r.id, 'accepted')}
                disabled={responding === r.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium
                  bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                  hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
              >
                <UserCheck size={11} /> Accept
              </button>
              <button
                onClick={() => handle(r.id, 'denied')}
                disabled={responding === r.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium
                  bg-codex-bg text-codex-muted border border-codex-border
                  hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-40"
              >
                <UserX size={11} /> Deny
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Chat pane ────────────────────────────────────────────────────────────────
function ChatPane({ targetUserId, targetUsername, msgs, connected, user, onBack, onClose, sendDM }) {
  const { socket } = useSocket()
  const { getFriendStatus, sendFriendRequest, unfriend, blockUser, outgoingSet } = useSocial()
  const { closeDM } = useDM()
  const navigate = useNavigate()

  const [input,       setInput]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [chatErr,     setChatErr]     = useState('')
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [blocking,    setBlocking]    = useState(false)
  const [friendLoading, setFriendLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const menuRef   = useRef(null)

  const friendStatus = getFriendStatus(targetUserId)

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const handleSend = useCallback((e) => {
    e.preventDefault()
    const raw = input.trim()
    if (!raw || sending || !connected) return

    setSending(true)
    setChatErr('')

    const dice = parseDiceCommand(raw)
    if (dice) {
      const rolls    = rollDice(dice.count, dice.sides)
      const metadata = buildDiceMetadata(dice.count, dice.sides, rolls)
      const body     = formatDiceBody(user?.username ?? 'Someone', metadata)
      if (socket) {
        socket.emit('send_dm', { targetUserId, body, metadata }, ({ ok, error } = {}) => {
          setSending(false)
          if (error) setChatErr(error)
          else { setInput(''); inputRef.current?.focus() }
        })
      } else { setSending(false) }
      return
    }

    sendDM(targetUserId, raw, ({ ok, error }) => {
      setSending(false)
      if (error) setChatErr(error)
      else { setInput(''); inputRef.current?.focus() }
    })
  }, [input, sending, connected, targetUserId, sendDM, user, socket])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
  }

  async function handleFriendAction() {
    setMenuOpen(false)
    setFriendLoading(true)
    try {
      if (friendStatus === 'friends') {
        await unfriend(targetUserId)
      } else {
        await sendFriendRequest(targetUserId)
      }
    } catch {}
    setFriendLoading(false)
  }

  async function handleBlock() {
    setBlocking(true)
    try {
      await blockUser(targetUserId)
      closeDM(targetUserId)
      onBack()
    } catch {}
    setBlocking(false)
    setConfirmBlock(false)
  }

  const isLoading = msgs === null

  // Friend action label
  const friendLabel = () => {
    if (friendLoading) return '…'
    if (friendStatus === 'friends')          return 'Unfriend'
    if (friendStatus === 'request_sent')     return 'Request Sent'
    if (friendStatus === 'request_received') return 'Accept Request'
    return 'Add Friend'
  }
  const FriendIcon = () => {
    if (friendStatus === 'friends')          return <UserX size={13} />
    if (friendStatus === 'request_sent')     return <Clock size={13} />
    if (friendStatus === 'request_received') return <UserCheck size={13} />
    return <UserPlus size={13} />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-codex-border">
        <button
          onClick={onBack}
          className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
          title="Back"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="w-7 h-7 rounded-full bg-codex-bg border border-codex-border
          flex items-center justify-center text-xs font-bold text-codex-subtext uppercase flex-shrink-0">
          {targetUsername[0]}
        </div>
        <span className="text-sm font-semibold text-codex-text flex-1 truncate">
          {targetUsername}
        </span>

        {/* ··· overflow menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(o => !o); setConfirmBlock(false) }}
            className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
            title="More options"
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && !confirmBlock && (
            <div className="absolute right-0 top-8 w-44 bg-codex-card border border-codex-border
              rounded-xl shadow-xl z-10 py-1 flex flex-col overflow-hidden">
              {/* View Profile */}
              <button
                onClick={() => { setMenuOpen(false); navigate(`/profile/${targetUsername}`) }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-codex-text
                  hover:bg-codex-bg transition-colors text-left"
              >
                <ExternalLink size={13} />
                View Profile
              </button>

              {/* Friend action */}
              <button
                onClick={handleFriendAction}
                disabled={friendLoading || friendStatus === 'request_sent'}
                className="flex items-center gap-2 px-3 py-2 text-xs text-codex-text
                  hover:bg-codex-bg transition-colors disabled:opacity-50 text-left"
              >
                <FriendIcon />
                {friendLabel()}
              </button>

              <div className="h-px bg-codex-border mx-2 my-1" />

              {/* Block — visually separated and muted-red */}
              <button
                onClick={() => { setMenuOpen(false); setConfirmBlock(true) }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400/70
                  hover:text-red-400 hover:bg-red-500/5 transition-colors text-left"
              >
                <UserX size={13} />
                Block {targetUsername}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Block confirmation overlay */}
      {confirmBlock && (
        <div className="absolute inset-0 z-20 bg-codex-bg/90 backdrop-blur-sm flex flex-col
          items-center justify-center gap-4 px-6 text-center rounded-2xl">
          <UserX size={28} className="text-red-400" />
          <div>
            <p className="text-sm font-semibold text-codex-text mb-1">Block {targetUsername}?</p>
            <p className="text-xs text-codex-subtext leading-relaxed">
              They won't be able to message you or see your profile. You can unblock them from your settings later.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setConfirmBlock(false)}
              className="flex-1 py-2 rounded-lg border border-codex-border text-xs text-codex-subtext
                hover:text-codex-text hover:border-codex-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="flex-1 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-xs
                font-semibold text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-40"
            >
              {blocking ? 'Blocking…' : 'Block'}
            </button>
          </div>
        </div>
      )}

      {/* Connection status */}
      {!connected && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-codex-muted bg-codex-bg/40 border-b border-codex-border">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse" />
          Reconnecting…
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 scroll-smooth">
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-codex-muted animate-pulse">Loading…</p>
          </div>
        )}
        {!isLoading && msgs?.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-codex-muted italic text-center px-4">
              No messages yet. Say something to {targetUsername}.
            </p>
          </div>
        )}
        {!isLoading && msgs?.map(msg => {
          if (msg.metadata?.type === 'dice') {
            return <DiceRollBubble key={msg.id} message={msg} />
          }
          const isMine = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                text-[10px] font-bold uppercase select-none
                ${isMine
                  ? 'bg-codex-gold/20 text-codex-gold border border-codex-gold/30'
                  : 'bg-codex-bg text-codex-subtext border border-codex-border'
                }`}>
                {msg.sender_username?.[0] ?? '?'}
              </div>
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-codex-muted">{formatDMTime(msg.created_at)}</span>
                <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words
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

      {chatErr && (
        <div className="mx-3 mb-1 text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-2.5 py-1.5">
          {chatErr}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-end gap-2 px-3 py-3 border-t border-codex-border">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setChatErr('') }}
          onKeyDown={handleKeyDown}
          placeholder={connected ? `Message ${targetUsername}…` : 'Reconnecting…'}
          disabled={!connected || sending}
          rows={1}
          maxLength={1000}
          className="flex-1 resize-none bg-codex-bg border border-codex-border rounded-xl px-3 py-1.5
            text-xs text-codex-text placeholder-codex-muted
            focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20
            transition-colors disabled:opacity-40 max-h-24 overflow-y-auto"
          style={{ fieldSizing: 'content' }}
        />
        <button
          type="submit"
          disabled={!connected || !input.trim() || sending}
          className="flex-shrink-0 p-2 rounded-xl bg-codex-gold text-codex-bg
            hover:bg-codex-goldHover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {sending
            ? <span className="w-3.5 h-3.5 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin block" />
            : <Send size={13} />
          }
        </button>
      </form>
    </div>
  )
}

// ─── Timestamp ────────────────────────────────────────────────────────────────
function formatDMTime(ts) {
  if (!ts) return ''
  const d   = new Date(ts)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
