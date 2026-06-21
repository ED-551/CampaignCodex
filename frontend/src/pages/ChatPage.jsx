/**
 * ChatPage — Public Chatrooms at /chat
 *
 * Two views:
 *  1. Room selection — grid of 6 themed rooms with live occupant counts
 *  2. Room view      — message feed + "Who's Here" sidebar
 *
 * Messages are ephemeral (no DB). The server broadcasts to Socket.io rooms
 * and forgets — chats reset when the server restarts, matching the casual
 * tavern-hangout feel for public rooms.
 *
 * Lobby pattern:
 *  - On mount, join_lobby → receive room list + counts
 *  - While in lobby, room_counts_update events keep counts live
 *  - On room enter, leave_lobby + join_public_room → receive current occupants
 *  - On room exit, leave_public_room + join_lobby again
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Send, Users, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import DiceRollBubble from '../components/chat/DiceRollBubble'
import TierBadge from '../components/ui/TierBadge'
import { parseDiceCommand, rollDice, buildDiceMetadata, formatDiceBody } from '../utils/dice'

// ─── Room metadata (mirrors the server's PUBLIC_ROOMS map) ───────────────────
// This is display-only — the authoritative definition lives in socket.js.
// Room IDs here are just used for routing locally on the client.
const ROOM_FALLBACK = [
  { id: 'tavern',   name: 'The Wyrm Wood Tavern', description: 'General hangout — all are welcome',   icon: '🍺' },
  { id: 'arcane',   name: 'The Arcane Library',   description: 'Shadowdark discussion',                icon: '📚' },
  { id: 'boneyard', name: 'The Bone Yard',         description: 'Mörk Borg discussion',                icon: '💀' },
  { id: 'nimble',   name: 'The Nimble Path',       description: 'Nimble RPG discussion',               icon: '🛡️' },
  { id: 'warroom',  name: "The GM's War Room",     description: 'Game master strategy & advice',       icon: '⚔️' },
  { id: 'recruit',  name: "The Recruit's Tent",    description: 'New players, character help',         icon: '🪄' },
]

// ─── View discriminator ───────────────────────────────────────────────────────
// null            → room selection screen
// { type:'room', ...roomData }      → inside a public chat room
// { type:'spectator', ...session }  → watching a live campaign session

export default function ChatPage() {
  const { user }              = useAuth()
  const { socket, connected } = useSocket()

  const [rooms,             setRooms]             = useState(ROOM_FALLBACK.map(r => ({ ...r, count: 0 })))
  const [spectatorSessions, setSpectatorSessions] = useState([])
  const [activeView,        setActiveView]        = useState(null)  // null | { type, ... }

  // ── Join lobby on mount / when socket connects ──────────────────────────────
  useEffect(() => {
    if (!socket || !connected) return
    if (activeView) return  // inside a room or spectating — don't re-join lobby

    socket.emit('join_lobby', {}, ({ rooms: serverRooms, spectatorSessions: liveSessions } = {}) => {
      if (serverRooms)    setRooms(serverRooms)
      if (liveSessions)   setSpectatorSessions(liveSessions)
      // (inLobby flag not strictly needed for UI — activeView being null means we're in lobby)
    })

    function handleCountsUpdate(counts) {
      setRooms(prev => prev.map(r => ({ ...r, count: counts[r.id] ?? r.count })))
    }
    function handleSpectatorSessionsUpdate(sessions) {
      setSpectatorSessions(sessions)
    }

    socket.on('room_counts_update',        handleCountsUpdate)
    socket.on('spectator_sessions_update', handleSpectatorSessionsUpdate)

    return () => {
      socket.off('room_counts_update',        handleCountsUpdate)
      socket.off('spectator_sessions_update', handleSpectatorSessionsUpdate)
      socket.emit('leave_lobby')
    }
  }, [socket, connected, activeView])

  // ── Enter a public room ─────────────────────────────────────────────────────
  function enterRoom(room) {
    if (!socket || !connected) return
    socket.emit('leave_lobby')
    socket.emit('join_public_room', { roomId: room.id }, ({ occupants, error }) => {
      if (error) return
      setActiveView({ type: 'room', ...room, occupants: occupants ?? [] })
    })
  }

  // ── Leave a public room ─────────────────────────────────────────────────────
  function exitRoom() {
    if (!socket || !activeView) return
    socket.emit('leave_public_room', { roomId: activeView.id })
    setActiveView(null)
  }

  // ── Enter a spectator session ───────────────────────────────────────────────
  function enterSpectator(session) {
    if (!socket || !connected) return
    socket.emit('leave_lobby')
    socket.emit('join_spectator', { campaignId: session.campaignId }, ({ campaignName, gmUsername, error }) => {
      if (error) {
        // Session may have ended — refresh lobby
        setActiveView(null)
        return
      }
      setActiveView({
        type:         'spectator',
        campaignId:   session.campaignId,
        campaignName: campaignName ?? session.campaignName,
        gmUsername:   gmUsername   ?? session.gmUsername,
      })
    })
  }

  // ── Leave a spectator session ───────────────────────────────────────────────
  function exitSpectator() {
    if (!socket || !activeView) return
    socket.emit('leave_spectator', { campaignId: activeView.campaignId })
    setActiveView(null)
  }

  // Determine current page title breadcrumb
  let breadcrumb = null
  if (activeView?.type === 'room') breadcrumb = activeView.name
  if (activeView?.type === 'spectator') breadcrumb = `⚔️ ${activeView.campaignName}`

  return (
    <div className="min-h-screen bg-codex-bg flex flex-col">
      {/* Nav */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
          <span className="text-codex-border">/</span>
          <span className="text-sm text-codex-subtext">Chatrooms</span>
          {breadcrumb && (
            <>
              <span className="text-codex-border">/</span>
              <span className="text-sm text-codex-text">{breadcrumb}</span>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      {activeView?.type === 'room' ? (
        <RoomView
          room={activeView}
          socket={socket}
          connected={connected}
          user={user}
          onExit={exitRoom}
        />
      ) : activeView?.type === 'spectator' ? (
        <SpectatorView
          session={activeView}
          socket={socket}
          connected={connected}
          onExit={exitSpectator}
        />
      ) : (
        <RoomSelection
          rooms={rooms}
          spectatorSessions={spectatorSessions}
          connected={connected}
          onEnter={enterRoom}
          onSpectate={enterSpectator}
        />
      )}
    </div>
  )
}

// ─── Room Selection ───────────────────────────────────────────────────────────
function RoomSelection({ rooms, spectatorSessions, connected, onEnter, onSpectate }) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-codex-text">Public Chatrooms</h1>
        <p className="text-sm text-codex-subtext mt-1">
          Choose a room to enter. Conversations are live — messages vanish when you leave.
        </p>
        {!connected && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Connecting to chat server…
          </div>
        )}
      </div>

      {/* ── Live Sessions — spectator mode campaigns ── */}
      {spectatorSessions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={13} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-codex-text">Live Games</h2>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {spectatorSessions.map(session => (
              <button
                key={session.campaignId}
                onClick={() => connected && onSpectate(session)}
                disabled={!connected}
                className="group flex flex-col items-start gap-2 p-4 text-left
                  bg-emerald-500/5 border border-emerald-500/25 rounded-xl
                  hover:border-emerald-400/50 hover:bg-emerald-500/10
                  transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                  {session.spectatorCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-codex-muted">
                      <Eye size={10} />
                      {session.spectatorCount} watching
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-codex-text group-hover:text-emerald-300 transition-colors">
                    ⚔️ {session.campaignName}
                  </p>
                  <p className="text-xs text-codex-muted mt-0.5">
                    GM: {session.gmUsername}
                  </p>
                </div>
                <div className="text-[10px] text-codex-muted group-hover:text-emerald-400/70 transition-colors mt-auto">
                  Click to watch →
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Standard public rooms ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => connected && onEnter(room)}
            disabled={!connected}
            className="group flex flex-col items-start gap-3 p-5 bg-codex-surface border border-codex-border
              rounded-xl text-left transition-all duration-150
              hover:border-codex-gold hover:bg-codex-card hover:shadow-lg
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {/* Icon + count row */}
            <div className="w-full flex items-center justify-between">
              <span className="text-3xl">{room.icon}</span>
              <div className="flex items-center gap-1.5 text-xs text-codex-muted">
                <Users size={11} />
                <span className={room.count > 0 ? 'text-emerald-400 font-medium' : ''}>
                  {room.count} {room.count === 1 ? 'adventurer' : 'adventurers'}
                </span>
              </div>
            </div>

            {/* Name + description */}
            <div>
              <p className="text-sm font-semibold text-codex-text group-hover:text-codex-gold transition-colors">
                {room.name}
              </p>
              <p className="text-xs text-codex-muted mt-0.5 leading-relaxed">
                {room.description}
              </p>
            </div>

            {/* Enter hint */}
            <div className="text-[10px] text-codex-muted group-hover:text-codex-gold/70 transition-colors mt-auto">
              Click to enter →
            </div>
          </button>
        ))}
      </div>
    </main>
  )
}

// ─── Room View ────────────────────────────────────────────────────────────────
function RoomView({ room, socket, connected, user, onExit }) {
  const [messages,  setMessages]  = useState([])
  const [occupants, setOccupants] = useState(room.occupants ?? [])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [chatErr,   setChatErr]   = useState('')
  const [showWho,   setShowWho]   = useState(false)  // mobile "Who's Here" toggle
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // ── Listen for room events ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    function handleMessage(msg) {
      setMessages(prev => [...prev, msg])
    }
    function handleOccupants(list) {
      setOccupants(list)
    }

    socket.on('room_message',  handleMessage)
    socket.on('room_occupants', handleOccupants)

    return () => {
      socket.off('room_message',  handleMessage)
      socket.off('room_occupants', handleOccupants)
    }
  }, [socket])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback((e) => {
    e.preventDefault()
    const raw = input.trim()
    if (!raw || sending || !connected) return

    setSending(true)
    setChatErr('')

    // Dice command: /XdY
    const dice = parseDiceCommand(raw)
    if (dice) {
      const rolls    = rollDice(dice.count, dice.sides)
      const metadata = buildDiceMetadata(dice.count, dice.sides, rolls)
      const body     = formatDiceBody(user?.username ?? 'Someone', metadata)
      socket.emit('send_public_message', { roomId: room.id, body, metadata }, ({ ok, error }) => {
        setSending(false)
        if (error) setChatErr(error)
        else { setInput(''); inputRef.current?.focus() }
      })
      return
    }

    socket.emit('send_public_message', { roomId: room.id, body: raw }, ({ ok, error }) => {
      setSending(false)
      if (error) setChatErr(error)
      else { setInput(''); inputRef.current?.focus() }
    })
  }, [input, sending, connected, socket, room.id, user])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
  }

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-4 gap-3">

      {/* ── Room header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors"
          >
            <ArrowLeft size={14} /> All Rooms
          </button>
          <span className="text-codex-border">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xl">{room.icon}</span>
            <span className="text-sm font-semibold text-codex-text">{room.name}</span>
          </div>
        </div>

        {/* Mobile — "Who's Here" toggle */}
        <button
          onClick={() => setShowWho(w => !w)}
          className="sm:hidden flex items-center gap-1.5 text-xs text-codex-subtext
            border border-codex-border rounded-lg px-2.5 py-1.5 hover:border-codex-gold transition-colors"
        >
          <Users size={12} />
          {occupants.length}
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* Message feed */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Connection banner */}
          {!connected && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/5
              border border-amber-400/20 text-xs text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Reconnecting to chat…
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-codex-surface border border-codex-border
            rounded-xl p-4 flex flex-col gap-2.5 scroll-smooth">

            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-16">
                <p className="text-xs text-codex-muted italic text-center">
                  {connected
                    ? `${room.name} is quiet. Be the first to speak.`
                    : 'Connecting…'}
                </p>
              </div>
            )}

            {messages.map(msg => {
              // Dice roll — full-width announcement
              if (msg.metadata?.type === 'dice') {
                return <DiceRollBubble key={msg.id} message={msg} />
              }

              const isMine = msg.user_id === user?.id
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                    text-xs font-bold uppercase select-none
                    ${isMine
                      ? 'bg-codex-gold/20 text-codex-gold border border-codex-gold/30'
                      : 'bg-codex-bg text-codex-subtext border border-codex-border'
                    }`}>
                    {msg.username?.[0] ?? '?'}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5">
                      {!isMine && (
                        <>
                          <span className="text-[11px] font-medium text-codex-subtext">{msg.username}</span>
                          <TierBadge tier={msg.supporter_tier ?? 'free'} size={12} />
                        </>
                      )}
                      <span className="text-[10px] text-codex-muted">{formatTime(msg.created_at)}</span>
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

          {/* Error */}
          {chatErr && (
            <p className="text-xs text-red-400 px-1">{chatErr}</p>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); setChatErr('') }}
              onKeyDown={handleKeyDown}
              placeholder={connected ? 'Say something… (Enter to send)' : 'Reconnecting…'}
              disabled={!connected || sending}
              rows={1}
              maxLength={500}
              className="flex-1 resize-none bg-codex-surface border border-codex-border rounded-xl
                px-3 py-2.5 text-sm text-codex-text placeholder-codex-muted
                focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20
                transition-colors disabled:opacity-40 max-h-32 overflow-y-auto"
              style={{ fieldSizing: 'content' }}
            />
            <button
              type="submit"
              disabled={!connected || !input.trim() || sending}
              className="flex-shrink-0 p-3 rounded-xl bg-codex-gold text-codex-bg
                hover:bg-codex-goldHover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {sending
                ? <span className="w-4 h-4 border-2 border-codex-bg/30 border-t-codex-bg rounded-full animate-spin block" />
                : <Send size={15} />
              }
            </button>
          </form>
        </div>

        {/* ── Who's Here sidebar (desktop always visible, mobile toggled) ── */}
        <aside className={`
          ${showWho ? 'flex' : 'hidden'} sm:flex
          flex-col w-44 shrink-0
        `}>
          <div className="bg-codex-surface border border-codex-border rounded-xl p-3 flex flex-col gap-2 h-full">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-codex-gold" />
              <span className="text-xs font-semibold text-codex-text">Who's Here</span>
              <span className="text-xs text-codex-muted ml-auto">{occupants.length}</span>
            </div>
            <div className="h-px bg-codex-border" />
            <ul className="flex flex-col gap-1.5 overflow-y-auto flex-1">
              {occupants.length === 0 && (
                <li className="text-xs text-codex-muted italic px-1">Nobody yet…</li>
              )}
              {occupants.map(occ => (
                <li key={occ.userId} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className={`text-xs truncate ${occ.userId === user?.id ? 'text-codex-gold font-medium' : 'text-codex-subtext'}`}>
                    {occ.username}{occ.userId === user?.id ? ' (you)' : ''}
                  </span>
                  <TierBadge tier={occ.tier ?? 'free'} size={11} />
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── Spectator View ───────────────────────────────────────────────────────────
// Read-only view of a live campaign session. Messages are forwarded from the
// campaign room to the `spectator:<campaignId>` Socket.io room via `room_message`.
// The session may end at any time (GM closes it) — we handle `spectator_ended`.
function SpectatorView({ session, socket, connected, onExit }) {
  const [messages, setMessages] = useState([])
  const [ended,    setEnded]    = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    function handleMessage(msg) {
      setMessages(prev => [...prev, msg])
    }
    function handleEnded({ campaignId }) {
      if (campaignId !== session.campaignId) return
      setEnded(true)
    }
    // spectator_count_update is handled in ChatPage (lobby) — no action needed here

    socket.on('room_message',    handleMessage)
    socket.on('spectator_ended', handleEnded)

    return () => {
      socket.off('room_message',    handleMessage)
      socket.off('spectator_ended', handleEnded)
    }
  }, [socket, session.campaignId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-4 gap-3">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-text transition-colors shrink-0"
        >
          <ArrowLeft size={14} /> All Rooms
        </button>
        <span className="text-codex-border">|</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-sm font-semibold text-codex-text truncate">
            ⚔️ {session.campaignName}
          </span>
          <span className="text-xs text-codex-muted shrink-0">— GM: {session.gmUsername}</span>
        </div>
        <div className="ml-auto shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
            Spectator
          </span>
        </div>
      </div>

      {/* ── Session ended notice ── */}
      {ended && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
          bg-codex-surface border border-codex-border text-sm text-codex-subtext">
          <span>The GM has ended this session. No new messages will arrive.</span>
          <button
            onClick={onExit}
            className="shrink-0 text-codex-gold hover:text-codex-goldHover text-xs font-semibold"
          >
            Return to rooms →
          </button>
        </div>
      )}

      {/* ── Message feed — read only ── */}
      <div className="flex-1 overflow-y-auto bg-codex-surface border border-codex-border
        rounded-xl p-4 flex flex-col gap-2.5 scroll-smooth">

        {messages.length === 0 && !ended && (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-xs text-codex-muted italic text-center">
              {connected
                ? 'Waiting for the party to speak… Messages will appear here live.'
                : 'Reconnecting to chat…'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.metadata?.type === 'dice') {
            return <DiceRollBubble key={msg.id ?? i} message={msg} />
          }
          return (
            <div key={msg.id ?? i} className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-codex-bg border border-codex-border
                flex items-center justify-center text-xs font-bold uppercase text-codex-subtext select-none">
                {msg.username?.[0] ?? '?'}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-medium text-codex-subtext">{msg.username}</span>
                  <span className="text-[10px] text-codex-muted">{formatTime(msg.created_at)}</span>
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm text-sm leading-relaxed
                  whitespace-pre-wrap break-words bg-codex-bg border border-codex-border text-codex-text">
                  {msg.body}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Read-only notice ── */}
      {!ended && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-codex-muted py-1">
          <Eye size={11} />
          You are watching as a spectator — messages are read-only
        </div>
      )}
    </div>
  )
}

// ─── Timestamp ────────────────────────────────────────────────────────────────
function formatTime(ts) {
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
