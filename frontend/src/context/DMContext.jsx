/**
 * DMContext — global state for the DM Widget.
 *
 * Lives at the App level (outside BrowserRouter) so it persists across all
 * page navigations and always listens for incoming DMs.
 *
 * Stale closure guard: `activeUserIdRef` mirrors `activeUserId` state so the
 * `new_dm` socket handler can read the current active conversation without
 * being included in its own effect deps (which would re-register on every
 * focus change).
 *
 * Exposed via useDM():
 *   openDM(userId, username) — open / focus a conversation
 *   closeDM(userId)          — close a conversation window
 *   sendDM(targetUserId, body, callback)  — send a message
 *   setActiveUserId(id)      — switch conversation in the panel
 *   toggleWidget()           — open/close the floating panel
 *   state: { openConvos, activeUserId, messages, unread, widgetOpen, connected }
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useSocket } from './SocketContext'
import { api } from '../utils/api'

const DMContext = createContext(null)

export function DMProvider({ children }) {
  const { user }              = useAuth()
  const { socket, connected } = useSocket()

  // ── State ──────────────────────────────────────────────────────────────────
  const [openConvos,   setOpenConvos]   = useState([])      // [{ userId, username }]
  const [activeUserId, setActiveUserId] = useState(null)    // currently visible chat
  const [messages,     setMessages]     = useState({})      // { [userId]: Message[] }
  const [unread,       setUnread]       = useState({})      // { [userId]: number }
  const [widgetOpen,   setWidgetOpen]   = useState(false)

  // Ref to avoid stale closure in socket handler
  const activeUserIdRef = useRef(null)
  useEffect(() => { activeUserIdRef.current = activeUserId }, [activeUserId])

  // Track which DM socket rooms this client has explicitly joined via open_dm.
  // A new_dm arriving via the personal user:<id> room does NOT count as joined —
  // the DM room itself must be joined so we can send/receive in both directions
  // and fetch the full 50-message history.
  // Cleared on disconnect so rooms are re-joined after a reconnect.
  const joinedDMRooms = useRef(new Set())

  // ── Hydrate / clear conversation list on auth state change ────────────────
  // On login: fetch all past conversation partners from the DB so the DMs tab
  // is pre-populated even after a page refresh.
  // On logout: wipe all in-memory DM state so the next user starts clean.
  useEffect(() => {
    if (!user) {
      setOpenConvos([])
      setMessages({})
      setUnread({})
      setActiveUserId(null)
      setWidgetOpen(false)
      return
    }
    api.get('/dms/conversations')
      .then(({ conversations }) => {
        setOpenConvos(conversations.map(c => ({ userId: c.user_id, username: c.username })))
      })
      .catch(() => {})
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Incoming DM listener ───────────────────────────────────────────────────
  // Registered once when socket is ready. Uses the ref for activeUserId so we
  // don't re-register on every focus change.
  useEffect(() => {
    if (!socket || !user) return

    function handleNewDM(msg) {
      // Determine the "other" side of the conversation
      const isFromMe      = msg.sender_id === user.id
      const otherUserId   = isFromMe ? msg.recipient_id   : msg.sender_id
      const otherUsername = isFromMe ? msg.recipient_username : msg.sender_username

      // Append message — deduplicate by ID because the server emits to both the
      // dm:<room> and user:<id> rooms, so recipients with the window open get it twice.
      setMessages(prev => {
        const bucket = prev[otherUserId] ?? []
        if (bucket.some(m => m.id === msg.id)) return prev
        return { ...prev, [otherUserId]: [...bucket, msg].slice(-200) }
      })

      // Increment unread only if this convo isn't the one currently open
      if (activeUserIdRef.current !== otherUserId) {
        setUnread(prev => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] ?? 0) + 1,
        }))
      }

      // Ensure the sender appears in the conversation list
      setOpenConvos(prev => {
        if (prev.some(c => c.userId === otherUserId)) return prev
        return [...prev, { userId: otherUserId, username: otherUsername }]
      })
    }

    function handleDisconnect() {
      // Socket rooms are lost on disconnect — clear so switchTo/openDM will
      // re-join the correct rooms after reconnect.
      joinedDMRooms.current.clear()
    }

    socket.on('new_dm',     handleNewDM)
    socket.on('disconnect', handleDisconnect)
    return () => {
      socket.off('new_dm',     handleNewDM)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket, user])

  // ── Rejoin DM rooms on reconnect ──────────────────────────────────────────
  // Socket.io rooms are ephemeral — lost on disconnect. Re-open each stored
  // conversation so incoming DMs are received after a reconnect.
  useEffect(() => {
    if (!socket || !connected || openConvos.length === 0) return

    openConvos.forEach(({ userId }) => {
      joinedDMRooms.current.add(userId)
      socket.emit('open_dm', { targetUserId: userId }, ({ messages: history, error }) => {
        if (error || !history) return
        // Merge: keep any messages received during the disconnect gap,
        // prepend history items that aren't already present.
        setMessages(prev => {
          const existing = prev[userId] ?? []
          const existingIds = new Set(existing.map(m => m.id))
          const missing = history.filter(m => !existingIds.has(m.id))
          return {
            ...prev,
            [userId]: [...missing, ...existing].slice(-200),
          }
        })
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]) // Run on reconnect only

  // ── openDM ─────────────────────────────────────────────────────────────────
  // Opens (or focuses) a DM conversation. Joins the socket room if not already
  // joined and fetches history on the first open.
  const openDM = useCallback((targetUserId, targetUsername) => {
    setWidgetOpen(true)
    setActiveUserId(targetUserId)

    // Add to convo list if not present
    setOpenConvos(prev => {
      if (prev.some(c => c.userId === targetUserId)) return prev
      return [...prev, { userId: targetUserId, username: targetUsername }]
    })

    // Clear unread counter
    setUnread(prev => ({ ...prev, [targetUserId]: 0 }))

    if (!socket || !connected) return

    // Join the DM socket room + fetch history on first open.
    // Guard by joinedDMRooms so we don't re-fetch on every focus change.
    if (!joinedDMRooms.current.has(targetUserId)) {
      joinedDMRooms.current.add(targetUserId)
      setMessages(prev => {
        socket.emit('open_dm', { targetUserId }, ({ messages: history, error }) => {
          if (error || !history) return
          setMessages(p => ({ ...p, [targetUserId]: history.slice(-200) }))
        })
        if (prev[targetUserId] !== undefined) return prev  // keep existing while loading
        return { ...prev, [targetUserId]: null }           // null = loading indicator
      })
    }
  }, [socket, connected])

  // ── closeDM ────────────────────────────────────────────────────────────────
  const closeDM = useCallback((targetUserId) => {
    setOpenConvos(prev => prev.filter(c => c.userId !== targetUserId))
    setMessages(prev => { const n = { ...prev }; delete n[targetUserId]; return n })
    setUnread(prev => { const n = { ...prev }; delete n[targetUserId]; return n })
    joinedDMRooms.current.delete(targetUserId)

    if (activeUserId === targetUserId) {
      setActiveUserId(null)
    }

    socket?.emit('close_dm', { targetUserId })
  }, [socket, activeUserId])

  // ── sendDM ─────────────────────────────────────────────────────────────────
  const sendDM = useCallback((targetUserId, body, callback) => {
    if (!socket || !connected) return callback?.({ error: 'Not connected.' })
    socket.emit('send_dm', { targetUserId, body }, callback)
  }, [socket, connected])

  // ── switchTo ───────────────────────────────────────────────────────────────
  const switchTo = useCallback((targetUserId) => {
    setActiveUserId(targetUserId)
    setUnread(prev => ({ ...prev, [targetUserId]: 0 }))

    // Join the DM socket room if we haven't explicitly joined it yet.
    // This handles the case where a new_dm arrived via the personal user:<id>
    // room (which only delivers the single message) before the user clicked
    // the conversation — we need to join the DM room and fetch full history.
    if (socket && connected && !joinedDMRooms.current.has(targetUserId)) {
      joinedDMRooms.current.add(targetUserId)
      socket.emit('open_dm', { targetUserId }, ({ messages: history, error }) => {
        if (error || !history) return
        setMessages(prev => {
          const existing = prev[targetUserId] ?? []
          if (existing.length === 0) return { ...prev, [targetUserId]: history.slice(-200) }
          // Prepend any history messages not already in the live feed
          const existingIds = new Set(existing.map(m => m.id))
          const missing = history.filter(m => !existingIds.has(m.id))
          return { ...prev, [targetUserId]: [...missing, ...existing].slice(-200) }
        })
      })
    }
  }, [socket, connected])

  const toggleWidget = useCallback(() => setWidgetOpen(w => !w), [])

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  return (
    <DMContext.Provider value={{
      openConvos,
      activeUserId,
      messages,
      unread,
      totalUnread,
      widgetOpen,
      openDM,
      closeDM,
      sendDM,
      switchTo,
      toggleWidget,
    }}>
      {children}
    </DMContext.Provider>
  )
}

export function useDM() {
  const ctx = useContext(DMContext)
  if (!ctx) throw new Error('useDM must be used inside <DMProvider>')
  return ctx
}
