/**
 * DMWidget — floating real-time 1:1 chat panel.
 *
 * Rendered at the App level, outside BrowserRouter, so it persists across all
 * page navigations. The panel sits fixed at bottom-right.
 *
 * Two views (controlled by activeUserId in DMContext):
 *   1. Conversation list   — all open DM threads with unread badges
 *   2. Chat pane           — active thread with message history + input
 *
 * Opening a DM from elsewhere: call openDM(userId, username) from useDM().
 * The widget auto-opens and focuses that conversation.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, ChevronLeft, Send, Search, UserPlus } from 'lucide-react'
import { useDM } from '../../context/DMContext'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { api } from '../../utils/api'
import DiceRollBubble from '../chat/DiceRollBubble'
import { parseDiceCommand, rollDice, buildDiceMetadata, formatDiceBody } from '../../utils/dice'

export default function DMWidget() {
  const { user }       = useAuth()
  const { connected }  = useSocket()
  const {
    openConvos, activeUserId, messages, unread, totalUnread,
    widgetOpen, openDM, closeDM, sendDM, switchTo, toggleWidget,
  } = useDM()

  // Only render for authenticated users
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
        {widgetOpen
          ? <X size={18} />
          : <MessageCircle size={18} />
        }
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
        <div className="fixed bottom-20 right-5 z-50 w-80 h-[460px]
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
            : <ConvoList
                openConvos={openConvos}
                unread={unread}
                onSelect={(userId, username) => switchTo(userId)}
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

// ─── Conversation list ────────────────────────────────────────────────────────
function ConvoList({ openConvos, unread, onSelect, onClose, onNewDM, closeDM }) {
  const [searching, setSearching]   = useState(false)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [searchErr, setSearchErr]   = useState('')
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
    setSearching(false)
    setQuery('')
    setResults([])
    onNewDM(userId, username)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-codex-border">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-codex-gold" />
          <span className="text-sm font-semibold text-codex-text">Direct Messages</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSearching(s => !s); setQuery(''); setResults([]) }}
            className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
            title="New message"
          >
            <UserPlus size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* New DM search */}
      {searching && (
        <div className="px-3 pt-3 pb-2 border-b border-codex-border">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-codex-muted" />
            <input
              autoFocus
              value={query}
              onChange={handleQueryChange}
              placeholder="Search username…"
              className="w-full bg-codex-bg border border-codex-border rounded-lg pl-8 pr-3 py-1.5
                text-sm text-codex-text placeholder-codex-muted
                focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20
                transition-colors"
            />
          </div>
          {searchErr && <p className="text-xs text-red-400 mt-1 px-1">{searchErr}</p>}
          {results.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {results.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => startConvo(u.id, u.username)}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-codex-text
                      hover:bg-codex-bg transition-colors"
                  >
                    {u.username}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && results.length === 0 && !searchErr && (
            <p className="text-xs text-codex-muted mt-1.5 px-1">No users found.</p>
          )}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {openConvos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <MessageCircle size={28} className="text-codex-muted opacity-40" />
            <p className="text-xs text-codex-muted">
              No conversations yet. Click <span className="text-codex-gold">+</span> to start one.
            </p>
          </div>
        ) : (
          <ul className="py-2 flex flex-col">
            {openConvos.map(({ userId, username }) => {
              const count = unread[userId] ?? 0
              return (
                <li key={userId} className="group relative">
                  <button
                    onClick={() => onSelect(userId, username)}
                    className="w-full flex items-center gap-3 px-4 py-2.5
                      hover:bg-codex-bg transition-colors text-left"
                  >
                    {/* Avatar */}
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
                  {/* Close button on hover */}
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

// ─── Chat pane ────────────────────────────────────────────────────────────────
function ChatPane({ targetUserId, targetUsername, msgs, connected, user, onBack, onClose, sendDM }) {
  const { socket } = useSocket()
  const [input, setInput]     = useState('')
  const [sending, setSending] = useState(false)
  const [chatErr, setChatErr] = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

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

    // Dice command: /XdY
    const dice = parseDiceCommand(raw)
    if (dice) {
      const rolls    = rollDice(dice.count, dice.sides)
      const metadata = buildDiceMetadata(dice.count, dice.sides, rolls)
      const body     = formatDiceBody(user?.username ?? 'Someone', metadata)
      // Pass metadata through DMContext → socket
      if (socket) {
        socket.emit('send_dm', { targetUserId, body, metadata }, ({ ok, error } = {}) => {
          setSending(false)
          if (error) setChatErr(error)
          else { setInput(''); inputRef.current?.focus() }
        })
      } else {
        setSending(false)
      }
      return
    }

    sendDM(targetUserId, raw, ({ ok, error }) => {
      setSending(false)
      if (error) {
        setChatErr(error)
      } else {
        setInput('')
        inputRef.current?.focus()
      }
    })
  }, [input, sending, connected, targetUserId, sendDM, user, socket])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const isLoading = msgs === null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-codex-border">
        <button
          onClick={onBack}
          className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
          title="Back to conversations"
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
        <button
          onClick={onClose}
          className="p-1.5 text-codex-muted hover:text-codex-text hover:bg-codex-bg rounded-lg transition-colors"
        >
          <X size={14} />
        </button>
      </div>

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
          // Dice roll — full-width announcement
          if (msg.metadata?.type === 'dice') {
            return <DiceRollBubble key={msg.id} message={msg} />
          }

          const isMine = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                text-[10px] font-bold uppercase select-none
                ${isMine
                  ? 'bg-codex-gold/20 text-codex-gold border border-codex-gold/30'
                  : 'bg-codex-bg text-codex-subtext border border-codex-border'
                }`}>
                {msg.sender_username?.[0] ?? '?'}
              </div>

              {/* Bubble */}
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

      {/* Error */}
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

// ─── Timestamp ───────────────────────────────────────────────────────────────
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
