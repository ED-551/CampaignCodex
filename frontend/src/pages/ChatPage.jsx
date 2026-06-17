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
import { ArrowLeft, BookOpen, Send, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

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

export default function ChatPage() {
  const { user }              = useAuth()
  const { socket, connected } = useSocket()

  const [rooms,         setRooms]         = useState(ROOM_FALLBACK.map(r => ({ ...r, count: 0 })))
  const [activeRoom,    setActiveRoom]    = useState(null)   // { id, name, icon }
  const [inLobby,       setInLobby]       = useState(false)

  // ── Join lobby on mount / when socket connects ──────────────────────────────
  useEffect(() => {
    if (!socket || !connected) return
    if (activeRoom) return  // already inside a room, don't re-join lobby

    socket.emit('join_lobby', {}, ({ rooms: serverRooms } = {}) => {
      if (serverRooms) {
        setRooms(serverRooms)
      }
      setInLobby(true)
    })

    function handleCountsUpdate(counts) {
      setRooms(prev => prev.map(r => ({ ...r, count: counts[r.id] ?? r.count })))
    }
    socket.on('room_counts_update', handleCountsUpdate)

    return () => {
      socket.off('room_counts_update', handleCountsUpdate)
      socket.emit('leave_lobby')
      setInLobby(false)
    }
  }, [socket, connected, activeRoom])

  // ── Enter a room ────────────────────────────────────────────────────────────
  function enterRoom(room) {
    if (!socket || !connected) return
    socket.emit('leave_lobby')
    socket.emit('join_public_room', { roomId: room.id }, ({ occupants, error }) => {
      if (error) return
      setActiveRoom({ ...room, occupants: occupants ?? [] })
      setInLobby(false)
    })
  }

  // ── Leave a room ────────────────────────────────────────────────────────────
  function exitRoom() {
    if (!socket || !activeRoom) return
    socket.emit('leave_public_room', { roomId: activeRoom.id })
    setActiveRoom(null)
  }

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
          {activeRoom && (
            <>
              <span className="text-codex-border">/</span>
              <span className="text-sm text-codex-text">{activeRoom.name}</span>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      {activeRoom
        ? <RoomView
            room={activeRoom}
            socket={socket}
            connected={connected}
            user={user}
            onExit={exitRoom}
          />
        : <RoomSelection
            rooms={rooms}
            connected={connected}
            onEnter={enterRoom}
          />
      }
    </div>
  )
}

// ─── Room Selection ───────────────────────────────────────────────────────────
function RoomSelection({ rooms, connected, onEnter }) {
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
    const body = input.trim()
    if (!body || sending || !connected) return

    setSending(true)
    setChatErr('')
    socket.emit('send_public_message', { roomId: room.id, body }, ({ ok, error }) => {
      setSending(false)
      if (error) setChatErr(error)
      else { setInput(''); inputRef.current?.focus() }
    })
  }, [input, sending, connected, socket, room.id])

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
                    <div className="flex items-baseline gap-1.5">
                      {!isMine && (
                        <span className="text-[11px] font-medium text-codex-subtext">{msg.username}</span>
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
                <li key={occ.userId} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className={`text-xs truncate ${occ.userId === user?.id ? 'text-codex-gold font-medium' : 'text-codex-subtext'}`}>
                    {occ.username}{occ.userId === user?.id ? ' (you)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
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
