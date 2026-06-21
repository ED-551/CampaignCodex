/**
 * SocialContext — global state for friends, friend requests, and blocks.
 *
 * Lives at App level alongside DMContext so it persists across all pages.
 * Loaded once on mount (when user is authenticated) and kept in sync via
 * optimistic updates — no polling needed.
 *
 * Exposed via useSocial():
 *   friends          [{ friendId, friendUsername, requestId, friendsSince }]
 *   incomingRequests [{ id, senderId, senderUsername, createdAt }]
 *   outgoingSet      Set<userId>  — userIds we've sent pending requests to
 *   blockedSet       Set<userId>  — userIds we have blocked
 *   getFriendStatus(userId) → 'none' | 'friends' | 'request_sent' | 'request_received'
 *   sendFriendRequest(userId, username) → Promise
 *   respondToRequest(requestId, action) → Promise  (action: 'accepted'|'denied')
 *   unfriend(friendId) → Promise
 *   blockUser(userId) → Promise
 *   unblockUser(userId) → Promise
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { api }     from '../utils/api'

const SocialContext = createContext(null)

export function SocialProvider({ children }) {
  const { user } = useAuth()

  const [friends,          setFriends]          = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingSet,      setOutgoingSet]      = useState(new Set())
  const [blockedSet,       setBlockedSet]       = useState(new Set())
  const [loaded,           setLoaded]           = useState(false)

  // ── Load on auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setFriends([]); setIncomingRequests([]); setOutgoingSet(new Set()); setBlockedSet(new Set())
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
    // If the other person had sent us a request, it auto-accepted
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
    // Remove from friends and any pending requests
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
