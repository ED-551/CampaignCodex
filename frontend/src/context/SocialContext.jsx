/**
 * SocialContext — global state for friends, friend requests, and blocks.
 *
 * Lives at App level alongside DMContext so it persists across all pages.
 * Loaded once on mount (when user is authenticated) and kept in sync via
 * optimistic updates and real-time socket events — no polling needed.
 *
 * Exposed via useSocial():
 *   friends          [{ friendId, friendUsername, requestId, friendsSince }]
 *   incomingRequests [{ id, senderId, senderUsername, createdAt }]
 *   outgoingSet      Set<userId>  — userIds we've sent pending requests to
 *   blockedSet       Set<userId>  — userIds we have blocked
 *   newRequestIds    Set<userId>  — senders of requests that arrived live (cleared by DMWidget)
 *   newFriendIds     Set<userId>  — friends added live since Friends tab opened (cleared by DMWidget)
 *   clearNewRequests()  — called when Requests tab is opened
 *   clearNewFriends()   — called when Friends tab is opened
 *   getFriendStatus(userId) → 'none' | 'friends' | 'request_sent' | 'request_received'
 *   sendFriendRequest(userId, username) → Promise
 *   respondToRequest(requestId, action) → Promise  (action: 'accepted'|'denied')
 *   unfriend(friendId) → Promise
 *   blockUser(userId) → Promise
 *   unblockUser(userId) → Promise
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth }   from './AuthContext'
import { useSocket } from './SocketContext'
import { api }       from '../utils/api'

const SocialContext = createContext(null)

export function SocialProvider({ children }) {
  const { user }               = useAuth()
  const { socket, connected }  = useSocket()

  const [friends,          setFriends]          = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingSet,      setOutgoingSet]      = useState(new Set())
  const [blockedSet,       setBlockedSet]       = useState(new Set())
  const [loaded,           setLoaded]           = useState(false)

  // ── Notification dots — cleared by DMWidget when user opens the relevant tab ─
  const [newRequestIds, setNewRequestIds] = useState(new Set()) // live-arrived requests
  const [newFriendIds,  setNewFriendIds]  = useState(new Set()) // live-accepted friends

  // ── Load on auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setFriends([]); setIncomingRequests([]); setOutgoingSet(new Set()); setBlockedSet(new Set())
      setNewRequestIds(new Set()); setNewFriendIds(new Set())
      setLoaded(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
          api.get('/social/friends'),
          api.get('/social/friend-requests/incoming'),
          api.get('/social/friend-requests/outgoing'),
        ])
        if (cancelled) return
        setFriends(friendsRes.friends ?? [])
        setIncomingRequests(incomingRes.requests ?? [])
        setOutgoingSet(new Set((outgoingRes.outgoing ?? []).map(r => r.receiver_id)))
        setLoaded(true)
      } catch { /* network errors silently ignored on mount */ }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // ── Real-time socket events ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected || !user) return

    function onRequestReceived({ requestId, senderId, senderUsername }) {
      // Add to incoming list and mark as new (dot on Requests tab)
      setIncomingRequests(prev => {
        if (prev.some(r => r.id === requestId)) return prev
        return [...prev, { id: requestId, sender_id: senderId, sender_username: senderUsername, created_at: new Date().toISOString() }]
      })
      setNewRequestIds(prev => new Set([...prev, senderId]))
    }

    function onFriendAccepted({ friendId, friendUsername }) {
      // Add to friends list and mark as new (dot on Friends tab)
      setFriends(prev => {
        if (prev.some(f => f.friend_id === friendId)) return prev
        return [...prev, { friend_id: friendId, friend_username: friendUsername, created_at: new Date().toISOString() }]
      })
      setOutgoingSet(prev => { const n = new Set(prev); n.delete(friendId); return n })
      setNewFriendIds(prev => new Set([...prev, friendId]))
    }

    socket.on('friend:request_received', onRequestReceived)
    socket.on('friend:accepted',         onFriendAccepted)

    return () => {
      socket.off('friend:request_received', onRequestReceived)
      socket.off('friend:accepted',         onFriendAccepted)
    }
  }, [socket, connected, user])

  // ── Dot clearers (called by DMWidget tabs) ────────────────────────────────
  const clearNewRequests = useCallback(() => setNewRequestIds(new Set()), [])
  const clearNewFriends  = useCallback(() => setNewFriendIds(new Set()),  [])

  // ── getFriendStatus ───────────────────────────────────────────────────────
  const getFriendStatus = useCallback((userId) => {
    if (blockedSet.has(userId)) return 'blocked'
    if (friends.some(f => f.friend_id === userId)) return 'friends'
    if (outgoingSet.has(userId)) return 'request_sent'
    if (incomingRequests.some(r => r.sender_id === userId)) return 'request_received'
    return 'none'
  }, [friends, incomingRequests, outgoingSet, blockedSet])

  // ── sendFriendRequest ─────────────────────────────────────────────────────
  const sendFriendRequest = useCallback(async (userId) => {
    const res = await api.post(`/social/friend-request/${userId}`, {})
    if (res.status === 'accepted') {
      await refreshFriends()
      setIncomingRequests(prev => prev.filter(r => r.sender_id !== userId))
      setOutgoingSet(prev => { const n = new Set(prev); n.delete(userId); return n })
    } else {
      setOutgoingSet(prev => new Set([...prev, userId]))
    }
    return res
  }, [])

  // ── respondToRequest ──────────────────────────────────────────────────────
  const respondToRequest = useCallback(async (requestId, action) => {
    await api.patch(`/social/friend-request/${requestId}`, { action })
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId))
    if (action === 'accepted') {
      await refreshFriends()
    }
  }, [])

  // ── unfriend ──────────────────────────────────────────────────────────────
  const unfriend = useCallback(async (friendId) => {
    await api.delete(`/social/friend/${friendId}`)
    setFriends(prev => prev.filter(f => f.friend_id !== friendId))
  }, [])

  // ── blockUser ─────────────────────────────────────────────────────────────
  const blockUser = useCallback(async (userId) => {
    await api.post(`/social/block/${userId}`, { confirm: true })
    setBlockedSet(prev => new Set([...prev, userId]))
    setFriends(prev => prev.filter(f => f.friend_id !== userId))
    setIncomingRequests(prev => prev.filter(r => r.sender_id !== userId))
    setOutgoingSet(prev => { const n = new Set(prev); n.delete(userId); return n })
  }, [])

  // ── unblockUser ───────────────────────────────────────────────────────────
  const unblockUser = useCallback(async (userId) => {
    await api.delete(`/social/block/${userId}`)
    setBlockedSet(prev => { const n = new Set(prev); n.delete(userId); return n })
  }, [])

  // ── helpers ───────────────────────────────────────────────────────────────
  async function refreshFriends() {
    try {
      const res = await api.get('/social/friends')
      setFriends(res.friends ?? [])
    } catch {}
  }

  const totalIncoming = incomingRequests.length

  return (
    <SocialContext.Provider value={{
      friends,
      incomingRequests,
      outgoingSet,
      blockedSet,
      loaded,
      totalIncoming,
      newRequestIds,
      newFriendIds,
      clearNewRequests,
      clearNewFriends,
      getFriendStatus,
      sendFriendRequest,
      respondToRequest,
      unfriend,
      blockUser,
      unblockUser,
    }}>
      {children}
    </SocialContext.Provider>
  )
}

export function useSocial() {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>')
  return ctx
}
