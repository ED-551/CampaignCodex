/**
 * usePresence — real-time online presence for admin/moderator dashboards.
 *
 * Emits `admin:watch_presence` on mount → receives a full snapshot of all
 * currently online userIds. Then listens for incremental `admin:presence_update`
 * events ({ userId, online: bool }) and maintains a Set<userId> in state.
 *
 * On unmount, emits `admin:unwatch_presence` so the socket leaves the
 * broadcast room and stops receiving presence events.
 *
 * Usage:
 *   const onlineSet = usePresence()   // Set<string> of currently-online userIds
 *   const isOnline  = onlineSet.has(userId)
 *
 * Security: the server verifies admin/moderator status on `admin:watch_presence`.
 * Non-privileged sockets receive { error } and the Set stays empty.
 */

import { useState, useEffect } from 'react'
import { useSocket } from '../context/SocketContext'

export function usePresence() {
  const { socket, connected } = useSocket()
  const [onlineSet, setOnlineSet] = useState(() => new Set())

  useEffect(() => {
    if (!socket || !connected) return

    // Request snapshot + join presence room
    socket.emit('admin:watch_presence', null, ({ snapshot, error } = {}) => {
      if (error || !Array.isArray(snapshot)) return
      setOnlineSet(new Set(snapshot.map(e => e.userId)))
    })

    // Incremental updates
    function onUpdate({ userId, online }) {
      setOnlineSet(prev => {
        const next = new Set(prev)
        if (online) next.add(userId)
        else         next.delete(userId)
        return next
      })
    }

    socket.on('admin:presence_update', onUpdate)

    return () => {
      socket.off('admin:presence_update', onUpdate)
      // Leave the broadcast room on unmount — stops receiving events
      socket.emit('admin:unwatch_presence')
    }
  }, [socket, connected])

  return onlineSet
}
