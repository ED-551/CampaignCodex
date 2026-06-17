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

        callback({ messages: history.rows.reverse() })
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

        // Broadcast to the entire room (including sender — no double-add needed)
        io.to(`campaign:${campaignId}`).emit('new_message', message)

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

    socket.on('disconnect', () => {
      console.log(`[socket] - uid=${socket.userId} (${socket.username})`)
    })
  })

  return io
}

module.exports = { createSocketServer }
