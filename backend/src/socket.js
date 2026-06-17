/**
 * Socket.io server — real-time features for CampaignCodex.
 *
 * Currently implements: campaign chat (campaign:<id> rooms).
 * Future: DM Widget, Spectator Mode will attach additional events here.
 *
 * Security layers (defense-in-depth):
 *  1. JWT verification on handshake — bad/expired tokens are rejected before
 *     a socket connection is established. No socket object is created for
 *     unauthenticated callers.
 *  2. Campaign membership validated on BOTH join and send — stale sessions
 *     (user left mid-session) cannot post messages.
 *  3. Per-user in-memory rate limit (30 messages / 60 s) — prevents flooding
 *     from a single account even across multiple tabs.
 *  4. Body sanitization: trimmed, max 1000 chars enforced server-side.
 *  5. UUID format validated on every inbound campaign ID.
 */

const { Server } = require('socket.io')
const { verifyToken } = require('./utils/jwt')
const db = require('./db')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Per-user message rate limiting ──────────────────────────────────────────
// Keyed by userId so it survives reconnects and catches multi-tab abuse.
// Map<userId, { count: number, resetAt: number }>
const msgRateMap = new Map()
const MSG_RATE_LIMIT  = 30       // messages per window
const MSG_RATE_WINDOW = 60_000   // 60 seconds in ms

function checkMsgRate(userId) {
  const now   = Date.now()
  const entry = msgRateMap.get(userId) ?? { count: 0, resetAt: now + MSG_RATE_WINDOW }

  if (now > entry.resetAt) {
    entry.count   = 1
    entry.resetAt = now + MSG_RATE_WINDOW
    msgRateMap.set(userId, entry)
    return true
  }

  if (entry.count >= MSG_RATE_LIMIT) return false

  entry.count++
  msgRateMap.set(userId, entry)
  return true
}

// Prune stale entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of msgRateMap) {
    if (now > entry.resetAt) msgRateMap.delete(id)
  }
}, 5 * 60_000).unref() // .unref() so the interval doesn't keep the process alive

// ─── Membership helper ────────────────────────────────────────────────────────
// Returns true if userId is an active member or the GM of the given campaign.
async function isCampaignMember(campaignId, userId) {
  const result = await db.query(
    `SELECT 1 FROM campaign_members
     WHERE campaign_id = $1 AND user_id = $2 AND left_at IS NULL
     UNION ALL
     SELECT 1 FROM campaigns
     WHERE id = $1 AND gm_user_id = $2 AND is_deleted = false
     LIMIT 1`,
    [campaignId, userId]
  )
  return result.rows.length > 0
}

// ─── Public room definitions (allowlist) ─────────────────────────────────────
// Room IDs are validated against this set on every inbound event — no arbitrary
// room names can be injected by a client.
const PUBLIC_ROOMS = new Map([
  ['tavern',   { name: 'The Wyrm Wood Tavern', description: 'General hangout — all are welcome',   icon: '🍺' }],
  ['arcane',   { name: 'The Arcane Library',   description: 'Shadowdark discussion',                icon: '📚' }],
  ['boneyard', { name: 'The Bone Yard',         description: 'Mörk Borg discussion',                icon: '💀' }],
  ['nimble',   { name: 'The Nimble Path',       description: 'Nimble RPG discussion',               icon: '🛡️' }],
  ['warroom',  { name: "The GM's War Room",     description: 'Game master strategy & advice',       icon: '⚔️' }],
  ['recruit',  { name: "The Recruit's Tent",    description: 'New players, character help',         icon: '🪄' }],
])

// ─── In-memory occupant tracking ─────────────────────────────────────────────
// Map<roomId, Map<socketId, { userId, username }>>
// A Map-of-Maps lets us remove a specific socket on disconnect in O(1).
const roomOccupants = new Map()
for (const id of PUBLIC_ROOMS.keys()) roomOccupants.set(id, new Map())

// Returns a plain array of { userId, username } for broadcasting
function getOccupants(roomId) {
  return [...(roomOccupants.get(roomId)?.values() ?? [])]
}

// Returns { roomId: count } for all public rooms
function getRoomCounts() {
  const counts = {}
  for (const [id, members] of roomOccupants) counts[id] = members.size
  return counts
}

// ─── Spectator Mode session state ────────────────────────────────────────────
//
// Map<campaignId, SpectatorSession>
//
// SpectatorSession {
//   campaignId    : string
//   campaignName  : string
//   gmUserId      : string
//   gmUsername    : string
//   gmSocketId    : string        — used to emit consent_update directly to GM
//   status        : 'pending' | 'active'
//   pendingUserIds: Set<string>   — userIds whose consent is still outstanding
//   consents      : Map<userId, boolean>   — received responses
//   totalRequired : number        — original pending count (for progress display)
//   spectatorCount: number        — live count of watchers
//   timeoutHandle : Timer
// }
const spectatorSessions = new Map()
const CONSENT_TIMEOUT_MS = 60_000  // 60 seconds

// Returns the public-facing spectator session list for the lobby screen.
function getSpectatorSessionsForLobby() {
  return [...spectatorSessions.values()]
    .filter(s => s.status === 'active')
    .map(s => ({
      campaignId:     s.campaignId,
      campaignName:   s.campaignName,
      gmUsername:     s.gmUsername,
      spectatorCount: s.spectatorCount,
    }))
}

// Shared activation function — called when all consents arrive OR 0 players online.
// `io` is captured in closure when createSocketServer is called.
let _io = null  // set once in createSocketServer

function activateSpectatorMode(campaignId) {
  const session = spectatorSessions.get(campaignId)
  if (!session) return

  clearTimeout(session.timeoutHandle)
  session.status = 'active'

  // Notify campaign room that spectator mode is live
  _io.to(`campaign:${campaignId}`).emit('spectator_active', {
    campaignId,
    campaignName: session.campaignName,
    gmUsername:   session.gmUsername,
  })

  // Update the lobby screen (room selection) with the new live session
  _io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())

  console.log(`[spectator] ACTIVE  campaign=${campaignId} gm=${session.gmUsername}`)
}

function cancelSpectatorSession(campaignId, reason) {
  const session = spectatorSessions.get(campaignId)
  if (!session) return

  clearTimeout(session.timeoutHandle)
  spectatorSessions.delete(campaignId)

  _io.to(`campaign:${campaignId}`).emit('spectator_cancelled', { campaignId, reason })
  _io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())

  console.log(`[spectator] CANCEL  campaign=${campaignId} reason="${reason}"`)
}

function endSpectatorSession(campaignId) {
  const session = spectatorSessions.get(campaignId)
  if (!session) return

  clearTimeout(session.timeoutHandle)
  spectatorSessions.delete(campaignId)

  _io.to(`campaign:${campaignId}`).emit('spectator_ended', { campaignId })
  _io.to(`spectator:${campaignId}`).emit('spectator_ended', { campaignId })
  _io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())

  console.log(`[spectator] ENDED   campaign=${campaignId}`)
}

// ─── createSocketServer ───────────────────────────────────────────────────────
// Attaches a Socket.io server to an existing Node http.Server instance.
// Returns the io object (useful for future server-side emits from REST routes).
function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  })

  _io = io  // expose io to spectator session helpers

  // ── Handshake JWT auth middleware ─────────────────────────────────────────
  // Every socket must present a valid JWT in socket.handshake.auth.token.
  // This runs before connection is established — no socket event is possible
  // for an unauthenticated caller.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('AUTH_REQUIRED'))
    }
    try {
      const payload     = verifyToken(token)
      socket.userId     = payload.sub
      socket.username   = payload.username
      next()
    } catch {
      next(new Error('AUTH_INVALID'))
    }
  })

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[socket] + uid=${socket.userId} (${socket.username})`)

    // ── join_campaign ────────────────────────────────────────────────────────
    // Emitted by the client when entering a campaign page.
    // Validates membership, joins the Socket.io room, and returns the last
    // 50 messages as history (oldest-first for display).
    //
    // Payload : { campaignId: string }
    // Callback: { messages: Message[] } | { error: string }
    socket.on('join_campaign', async ({ campaignId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      try {
        const member = await isCampaignMember(campaignId, socket.userId)
        if (!member) return callback({ error: 'Access denied.' })

        // Leave previous room if navigating between campaigns in the same tab
        if (socket.currentCampaignId && socket.currentCampaignId !== campaignId) {
          socket.leave(`campaign:${socket.currentCampaignId}`)
        }

        socket.join(`campaign:${campaignId}`)
        socket.currentCampaignId = campaignId

        // Fetch last 50 messages (DESC to limit, then reverse for chronological order)
        const history = await db.query(
          `SELECT id, user_id, username, body, created_at
           FROM campaign_messages
           WHERE campaign_id = $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [campaignId]
        )

        // Inform late-joining players if spectator mode is already active
        const session = spectatorSessions.get(campaignId)
        const spectatorModeActive = session?.status === 'active'

        callback({ messages: history.rows.reverse(), spectatorModeActive })
      } catch (err) {
        console.error('[socket:join_campaign]', err)
        callback({ error: 'Failed to join campaign chat.' })
      }
    })

    // ── send_message ─────────────────────────────────────────────────────────
    // Emitted by the client to post a chat message.
    // Re-validates membership on every send (handles user leaving mid-session).
    // On success, broadcasts `new_message` to ALL sockets in the room.
    //
    // Payload : { campaignId: string, body: string }
    // Callback: { ok: true } | { error: string }
    socket.on('send_message', async ({ campaignId, body } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      if (!body || typeof body !== 'string') {
        return callback({ error: 'Message body required.' })
      }

      const trimmed = body.trim()
      if (trimmed.length === 0) return callback({ error: 'Message cannot be empty.' })
      if (trimmed.length > 1000) return callback({ error: 'Max 1000 characters.' })

      // Per-user rate check
      if (!checkMsgRate(socket.userId)) {
        return callback({ error: 'Slow down — you\'re sending too many messages.' })
      }

      try {
        // Re-check membership (handles kicked/left users with open sockets)
        const member = await isCampaignMember(campaignId, socket.userId)
        if (!member) return callback({ error: 'Access denied.' })

        const result = await db.query(
          `INSERT INTO campaign_messages (campaign_id, user_id, username, body)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id, username, body, created_at`,
          [campaignId, socket.userId, socket.username, trimmed]
        )

        const message = result.rows[0]

        // Broadcast to the entire campaign room (including sender)
        io.to(`campaign:${campaignId}`).emit('new_message', message)

        // Forward to spectators if a live session is active
        if (spectatorSessions.get(campaignId)?.status === 'active') {
          io.to(`spectator:${campaignId}`).emit('room_message', {
            ...message,
            created_at: message.created_at.toISOString?.() ?? message.created_at,
          })
        }

        callback({ ok: true })
      } catch (err) {
        console.error('[socket:send_message]', err)
        callback({ error: 'Failed to send message.' })
      }
    })

    // ── leave_campaign ───────────────────────────────────────────────────────
    // Emitted when the client navigates away from a campaign page.
    // Explicit leave is optional — Socket.io cleans up rooms on disconnect —
    // but emitting it keeps room membership tight for future presence features.
    //
    // Payload: { campaignId: string }
    socket.on('leave_campaign', ({ campaignId } = {}) => {
      if (campaignId && UUID_RE.test(campaignId)) {
        socket.leave(`campaign:${campaignId}`)
        if (socket.currentCampaignId === campaignId) {
          socket.currentCampaignId = null
        }
      }
    })

    // ────────────────────────────────────────────────────────────────────────
    // ── DIRECT MESSAGE EVENTS ────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────

    // ── open_dm ─────────────────────────────────────────────────────────────
    // Join the DM room for a conversation with a specific user and receive
    // message history. Called whenever the client opens or focuses a DM window.
    //
    // Payload : { targetUserId: string }
    // Callback: { messages: DMMessage[], targetUser: { id, username } }
    //         | { error: string }
    socket.on('open_dm', async ({ targetUserId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!targetUserId || !UUID_RE.test(targetUserId)) {
        return callback({ error: 'Invalid user ID.' })
      }
      if (targetUserId === socket.userId) {
        return callback({ error: 'Cannot DM yourself.' })
      }

      try {
        // Verify target user exists
        const userCheck = await db.query(
          'SELECT id, username FROM users WHERE id = $1 LIMIT 1',
          [targetUserId]
        )
        if (userCheck.rows.length === 0) {
          return callback({ error: 'User not found.' })
        }
        const targetUser = userCheck.rows[0]

        // Deterministic room key: always lower UUID first
        const roomKey = [socket.userId, targetUserId].sort().join(':')
        socket.join(`dm:${roomKey}`)

        // Fetch last 50 messages for this conversation pair (both directions)
        const history = await db.query(
          `SELECT id, sender_id, sender_username, recipient_id, recipient_username,
                  body, created_at
           FROM dm_messages
           WHERE (sender_id = $1 AND recipient_id = $2)
              OR (sender_id = $2 AND recipient_id = $1)
           ORDER BY created_at DESC
           LIMIT 50`,
          [socket.userId, targetUserId]
        )

        callback({ messages: history.rows.reverse(), targetUser })
      } catch (err) {
        console.error('[socket:open_dm]', err)
        callback({ error: 'Failed to open conversation.' })
      }
    })

    // ── send_dm ──────────────────────────────────────────────────────────────
    // Send a direct message to a specific user. Persists to dm_messages and
    // broadcasts to BOTH sides of the conversation.
    //
    // Payload : { targetUserId: string, body: string }
    // Callback: { ok: true } | { error: string }
    socket.on('send_dm', async ({ targetUserId, body } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!targetUserId || !UUID_RE.test(targetUserId)) {
        return callback({ error: 'Invalid user ID.' })
      }
      if (targetUserId === socket.userId) {
        return callback({ error: 'Cannot DM yourself.' })
      }
      if (!body || typeof body !== 'string') {
        return callback({ error: 'Message body required.' })
      }

      const trimmed = body.trim()
      if (trimmed.length === 0) return callback({ error: 'Message cannot be empty.' })
      if (trimmed.length > 1000) return callback({ error: 'Max 1000 characters.' })

      // Shared per-user rate limiter
      if (!checkMsgRate(socket.userId)) {
        return callback({ error: 'Slow down — too many messages.' })
      }

      try {
        // Verify target exists and retrieve their username for denormalization
        const userCheck = await db.query(
          'SELECT id, username FROM users WHERE id = $1 LIMIT 1',
          [targetUserId]
        )
        if (userCheck.rows.length === 0) {
          return callback({ error: 'User not found.' })
        }
        const targetUser = userCheck.rows[0]

        const result = await db.query(
          `INSERT INTO dm_messages
             (sender_id, sender_username, recipient_id, recipient_username, body)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, sender_id, sender_username, recipient_id, recipient_username,
                     body, created_at`,
          [socket.userId, socket.username, targetUserId, targetUser.username, trimmed]
        )

        const message = result.rows[0]
        const roomKey = [socket.userId, targetUserId].sort().join(':')

        // Broadcast to both ends — recipient gets it even if their widget is minimized
        io.to(`dm:${roomKey}`).emit('new_dm', message)

        callback({ ok: true })
      } catch (err) {
        console.error('[socket:send_dm]', err)
        callback({ error: 'Failed to send message.' })
      }
    })

    // ── close_dm ─────────────────────────────────────────────────────────────
    // Leave a DM socket room. Emitted when the user closes a DM window.
    // The room is also automatically cleaned up on disconnect.
    //
    // Payload: { targetUserId: string }
    socket.on('close_dm', ({ targetUserId } = {}) => {
      if (targetUserId && UUID_RE.test(targetUserId)) {
        const roomKey = [socket.userId, targetUserId].sort().join(':')
        socket.leave(`dm:${roomKey}`)
      }
    })

    // ────────────────────────────────────────────────────────────────────────
    // ── PUBLIC CHATROOM EVENTS ───────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────

    // ── join_lobby ────────────────────────────────────────────────────────────
    // Emitted when the client lands on the /chat room-selection screen.
    // Joins the `lobby` Socket.io room so the client receives live count
    // updates whenever anyone enters or leaves a public room.
    //
    // Callback: { rooms: RoomInfo[], counts: { [roomId]: number } }
    socket.on('join_lobby', (_, callback) => {
      if (typeof callback !== 'function') return
      socket.join('lobby')
      const roomList = [...PUBLIC_ROOMS.entries()].map(([id, meta]) => ({
        id,
        ...meta,
        count: roomOccupants.get(id)?.size ?? 0,
      }))
      callback({ rooms: roomList, spectatorSessions: getSpectatorSessionsForLobby() })
    })

    // ── leave_lobby ──────────────────────────────────────────────────────────
    socket.on('leave_lobby', () => socket.leave('lobby'))

    // ── join_public_room ──────────────────────────────────────────────────────
    // Emitted when the client clicks a room card and enters the chat.
    // Validates room ID against the hardcoded allowlist — no arbitrary names.
    //
    // Payload : { roomId: string }
    // Callback: { occupants: Occupant[] } | { error: string }
    socket.on('join_public_room', ({ roomId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!roomId || !PUBLIC_ROOMS.has(roomId)) {
        return callback({ error: 'Unknown room.' })
      }

      // Leave any previous public room (handles tab reuse)
      if (socket.currentPublicRoomId && socket.currentPublicRoomId !== roomId) {
        const prevId = socket.currentPublicRoomId
        socket.leave(`public:${prevId}`)
        roomOccupants.get(prevId)?.delete(socket.id)
        io.to(`public:${prevId}`).emit('room_occupants', getOccupants(prevId))
      }

      // Also leave lobby (they're now inside a room)
      socket.leave('lobby')

      socket.join(`public:${roomId}`)
      socket.currentPublicRoomId = roomId

      // Add to occupant tracking
      roomOccupants.get(roomId).set(socket.id, {
        userId:   socket.userId,
        username: socket.username,
      })

      // Push updated occupant list to everyone in the room
      const occupants = getOccupants(roomId)
      io.to(`public:${roomId}`).emit('room_occupants', occupants)

      // Push updated counts to anyone still on the room selection screen
      io.to('lobby').emit('room_counts_update', getRoomCounts())

      callback({ occupants })
    })

    // ── leave_public_room ─────────────────────────────────────────────────────
    // Emitted when the client clicks Back on a room or navigates away.
    // Also called automatically from the disconnect handler below.
    //
    // Payload: { roomId: string }
    function leavePublicRoom(roomId) {
      if (!roomId || !PUBLIC_ROOMS.has(roomId)) return
      socket.leave(`public:${roomId}`)
      roomOccupants.get(roomId)?.delete(socket.id)
      if (socket.currentPublicRoomId === roomId) socket.currentPublicRoomId = null

      io.to(`public:${roomId}`).emit('room_occupants', getOccupants(roomId))
      io.to('lobby').emit('room_counts_update', getRoomCounts())
    }

    socket.on('leave_public_room', ({ roomId } = {}) => leavePublicRoom(roomId))

    // ── send_public_message ───────────────────────────────────────────────────
    // Broadcast a message to a public room. No persistence — ephemeral only.
    // Messages are lost when the server restarts, matching the tavern vibe.
    //
    // Payload : { roomId: string, body: string }
    // Callback: { ok: true } | { error: string }
    socket.on('send_public_message', ({ roomId, body } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!roomId || !PUBLIC_ROOMS.has(roomId)) {
        return callback({ error: 'Unknown room.' })
      }

      // Sender must currently be in the room (not just anywhere on the site)
      if (socket.currentPublicRoomId !== roomId) {
        return callback({ error: 'You are not in this room.' })
      }

      if (!body || typeof body !== 'string') {
        return callback({ error: 'Message body required.' })
      }

      const trimmed = body.trim()
      if (trimmed.length === 0) return callback({ error: 'Message cannot be empty.' })
      if (trimmed.length > 500) return callback({ error: 'Max 500 characters.' })

      if (!checkMsgRate(socket.userId)) {
        return callback({ error: 'Slow down — too many messages.' })
      }

      // Ephemeral — no DB write
      const message = {
        id:         require('crypto').randomUUID(),
        username:   socket.username,
        user_id:    socket.userId,
        body:       trimmed,
        created_at: new Date().toISOString(),
      }

      io.to(`public:${roomId}`).emit('room_message', message)
      callback({ ok: true })
    })

    // ────────────────────────────────────────────────────────────────────────
    // ── COMBAT TRACKER EVENTS ────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────
    // Live combat state is authored by the GM and relayed to all campaign
    // members watching the combat page. The canonical state lives in the DB
    // (combat_sessions.combatants JSONB) — the socket is purely a push channel
    // so players don't have to poll.

    // ── join_combat ───────────────────────────────────────────────────────────
    // Both GM and players join this room to receive live combat_update events.
    // Membership is validated — spectators and anonymous users are excluded.
    //
    // Payload : { campaignId: string }
    // Callback: { ok: true } | { error: string }
    socket.on('join_combat', async ({ campaignId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      try {
        const ok = await isCampaignMember(campaignId, socket.userId)
        if (!ok) return callback({ error: 'Access denied.' })

        socket.join(`combat:${campaignId}`)
        socket.currentCombatCampaignId = campaignId
        callback({ ok: true })
      } catch {
        callback({ error: 'Failed to join combat room.' })
      }
    })

    // ── leave_combat ──────────────────────────────────────────────────────────
    // Explicit leave (player navigates away).
    // Socket.io also handles cleanup automatically on disconnect.
    socket.on('leave_combat', ({ campaignId } = {}) => {
      if (!campaignId || !UUID_RE.test(campaignId)) return
      socket.leave(`combat:${campaignId}`)
      if (socket.currentCombatCampaignId === campaignId) {
        socket.currentCombatCampaignId = null
      }
    })

    // ── push_combat_update ────────────────────────────────────────────────────
    // GM-only. Called AFTER the backend has persisted the change (via REST PATCH).
    // Relays the new state to all players currently on the combat page.
    //
    // Payload:
    //   campaignId  : string
    //   combatants  : Combatant[]   — full state array
    //   roundNumber : number
    //   eventType   : 'update' | 'started' | 'ended'
    //
    // Players receive a 'combat_update' event with the same payload.
    socket.on('push_combat_update', async ({ campaignId, combatants, roundNumber, eventType } = {}) => {
      if (!campaignId || !UUID_RE.test(campaignId)) return

      // Only validated GMs may push state
      try {
        const r = await db.query(
          'SELECT gm_user_id FROM campaigns WHERE id = $1 AND is_deleted = false',
          [campaignId]
        )
        if (r.rows[0]?.gm_user_id !== socket.userId) return

        // Broadcast to players (not back to GM — they already have it)
        socket.to(`combat:${campaignId}`).emit('combat_update', {
          combatants,
          roundNumber,
          eventType: eventType ?? 'update',
        })
      } catch (err) {
        console.error('[socket:push_combat_update]', err)
      }
    })

    // ────────────────────────────────────────────────────────────────────────
    // ── SPECTATOR MODE EVENTS ────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────

    // ── spectator_request ─────────────────────────────────────────────────────
    // GM requests to open the campaign table to public spectators.
    // Finds all campaign members currently in the Socket.io room and starts
    // a consent round. If no members are online, activates immediately.
    //
    // Payload : { campaignId: string }
    // Callback: { ok: true, totalNeeded: number } | { error: string }
    socket.on('spectator_request', async ({ campaignId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      // Only the GM can initiate
      try {
        const campResult = await db.query(
          `SELECT id, name, gm_user_id FROM campaigns
           WHERE id = $1 AND is_deleted = false LIMIT 1`,
          [campaignId]
        )
        if (!campResult.rows[0]) return callback({ error: 'Campaign not found.' })
        if (campResult.rows[0].gm_user_id !== socket.userId) {
          return callback({ error: 'Only the GM can open spectator mode.' })
        }

        // Reject if a session is already running
        if (spectatorSessions.has(campaignId)) {
          return callback({ error: 'Spectator mode is already active for this campaign.' })
        }

        const campaignName = campResult.rows[0].name

        // Find all online campaign members (exclude the GM's own sockets)
        const roomSockets = await io.in(`campaign:${campaignId}`).fetchSockets()
        // Deduplicate by userId — a member with 2 tabs still counts once
        const onlineUserIds = new Set(
          roomSockets
            .filter(s => s.userId !== socket.userId)
            .map(s => s.userId)
        )

        const session = {
          campaignId,
          campaignName,
          gmUserId:       socket.userId,
          gmUsername:     socket.username,
          gmSocketId:     socket.id,
          status:         'pending',
          pendingUserIds: new Set(onlineUserIds),
          consents:       new Map(),
          totalRequired:  onlineUserIds.size,
          spectatorCount: 0,
          timeoutHandle:  null,
        }

        if (onlineUserIds.size === 0) {
          // Nobody online to consent — activate immediately
          spectatorSessions.set(campaignId, session)
          activateSpectatorMode(campaignId)
          return callback({ ok: true, totalNeeded: 0 })
        }

        // Start timeout BEFORE setting session so cancel works if something blows up
        session.timeoutHandle = setTimeout(() => {
          cancelSpectatorSession(campaignId, 'Consent request timed out.')
        }, CONSENT_TIMEOUT_MS)

        spectatorSessions.set(campaignId, session)

        // Broadcast consent request to online campaign members (not the GM)
        io.to(`campaign:${campaignId}`).except(socket.id).emit('consent_requested', {
          campaignId,
          campaignName,
          gmUsername:   socket.username,
          timeoutSecs:  CONSENT_TIMEOUT_MS / 1000,
        })

        console.log(`[spectator] REQUEST campaign=${campaignId} gm=${socket.username} pending=${onlineUserIds.size}`)
        callback({ ok: true, totalNeeded: onlineUserIds.size })
      } catch (err) {
        console.error('[socket:spectator_request]', err)
        callback({ error: 'Failed to initiate spectator mode.' })
      }
    })

    // ── consent_response ──────────────────────────────────────────────────────
    // A campaign member responds to the GM's spectator mode request.
    //
    // Payload : { campaignId: string, accepted: boolean }
    // Callback: { ok: true } | { error: string }
    socket.on('consent_response', ({ campaignId, accepted } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      const session = spectatorSessions.get(campaignId)
      if (!session || session.status !== 'pending') {
        return callback({ error: 'No active consent request for this campaign.' })
      }

      // Only players who were online when the request was made need to respond
      if (!session.pendingUserIds.has(socket.userId)) {
        return callback({ error: 'You are not part of this consent request.' })
      }

      session.pendingUserIds.delete(socket.userId)
      session.consents.set(socket.userId, accepted)

      if (!accepted) {
        cancelSpectatorSession(campaignId, `${socket.username} declined.`)
        return callback({ ok: true })
      }

      // Update GM with consent progress
      const acceptedCount = [...session.consents.values()].filter(Boolean).length
      io.to(session.gmSocketId).emit('consent_update', {
        campaignId,
        accepted: acceptedCount,
        total:    session.totalRequired,
      })

      // All required consents received → activate
      if (session.pendingUserIds.size === 0) {
        activateSpectatorMode(campaignId)
      }

      callback({ ok: true })
    })

    // ── spectator_close ───────────────────────────────────────────────────────
    // GM ends spectator mode. Notifies both the campaign room and the spectator
    // room, then removes the session from the lobby.
    //
    // Payload : { campaignId: string }
    // Callback: { ok: true } | { error: string }
    socket.on('spectator_close', ({ campaignId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      const session = spectatorSessions.get(campaignId)
      if (!session) return callback({ error: 'No active spectator session.' })
      if (session.gmUserId !== socket.userId) {
        return callback({ error: 'Only the GM can close spectator mode.' })
      }

      endSpectatorSession(campaignId)
      callback({ ok: true })
    })

    // ── join_spectator ────────────────────────────────────────────────────────
    // A public user joins a live spectator session to watch the campaign chat.
    // Validates that the session is active, then adds them to the spectator room.
    //
    // Payload : { campaignId: string }
    // Callback: { campaignName: string, gmUsername: string } | { error: string }
    socket.on('join_spectator', ({ campaignId } = {}, callback) => {
      if (typeof callback !== 'function') return

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return callback({ error: 'Invalid campaign ID.' })
      }

      const session = spectatorSessions.get(campaignId)
      if (!session || session.status !== 'active') {
        return callback({ error: 'This session is no longer live.' })
      }

      // Leave any previous spectator room
      if (socket.currentSpectatorCampaignId && socket.currentSpectatorCampaignId !== campaignId) {
        const prev = socket.currentSpectatorCampaignId
        socket.leave(`spectator:${prev}`)
        const prevSession = spectatorSessions.get(prev)
        if (prevSession) {
          prevSession.spectatorCount = Math.max(0, prevSession.spectatorCount - 1)
          io.to(`campaign:${prev}`).emit('spectator_count_update', { campaignId: prev, count: prevSession.spectatorCount })
          io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())
        }
      }

      socket.join(`spectator:${campaignId}`)
      socket.currentSpectatorCampaignId = campaignId

      session.spectatorCount++
      io.to(`campaign:${campaignId}`).emit('spectator_count_update', {
        campaignId,
        count: session.spectatorCount,
      })
      io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())

      callback({
        campaignName: session.campaignName,
        gmUsername:   session.gmUsername,
      })
    })

    // ── leave_spectator ───────────────────────────────────────────────────────
    // Public user leaves a spectator session.
    //
    // Payload: { campaignId: string }
    socket.on('leave_spectator', ({ campaignId } = {}) => {
      if (!campaignId || !UUID_RE.test(campaignId)) return
      if (socket.currentSpectatorCampaignId !== campaignId) return

      socket.leave(`spectator:${campaignId}`)
      socket.currentSpectatorCampaignId = null

      const session = spectatorSessions.get(campaignId)
      if (session) {
        session.spectatorCount = Math.max(0, session.spectatorCount - 1)
        io.to(`campaign:${campaignId}`).emit('spectator_count_update', {
          campaignId,
          count: session.spectatorCount,
        })
        io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())
      }
    })

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] - uid=${socket.userId} (${socket.username})`)

      // Clean up presence from any public room
      if (socket.currentPublicRoomId) {
        leavePublicRoom(socket.currentPublicRoomId)
      }

      // If this socket was a spectator, decrement spectator count
      if (socket.currentSpectatorCampaignId) {
        const session = spectatorSessions.get(socket.currentSpectatorCampaignId)
        if (session) {
          session.spectatorCount = Math.max(0, session.spectatorCount - 1)
          io.to(`campaign:${socket.currentSpectatorCampaignId}`).emit('spectator_count_update', {
            campaignId: socket.currentSpectatorCampaignId,
            count:      session.spectatorCount,
          })
          io.to('lobby').emit('spectator_sessions_update', getSpectatorSessionsForLobby())
        }
      }

      // If the GM disconnects, cancel any pending request or end any active session
      for (const [campaignId, session] of spectatorSessions) {
        if (session.gmUserId === socket.userId) {
          if (session.status === 'pending') {
            cancelSpectatorSession(campaignId, 'GM disconnected.')
          } else if (session.status === 'active') {
            endSpectatorSession(campaignId)
          }
          break  // A GM can only run one spectator session at a time
        }
      }
    })
  })

  return io
}

module.exports = { createSocketServer }
