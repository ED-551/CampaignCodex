/**
 * SocketContext — manages the singleton Socket.io connection.
 *
 * - Connects automatically when the user is logged in (reads JWT from localStorage)
 * - Disconnects automatically on logout (user becomes null)
 * - Passes JWT in handshake.auth.token — never in a cookie or query string
 * - Connects via same-origin (proxied by Vite in dev, nginx in prod)
 *
 * Usage:
 *   const { socket, connected } = useSocket()
 *
 * socket is the raw Socket.io client. Components that need it should handle
 * the case where socket is null (user not authenticated).
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user }      = useAuth()
  const socketRef     = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // No user — ensure socket is disconnected
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setConnected(false)
      }
      return
    }

    // Read token at connect time (localStorage is the source of truth for auth)
    const token = localStorage.getItem('cc_token')
    if (!token) return

    // If already connected (e.g., page re-render without logout), don't re-create
    if (socketRef.current?.connected) return

    const socket = io({
      // No explicit URL — connects to current origin, routed via Vite proxy in dev
      // and nginx in production. This avoids hardcoding ports/domains.
      auth:       { token },
      transports: ['websocket', 'polling'], // prefer WS, fall back to polling
      autoConnect: true,
    })

    socket.on('connect', () => {
      console.log('[socket] connected', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason)
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      // AUTH_REQUIRED / AUTH_INVALID means token is gone or expired
      if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_INVALID') {
        console.warn('[socket] auth error — not reconnecting:', err.message)
        socket.disconnect()
      } else {
        console.error('[socket] connect error:', err.message)
      }
      setConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [user?.id]) // Re-run only when the logged-in user changes

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>')
  return ctx
}
