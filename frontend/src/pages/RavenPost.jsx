import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  BookOpen, ArrowLeft, Send, Trash2, Reply,
  Feather, Inbox, Mail, Settings, LogOut, Shield, ChevronLeft,
  ChevronDown, ChevronUp, Scroll,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import TierBadge from '../components/ui/TierBadge'

const GAME_LABELS = {
  shadowdark: 'Shadowdark',
  morkborg:   'Mörk Borg',
  nimble:     'Nimble RPG',
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr) {
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Going Postal stamp header ────────────────────────────────────────────────
function PostalStamp() {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-codex-border">
      {/* Outer stamp frame with perforated-edge effect */}
      <div className="relative border-2 border-dashed border-codex-gold/50 rounded-sm px-3 py-3 bg-codex-gold/3">
        {/* Corner ornaments */}
        <span className="absolute top-1 left-1.5 text-[9px] text-codex-gold/40 select-none">✦</span>
        <span className="absolute top-1 right-1.5 text-[9px] text-codex-gold/40 select-none">✦</span>
        <span className="absolute bottom-1 left-1.5 text-[9px] text-codex-gold/40 select-none">✦</span>
        <span className="absolute bottom-1 right-1.5 text-[9px] text-codex-gold/40 select-none">✦</span>

        {/* Issuing authority */}
        <p className="text-center text-[8px] uppercase tracking-[0.25em] text-codex-muted mb-1.5 select-none">
          CampaignCodex Postal Service
        </p>

        {/* Main emblem */}
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <Feather size={13} className="text-codex-gold/70 shrink-0" />
          <span className="font-display text-codex-gold text-sm tracking-widest uppercase">
            The Raven Post
          </span>
          <Feather size={13} className="text-codex-gold/70 shrink-0 scale-x-[-1]" />
        </div>

        {/* Divider rule */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex-1 h-px bg-codex-gold/20" />
          <span className="text-codex-gold/30 text-[8px] select-none">◆</span>
          <div className="flex-1 h-px bg-codex-gold/20" />
        </div>

        {/* Denomination / value line */}
        <p className="text-center text-[8px] tracking-[0.15em] text-codex-muted/70 select-none">
          ONE RAVEN · OFFICIAL DISPATCH
        </p>
      </div>

      {/* Motto below stamp */}
      <p className="text-[9px] text-codex-muted/60 text-center italic leading-relaxed mt-2 px-1 select-none">
        "Neither snow nor rain nor fell dragon-fire shall stay these ravens from their appointed rounds."
      </p>
    </div>
  )
}

// ─── Postmark decoration for message header ───────────────────────────────────
function Postmark({ date }) {
  const d = new Date(date)
  const day = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <div className="flex-shrink-0 w-14 h-14 rounded-full border-2 border-codex-gold/25
      flex flex-col items-center justify-center text-center rotate-[-12deg] select-none
      bg-codex-gold/3">
      <span className="text-[7px] font-bold uppercase tracking-widest text-codex-gold/40 leading-none">Raven</span>
      <span className="text-[7px] uppercase tracking-widest text-codex-gold/40 leading-none">Post</span>
      <div className="w-8 h-px bg-codex-gold/20 my-0.5" />
      <span className="text-[7px] text-codex-muted/60 leading-none">{day}</span>
    </div>
  )
}

// ─── Message List Item ────────────────────────────────────────────────────────
function MessageListItem({ message, isSelected, onClick, isInbox }) {
  const isUnread  = isInbox && !message.read_at
  const otherUser = isInbox ? message.sender_username : message.recipient_username

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-codex-border transition-all duration-100
        ${isSelected
          ? 'bg-codex-gold/10 border-l-2 border-l-codex-gold'
          : 'hover:bg-codex-surface/60 border-l-2 border-l-transparent'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`flex items-center gap-1 text-sm truncate ${isUnread ? 'font-semibold text-codex-text' : 'text-codex-subtext'}`}>
          {otherUser}
          {isInbox && <TierBadge tier={message.sender_supporter_tier ?? 'free'} size={12} />}
        </span>
        <span className="text-[11px] text-codex-muted shrink-0">{formatDate(message.created_at)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-codex-gold shrink-0" />}
        <p className={`text-xs truncate ${isUnread ? 'text-codex-text font-medium' : 'text-codex-muted'}`}>
          {message.subject}
        </p>
      </div>
      {message.character_name && (
        <p className="text-[10px] text-codex-muted mt-1 truncate">📜 {message.character_name}</p>
      )}
    </button>
  )
}

// ─── Collapsed thread item ────────────────────────────────────────────────────
function ThreadMessage({ msg }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-codex-border/60 rounded-lg overflow-hidden bg-codex-bg/40">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left
          hover:bg-codex-surface/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Feather size={11} className="text-codex-muted shrink-0" />
          <span className="text-xs text-codex-subtext font-medium truncate">{msg.sender_username}</span>
          <span className="text-[10px] text-codex-muted shrink-0">{formatDateFull(msg.created_at)}</span>
        </div>
        {expanded
          ? <ChevronUp size={12} className="text-codex-muted shrink-0" />
          : <ChevronDown size={12} className="text-codex-muted shrink-0" />
        }
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-codex-border/40">
          {msg.character_name && (
            <div className="flex items-center gap-1.5 mb-2 text-[10px] text-codex-muted">
              <Scroll size={10} />
              <span>{msg.character_name}</span>
              <span>· {GAME_LABELS[msg.character_game_system] ?? msg.character_game_system}</span>
            </div>
          )}
          <pre className="text-xs text-codex-subtext whitespace-pre-wrap font-sans leading-relaxed">
            {msg.body}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Message View ─────────────────────────────────────────────────────────────
function MessageView({ messageId, isInbox, onReply, onDelete, onBack }) {
  const [message, setMessage]   = useState(null)
  const [thread,  setThread]    = useState([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)

  useEffect(() => {
    if (!messageId) return
    setLoading(true)
    setMessage(null)
    setThread([])
    setThreadOpen(false)

    api.get(`/ravens/${messageId}`)
      .then(({ message: msg, thread: t }) => {
        setMessage(msg)
        setThread(t ?? [])
        if (isInbox && !msg.read_at) {
          api.patch(`/ravens/${messageId}/read`).catch(() => {})
        }
      })
      .catch(err => console.error('Failed to load message:', err))
      .finally(() => setLoading(false))
  }, [messageId, isInbox])

  async function handleDelete() {
    if (!message || deleting) return
    if (!confirm('Dismiss this raven? It will be removed from your view.')) return
    setDeleting(true)
    try {
      await api.delete(`/ravens/${message.id}`)
      onDelete(message.id)
    } catch (err) {
      console.error('Failed to delete:', err)
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-codex-muted animate-pulse">Summoning your raven…</p>
    </div>
  )
  if (!message) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-codex-muted">Message not found.</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Letter header — old-fashioned mail aesthetic */}
      <div className="px-6 py-5 border-b border-codex-border">
        {onBack && (
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-codex-muted hover:text-codex-text transition-colors sm:hidden mb-3">
            <ChevronLeft size={14} /> Back
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-codex-text leading-snug flex-1 min-w-0">
            {message.subject}
          </h2>
          {/* Postmark stamp */}
          <Postmark date={message.created_at} />
        </div>

        {/* Formal to/from block */}
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-codex-muted font-medium uppercase tracking-wide text-[10px] pt-0.5">From</span>
          <span className="flex items-center gap-1.5 text-codex-text font-medium">
            {message.sender_username}
            <TierBadge tier={message.sender_supporter_tier ?? 'free'} size={11} />
          </span>
          <span className="text-codex-muted font-medium uppercase tracking-wide text-[10px] pt-0.5">To</span>
          <span className="text-codex-subtext">{message.recipient_username}</span>
          <span className="text-codex-muted font-medium uppercase tracking-wide text-[10px] pt-0.5">Date</span>
          <span className="text-codex-muted">{formatDateFull(message.created_at)}</span>
        </div>

        {/* Character attachment */}
        {message.character_name && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-codex-surface border border-codex-border/60 self-start w-fit">
            <Scroll size={13} className="text-codex-gold/70" />
            <div>
              <p className="text-xs font-medium text-codex-text">{message.character_name}</p>
              <p className="text-[10px] text-codex-muted">{GAME_LABELS[message.character_game_system] ?? message.character_game_system}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          {isInbox && (
            <button onClick={() => onReply(message)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-codex-border
                text-xs text-codex-subtext hover:text-codex-gold hover:border-codex-gold/40 transition-colors">
              <Reply size={12} /> Reply
            </button>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-codex-border
              text-xs text-codex-muted hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-40">
            <Trash2 size={12} /> {deleting ? 'Removing…' : 'Dismiss'}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {/* Current message body */}
        <pre className="text-sm text-codex-text whitespace-pre-wrap font-sans leading-relaxed">
          {message.body}
        </pre>

        {/* Previous correspondence thread */}
        {thread.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setThreadOpen(o => !o)}
              className="flex items-center gap-2 text-xs text-codex-muted hover:text-codex-subtext transition-colors self-start"
            >
              {threadOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>
                {threadOpen ? 'Hide' : 'Show'} previous correspondence
                ({thread.length} {thread.length === 1 ? 'message' : 'messages'})
              </span>
            </button>

            {threadOpen && (
              <div className="flex flex-col gap-2 pl-3 border-l-2 border-codex-border/40">
                {thread.map(t => <ThreadMessage key={t.id} msg={t} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Compose Modal ────────────────────────────────────────────────────────────
function ComposeModal({ onClose, onSent, characters, replyTo }) {
  const [recipient, setRecipient]       = useState(
    replyTo ? { id: replyTo.sender_id, username: replyTo.sender_username } : null
  )
  const [toInput, setToInput]           = useState(replyTo?.sender_username ?? '')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const [subject, setSubject]           = useState(replyTo ? `Re: ${replyTo.subject.replace(/^(Re:\s*)+/i, '')}` : '')
  const [body, setBody]                 = useState('')
  const [characterId, setCharacterId]   = useState('')
  const [sending, setSending]           = useState(false)
  const [error, setError]               = useState('')
  const searchTimer = useRef(null)

  function handleToInput(val) {
    setToInput(val)
    setRecipient(null)
    setError('')
    clearTimeout(searchTimer.current)
    if (!val.trim() || val.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const { users } = await api.get(`/users/search?q=${encodeURIComponent(val.trim())}`)
        setSearchResults(users)
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 300)
  }

  function selectRecipient(user) {
    setRecipient(user)
    setToInput(user.username)
    setSearchResults([])
  }

  async function handleSend(e) {
    e.preventDefault()
    setError('')
    if (!recipient)       { setError('Please select a recipient from the list.'); return }
    if (!subject.trim())  { setError('Subject is required.'); return }
    if (!body.trim())     { setError('Message body is required.'); return }

    setSending(true)
    try {
      await api.post('/ravens', {
        recipientId: recipient.id,
        subject:     subject.trim(),
        body:        body.trim(),
        characterId: characterId || null,
        parentId:    replyTo?.id ?? null,
      })
      onSent()
      onClose()
    } catch (err) {
      setError(err.message ?? 'Failed to send. Try again.')
      setSending(false)
    }
  }

  const bodyRemaining    = 5000 - body.length
  const subjectRemaining = 120  - subject.length
  const hasNoCharacters  = characters.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-codex-surface border border-codex-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-codex-border">
          <div className="flex items-center gap-2">
            <Feather size={16} className="text-codex-gold" />
            <h3 className="font-semibold text-codex-text text-sm">
              {replyTo ? 'Reply' : 'New Raven'}
            </h3>
          </div>
          <button onClick={onClose}
            className="text-codex-muted hover:text-codex-text transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSend} className="flex flex-col gap-0 flex-1 min-h-0">

          {/* To */}
          <div className="relative border-b border-codex-border">
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="text-xs text-codex-muted w-12 shrink-0 uppercase tracking-wide">To</span>
              <input
                type="text"
                value={toInput}
                onChange={e => handleToInput(e.target.value)}
                placeholder="Username…"
                autoFocus={!replyTo}
                readOnly={!!replyTo}
                className="flex-1 bg-transparent text-base sm:text-sm text-codex-text placeholder-codex-muted focus:outline-none"
              />
              {recipient && (
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full
                  bg-codex-gold/10 text-codex-gold border border-codex-gold/30">
                  ✓ {recipient.username}
                </span>
              )}
            </div>
            {(searchResults.length > 0 || searching) && !recipient && (
              <div className="absolute left-0 right-0 top-full z-10 bg-codex-surface border border-codex-border
                rounded-b-xl shadow-lg overflow-hidden">
                {searching && <p className="px-4 py-2 text-xs text-codex-muted animate-pulse">Searching…</p>}
                {!searching && searchResults.map(u => (
                  <button key={u.id} type="button" onClick={() => selectRecipient(u)}
                    className="w-full text-left px-4 py-2.5 text-sm text-codex-subtext hover:bg-codex-bg hover:text-codex-text transition-colors">
                    {u.username}
                  </button>
                ))}
                {!searching && searchResults.length === 0 && (
                  <p className="px-4 py-2 text-xs text-codex-muted">No users found.</p>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-codex-border">
            <span className="text-xs text-codex-muted w-12 shrink-0 uppercase tracking-wide">Re</span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Subject…"
              className="flex-1 bg-transparent text-base sm:text-sm text-codex-text placeholder-codex-muted focus:outline-none"
            />
            {subject.length > 100 && (
              <span className={`text-[10px] shrink-0 ${subjectRemaining < 10 ? 'text-red-400' : 'text-codex-muted'}`}>
                {subjectRemaining}
              </span>
            )}
          </div>

          {/* Character sheet — always shown */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-codex-border">
            <Scroll size={13} className="text-codex-muted shrink-0" />
            <span className="text-xs text-codex-muted w-12 shrink-0">Sheet</span>
            {hasNoCharacters ? (
              <span className="flex-1 text-xs text-codex-muted/60 italic">
                No character sheets on file yet.
              </span>
            ) : (
              <select
                value={characterId}
                onChange={e => setCharacterId(e.target.value)}
                className="flex-1 bg-transparent text-xs text-codex-subtext focus:outline-none"
              >
                <option value="">No attachment</option>
                {characters.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.character_name} ({GAME_LABELS[ch.game_system] ?? ch.game_system})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-2">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={5000}
              placeholder="Write your message…"
              autoFocus={!!replyTo}
              className="flex-1 bg-transparent text-base sm:text-sm text-codex-text placeholder-codex-muted
                focus:outline-none resize-none leading-relaxed min-h-[120px]"
            />
            <div className="flex justify-end pt-1">
              <span className={`text-[10px] ${bodyRemaining < 200 ? bodyRemaining < 50 ? 'text-red-400' : 'text-amber-400' : 'text-codex-muted'}`}>
                {bodyRemaining.toLocaleString()} remaining
              </span>
            </div>
          </div>

          {error && (
            <p className="px-4 py-2 text-xs text-red-400 bg-red-500/5 border-t border-red-500/20">{error}</p>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-codex-border">
            <button type="button" onClick={onClose}
              className="text-sm text-codex-muted hover:text-codex-text transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !recipient || !subject.trim() || !body.trim()}
              className="flex items-center justify-center gap-2 min-w-[9.5rem] px-5 py-2 rounded-xl
                bg-codex-gold hover:bg-codex-goldHover text-codex-bg text-sm font-semibold
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={13} />
              {sending ? 'Dispatching…' : 'Dispatch Raven'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyPane({ tab, onCompose }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-16">
      <div className="w-16 h-16 rounded-full bg-codex-surface border border-codex-border flex items-center justify-center">
        <Feather size={24} className="text-codex-muted" />
      </div>
      <div>
        <p className="text-sm font-medium text-codex-subtext">
          {tab === 'inbox' ? 'Your inbox is empty.' : 'You haven\'t sent any ravens.'}
        </p>
        <p className="text-xs text-codex-muted mt-1">
          {tab === 'inbox' ? 'Ravens sent to you will appear here.' : 'Send your first raven to get started.'}
        </p>
      </div>
      {tab === 'sent' && (
        <button onClick={onCompose}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-codex-gold/40
            text-codex-gold text-sm hover:bg-codex-gold/10 transition-colors">
          <Feather size={13} /> Send a Raven
        </button>
      )}
    </div>
  )
}

function NoSelection() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-8">
      <p className="text-sm text-codex-muted">Select a raven to read it.</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RavenPost() {
  const { user, logout }            = useAuth()
  const navigate                    = useNavigate()

  const [tab, setTab]               = useState('inbox')
  const [messages, setMessages]     = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loadingList, setLoadingList] = useState(true)

  const [selectedId, setSelectedId] = useState(null)
  const [composing, setComposing]   = useState(false)
  const [replyTo, setReplyTo]       = useState(null)
  const [characters, setCharacters] = useState([])

  const [mobileView, setMobileView] = useState('list')

  const loadMessages = useCallback(async (activeTab = tab, activePage = page) => {
    setLoadingList(true)
    try {
      const endpoint = activeTab === 'inbox' ? '/ravens/inbox' : '/ravens/sent'
      const { messages: msgs, total: t } = await api.get(`${endpoint}?page=${activePage}`)
      setMessages(msgs)
      setTotal(t)
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoadingList(false)
    }
  }, [tab, page])

  useEffect(() => { loadMessages(tab, page) }, [tab, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/characters')
      .then(({ characters: chars }) => setCharacters(chars ?? []))
      .catch(() => {})
  }, [])

  function switchTab(newTab) {
    if (newTab === tab) return
    setTab(newTab); setPage(1); setSelectedId(null); setMessages([]); setMobileView('list')
  }

  function selectMessage(id) {
    setSelectedId(id)
    setMobileView('detail')
    if (tab === 'inbox') {
      setMessages(prev => prev.map(m =>
        m.id === id && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m
      ))
    }
  }

  function handleDeleted(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    setSelectedId(null)
    setTotal(t => t - 1)
    setMobileView('list')
  }

  function openCompose(reply = null) {
    setReplyTo(reply); setComposing(true); setMobileView('compose')
  }

  function handleSent() {
    if (tab === 'sent') { loadMessages('sent', 1); setPage(1) }
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  const hasMore = messages.length < total

  return (
    <div className="min-h-screen bg-codex-bg flex flex-col">
      <Helmet><title>The Raven Post — CampaignCodex</title></Helmet>

      {/* Top nav */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard"
              className="flex items-center gap-1.5 text-xs text-codex-muted hover:text-codex-gold transition-colors">
              <ArrowLeft size={13} /> Dashboard
            </Link>
            <div className="flex items-center gap-2 text-codex-gold">
              <Feather size={16} />
              <span className="font-display text-sm tracking-wide">The Raven Post</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/settings"
              className="flex items-center gap-1.5 text-sm text-codex-subtext hover:text-codex-gold transition-colors group">
              <span className="hidden sm:block text-xs">{user?.username}</span>
              <Settings size={14} className="text-codex-muted group-hover:text-codex-gold transition-colors" />
            </Link>
            {user?.isAdmin && (
              <button onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300
                  transition-colors border border-purple-400/30 rounded-full px-2.5 py-0.5">
                <Shield size={11} /> Admin
              </button>
            )}
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-codex-subtext hover:text-codex-text transition-colors">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-6xl w-full mx-auto">

        {/* Left sidebar */}
        <aside className={`
          w-full sm:w-72 md:w-80 flex-shrink-0 border-r border-codex-border
          flex flex-col bg-codex-surface/30
          ${mobileView !== 'list' ? 'hidden sm:flex' : 'flex'}
        `}>
          {/* Going Postal stamp header */}
          <PostalStamp />

          {/* New Raven button + tabs */}
          <div className="px-4 py-3 border-b border-codex-border flex flex-col gap-3">
            <button
              onClick={() => openCompose()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-codex-gold hover:bg-codex-goldHover text-codex-bg text-sm font-semibold transition-all"
            >
              <Feather size={14} /> New Raven
            </button>
            <div className="flex rounded-lg border border-codex-border overflow-hidden">
              {[
                { key: 'inbox', label: 'Inbox', icon: <Inbox size={12} /> },
                { key: 'sent',  label: 'Sent',  icon: <Mail  size={12} /> },
              ].map(({ key, label, icon }) => (
                <button key={key} onClick={() => switchTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium
                    transition-all ${tab === key
                      ? 'bg-codex-gold/15 text-codex-gold'
                      : 'text-codex-muted hover:text-codex-subtext'
                    }`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="py-12 text-center">
                <p className="text-xs text-codex-muted animate-pulse">Loading…</p>
              </div>
            ) : messages.length === 0 ? (
              <EmptyPane tab={tab} onCompose={() => openCompose()} />
            ) : (
              <>
                {messages.map(msg => (
                  <MessageListItem
                    key={msg.id}
                    message={msg}
                    isSelected={msg.id === selectedId}
                    isInbox={tab === 'inbox'}
                    onClick={() => selectMessage(msg.id)}
                  />
                ))}
                {hasMore && (
                  <div className="p-4 text-center">
                    <button onClick={() => setPage(p => p + 1)}
                      className="text-xs text-codex-muted hover:text-codex-gold transition-colors">
                      Load more ({total - messages.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Right panel */}
        <main className={`
          flex-1 flex flex-col min-h-0 min-w-0
          ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}
        `}>
          {selectedId ? (
            <MessageView
              key={selectedId}
              messageId={selectedId}
              isInbox={tab === 'inbox'}
              onReply={msg => openCompose(msg)}
              onDelete={handleDeleted}
              onBack={() => { setSelectedId(null); setMobileView('list') }}
            />
          ) : (
            <NoSelection />
          )}
        </main>
      </div>

      {composing && (
        <ComposeModal
          onClose={() => { setComposing(false); setReplyTo(null); setMobileView(selectedId ? 'detail' : 'list') }}
          onSent={handleSent}
          characters={characters}
          replyTo={replyTo}
        />
      )}
    </div>
  )
}
