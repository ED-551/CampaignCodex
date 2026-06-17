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

      // Append message to the right conversation bucket
      setMessages(prev => ({
        ...prev,
        [otherUserId]: [...(prev[otherUserId] ?? []), msg],
      }))

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

    socket.on('new_dm', handleNewDM)
    return () => socket.off('new_dm', handleNewDM)
  }, [socket, user])

  // ── Rejoin DM rooms on reconnect ──────────────────────────────────────────
  // Socket.io rooms are ephemeral — lost on disconnect. Re-open each stored
  // conversation so incoming DMs are received after a reconnect.
  useEffect(() => {
    if (!socket || !connected || openConvos.length === 0) return

    openConvos.forEach(({ userId }) => {
      socket.emit('open_dm', { targetUserId: userId }, ({ messages: history, error }) => {
        if (error || !history) return
        // Merge: don't overwrite messages received during the disconnect gap
        setMessages(prev => {
          const existing = prev[userId] ?? []
          // Deduplicate by id (history is the last-50 snapshot)
          const existingIds = new Set(existing.map(m => m.id))
          const fresh = history.filter(m => !existingIds.has(m.id))
          return {
            ...prev,
            [userId]: [...history.filter(m => !fresh.some(() => false)), ...fresh],
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

    // Fetch history only on first open (subsequent switches reuse cached messages)
    setMessages(prev => {
      if (prev[targetUserId] !== undefined) return prev  // already loaded
      // Emit join + history fetch
      socket.emit('open_dm', { targetUserId }, ({ messages: history, error }) => {
        if (error || !history) return
        setMessages(p => ({ ...p, [targetUserId]: history }))
      })
      return { ...prev, [targetUserId]: null }  // null = loading
    })
  }, [socket, connected])

  // ── closeDM ────────────────────────────────────────────────────────────────
  const closeDM = useCallback((targetUserId) => {
    setOpenConvos(prev => prev.filter(c => c.userId !== targetUserId))
    setMessages(prev => { const n = { ...prev }; delete n[targetUserId]; return n })
    setUnread(prev => { const n = { ...prev }; delete n[targetUserId]; return n })

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

    // Join socket room if not already in it (e.g., conversation loaded from list)
    if (socket && connected && !messages[targetUserId]) {
      socket.emit('open_dm', { targetUserId }, ({ messages: history, error }) => {
        if (error || !history) return
        setMessages(prev => ({ ...prev, [targetUserId]: history }))
      })
    }
  }, [socket, connected, messages])

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
