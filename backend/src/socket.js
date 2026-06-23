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

const { Server }     = require('socket.io')
const { randomUUID } = require('crypto')
const { verifyToken } = require('./utils/jwt')
const db = require('./db')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Combat HP sanitizer ──────────────────────────────────────────────────────
// Strips hp_current / hp_max from non-PC combatants and replaces with hp_label.
// Called before broadcasting combat state to player sockets.
function sanitizeCombatantsForPlayers(combatants) {
  if (!Array.isArray(combatants)) return combatants
  return combatants.map(c => {
    if (c.type === 'pc') return c  // PC HP always visible
    // Monster/NPC: replace HP numbers with a label
    const hp = c.hp_current ?? 0
    const max = c.hp_max ?? 1
    let hp_label = 'Healthy'
    if (c.is_dead || (c.conditions ?? []).includes('Dead')) {
      hp_label = 'Dead'
    } else if (hp <= 0 || (c.conditions ?? []).includes('dying')) {
      hp_label = 'Dying'
    } else if (max > 0 && hp / max <= 0.25) {
      hp_label = 'Near Death'
    } else if (max > 0 && hp / max <= 0.5) {
      hp_label = 'Bloodied'
    }
    const { hp_current, hp_max, ...rest } = c
    return { ...rest, hp_label }
  })
}

// ─── Per-user message rate limiting ──────────────────────────────────────────
// Keyed by userId so it survives reconnects and catches multi-tab abuse.
// Map<userId, { count: number, resetAt: number }>
const msgRateMap = new Map()
const MSG_RATE_LIMIT  = 30       // messages per window
const MSG_RATE_WINDOW = 60_000   // 60 seconds in ms

// Sliding-window rate limiter for chat messages.
//
// Algorithm: each user gets a single { count, resetAt } bucket. On the first
// message after the window has expired, the bucket resets and the message is
// allowed. Within a live window, count is incremented on each allowed message;
// once count reaches MSG_RATE_LIMIT the function returns false and the caller
// emits an error back to the sender only (no broadcast).
//
// 30 msg / 60 s was chosen as a generous but meaningful cap — a human typing
// quickly tops out around 10–15 messages per minute; 30 gives real-time dice
// rollers and combat callers plenty of headroom while still blocking a scripted
// flood. The bucket is keyed on userId (not socket.id) so rate limits survive
// reconnects and apply across all open tabs of the same account.
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

// ─── Per-user action rate limiting ───────────────────────────────────────────
// Separate bucket for DB-touching non-message events (join_campaign, open_dm,
// join_combat, spectator_request). Prevents a valid authenticated user from
// exhausting the DB connection pool via rapid event spam.
// Limit: 30 actions per 60 seconds per user.
const actionRateMap = new Map()
const ACTION_RATE_LIMIT  = 30
const ACTION_RATE_WINDOW = 60_000

// Same sliding-window algorithm as checkMsgRate, but governs DB-touching
// non-message events (join_campaign, open_dm, join_combat, spectator_request).
//
// Why a separate bucket? Message volume and action volume are independent
// signals. A user should be able to chat freely while also doing a campaign
// join — sharing one bucket would cause legitimate chat to consume the action
// allowance. Keeping them separate lets the server throttle DB queries without
// impacting the chat UX, and vice versa.
//
// 30 actions / 60 s is generous for normal navigation; rapid-fire joins or
// spectator requests by an automated client would hit this within seconds.
function checkActionRate(userId) {
  const now   = Date.now()
  const entry = actionRateMap.get(userId) ?? { count: 0, resetAt: now + ACTION_RATE_WINDOW }

  if (now > entry.resetAt) {
    entry.count   = 1
    entry.resetAt = now + ACTION_RATE_WINDOW
    actionRateMap.set(userId, entry)
    return true
  }

  if (entry.count >= ACTION_RATE_LIMIT) return false

  entry.count++
  actionRateMap.set(userId, entry)
  return true
}

// Prune stale action rate entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of actionRateMap) {
    if (now > entry.resetAt) actionRateMap.delete(id)
  }
}, 5 * 60_000).unref()

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

// ─── Global presence tracking ─────────────────────────────────────────────────
// Map<userId, Set<socketId>>
// A user is "online" if their Set is non-empty. Multi-tab/reconnect safe —
// each tab gets its own socketId entry; the last one to close marks them offline.
// Only admins and moderators ever join the 'admin:presence' room, so broadcast
// volume is effectively zero in production.
const presenceMap = new Map()

function addPresence(userId, socketId) {
  if (!presenceMap.has(userId)) presenceMap.set(userId, new Set())
  presenceMap.get(userId).add(socketId)
}

// Returns true if the user just went offline (their Set became empty)
function removePresence(userId, socketId) {
  const sockets = presenceMap.get(userId)
  if (!sockets) return false
  sockets.delete(socketId)
  if (sockets.size === 0) { presenceMap.delete(userId); return true }
  return false
}

// Snapshot for newly-joined admin:presence subscribers — array of online userIds
function getPresenceSnapshot() {
  return [...presenceMap.keys()].map(userId => ({ userId, online: true }))
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
  //
  // Full verification flow:
  //  1. Extract token from socket.handshake.auth.token (set by the client
  //     immediately before calling io.connect()).
  //  2. Call verifyToken() — this checks the JWT signature and expiry using
  //     the shared secret. If the token is tampered with or expired, it throws
  //     and we call next(AUTH_INVALID).
  //  3. Pull the user's current token_version from the DB (single indexed
  //     lookup by primary key — negligible latency).
  //  4. Compare payload.tv (token version baked in at login) against the DB
  //     value. If they differ the user has changed their password since this
  //     token was issued, and we reject with AUTH_INVALID. Socket.io will
  //     automatically attempt to reconnect the client, at which point it must
  //     supply a fresh token from the REST /auth/refresh endpoint.
  //  5. On success, attach userId and username to the socket object so every
  //     event handler can trust socket.userId without re-querying the DB.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('AUTH_REQUIRED'))
    try {
      const payload = verifyToken(token)
      const result  = await db.query(
        'SELECT token_version FROM users WHERE id = $1 LIMIT 1',
        [payload.sub]
      )
      const row = result.rows[0]
      if (!row || row.token_version !== (payload.tv ?? 1)) {
        return next(new Error('AUTH_INVALID'))
      }
      socket.userId   = payload.sub
      socket.username = payload.username
      socket.tier     = payload.tier    ?? 'free'
      socket.isAdmin  = payload.isAdmin ?? false
      next()
    } catch {
      next(new Error('AUTH_INVALID'))
    }
  })

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    // DEV-only: log every connect so the terminal shows live activity during
    // development without adding noise to production logs.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[socket] + uid=${socket.userId} (${socket.username})`)
    }

    // ── Per-user room — allows server-side targeted emits from REST routes ────
    // Room name: `user:<userId>`. Each user's tabs all join the same room so
    // a single io.to('user:<id>').emit(...) reaches all their open tabs.
    socket.join(`user:${socket.userId}`)

    // ── Presence: register socket, broadcast if first tab coming online ──────
    addPresence(socket.userId, socket.id)
    if (presenceMap.get(socket.userId).size === 1) {
      // First socket for this user — they just came online
      io.to('admin:presence').emit('admin:presence_update', {
        userId: socket.userId,
        online: true,
      })
    }

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
      if (!checkActionRate(socket.userId)) {
        return callback({ error: 'Too many requests. Slow down.' })
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
          `SELECT id, user_id, username, body, metadata, created_at
           FROM campaign_messages
           WHERE campaign_id = $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [campaignId]
        )

        // Fetch current torch timer state from campaigns table
        const timerResult = await db.query(
          'SELECT light_timer_expires_at, light_timer_remaining_secs FROM campaigns WHERE id = $1',
          [campaignId]
        )
        const timerRow = timerResult.rows[0] ?? {}

        // Inform late-joining players if spectator mode is already active
        const session = spectatorSessions.get(campaignId)
        const spectatorModeActive = session?.status === 'active'

        callback({
          messages:             history.rows.reverse(),
          spectatorModeActive,
          lightTimerExpiresAt:  timerRow.light_timer_expires_at   ?? null,
          lightTimerRemaining:  timerRow.light_timer_remaining_secs ?? 3600,
        })
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
    // Payload : { campaignId: string, body: string, metadata?: object }
    // Callback: { ok: true } | { error: string }
    socket.on('send_message', async ({ campaignId, body, metadata } = {}, callback) => {
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

        // Sanitize optional metadata — only allow known dice roll shape
        const safeMeta = (metadata && typeof metadata === 'object' && metadata.type === 'dice')
          ? {
              type:     'dice',
              notation: String(metadata.notation ?? '').slice(0, 20),
              count:    Math.max(1, Math.min(100, Math.floor(Number(metadata.count)  || 1))),
              sides:    Math.max(2, Math.min(1000, Math.floor(Number(metadata.sides) || 6))),
              rolls:    Array.isArray(metadata.rolls)
                          ? metadata.rolls
                              .map(Number)
                              .filter(n => Number.isFinite(n))
                              .map(n => Math.max(-9999, Math.min(9999, Math.floor(n))))
                              .slice(0, 100)
                          : [],
              total:    Number.isFinite(Number(metadata.total)) ? Number(metadata.total) : 0,
              variant:  ['standard', 'advantage', 'disadvantage'].includes(metadata.variant)
                          ? metadata.variant
                          : 'standard',
            }
          : null

        const result = await db.query(
          `INSERT INTO campaign_messages (campaign_id, user_id, username, body, metadata)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, user_id, username, body, metadata, created_at`,
          [campaignId, socket.userId, socket.username, trimmed, safeMeta ? JSON.stringify(safeMeta) : null]
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
      if (!checkActionRate(socket.userId)) {
        return callback({ error: 'Too many requests. Slow down.' })
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

        // Block check — reject silently if either party has blocked the other
        const blockCheck = await db.query(
          `SELECT 1 FROM user_blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [socket.userId, targetUserId]
        )
        if (blockCheck.rows.length > 0) {
          return callback({ error: 'Unable to open conversation.' })
        }

        // Deterministic room key: always lower UUID first
        const roomKey = [socket.userId, targetUserId].sort().join(':')
        socket.join(`dm:${roomKey}`)

        // Fetch last 50 messages for this conversation pair (both directions)
        const history = await db.query(
          `SELECT id, sender_id, sender_username, recipient_id, recipient_username,
                  body, metadata, created_at
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
    // Payload : { targetUserId: string, body: string, metadata?: object }
    // Callback: { ok: true } | { error: string }
    socket.on('send_dm', async ({ targetUserId, body, metadata } = {}, callback) => {
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

        // Block check — reject silently if either party has blocked the other
        const blockCheck = await db.query(
          `SELECT 1 FROM user_blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [socket.userId, targetUserId]
        )
        if (blockCheck.rows.length > 0) {
          return callback({ error: 'Unable to send message.' })
        }

        const safeDMMeta = (metadata && typeof metadata === 'object' && metadata.type === 'dice')
          ? {
              type:     'dice',
              notation: String(metadata.notation ?? '').slice(0, 20),
              count:    Math.max(1, Math.min(100, Math.floor(Number(metadata.count)  || 1))),
              sides:    Math.max(2, Math.min(1000, Math.floor(Number(metadata.sides) || 6))),
              rolls:    Array.isArray(metadata.rolls)
                          ? metadata.rolls
                              .map(Number)
                              .filter(n => Number.isFinite(n))
                              .map(n => Math.max(-9999, Math.min(9999, Math.floor(n))))
                              .slice(0, 100)
                          : [],
              total:    Number.isFinite(Number(metadata.total)) ? Number(metadata.total) : 0,
              variant:  ['standard', 'advantage', 'disadvantage'].includes(metadata.variant)
                          ? metadata.variant
                          : 'standard',
            }
          : null

        const result = await db.query(
          `INSERT INTO dm_messages
             (sender_id, sender_username, recipient_id, recipient_username, body, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, sender_id, sender_username, recipient_id, recipient_username,
                     body, metadata, created_at`,
          [socket.userId, socket.username, targetUserId, targetUser.username, trimmed, safeDMMeta ? JSON.stringify(safeDMMeta) : null]
        )

        const message = result.rows[0]
        const roomKey = [socket.userId, targetUserId].sort().join(':')

        // Broadcast to both ends of the open conversation (if both have the window open).
        io.to(`dm:${roomKey}`).emit('new_dm', message)
        // Also notify the recipient via their always-joined personal room so they
        // receive the message and unread dot even when the DM window isn't open.
        // The frontend deduplicates by message ID, so double delivery is harmless.
        io.to(`user:${targetUserId}`).emit('new_dm', message)

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
    // Who sends: any authenticated client navigating away from the room-selection screen.
    // What it does: removes the socket from the `lobby` Socket.io room so it
    //   no longer receives room_counts_update or spectator_sessions_update pushes.
    // What it emits: nothing. Purely a cleanup call.
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
        tier:     socket.tier,
        isAdmin:  socket.isAdmin,
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

    // Who sends: any authenticated client clicking Back or navigating away from a public room.
    //   Also called internally from the disconnect handler.
    // What it does: calls leavePublicRoom(), which removes the socket from the
    //   `public:<roomId>` Socket.io room and erases the socket's occupant entry.
    // What it emits: broadcasts `room_occupants` (updated list) to `public:<roomId>`
    //   and `room_counts_update` to `lobby`.
    socket.on('leave_public_room', ({ roomId } = {}) => leavePublicRoom(roomId))

    // ── send_public_message ───────────────────────────────────────────────────
    // Broadcast a message to a public room. No persistence — ephemeral only.
    // Messages are lost when the server restarts, matching the tavern vibe.
    //
    // Payload : { roomId: string, body: string, metadata?: object }
    // Callback: { ok: true } | { error: string }
    socket.on('send_public_message', ({ roomId, body, metadata } = {}, callback) => {
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
      const safePublicMeta = (metadata && typeof metadata === 'object' && metadata.type === 'dice')
        ? {
            type:     'dice',
            notation: String(metadata.notation ?? '').slice(0, 20),
            count:    Math.max(1, Math.min(100, Math.floor(Number(metadata.count)  || 1))),
            sides:    Math.max(2, Math.min(1000, Math.floor(Number(metadata.sides) || 6))),
            rolls:    Array.isArray(metadata.rolls)
                        ? metadata.rolls
                            .map(Number)
                            .filter(n => Number.isFinite(n))
                            .map(n => Math.max(-9999, Math.min(9999, Math.floor(n))))
                            .slice(0, 100)
                        : [],
            total:    Number.isFinite(Number(metadata.total)) ? Number(metadata.total) : 0,
            variant:  ['standard', 'advantage', 'disadvantage'].includes(metadata.variant)
                        ? metadata.variant
                        : 'standard',
          }
        : null
      const message = {
        id:             randomUUID(),
        username:       socket.username,
        user_id:        socket.userId,
        supporter_tier: socket.tier,
        is_admin:       socket.isAdmin,
        body:           trimmed,
        metadata:       safePublicMeta,
        created_at:     new Date().toISOString(),
      }

      io.to(`public:${roomId}`).emit('room_message', message)
      callback({ ok: true })
    })

    // ────────────────────────────────────────────────────────────────────────
    // ── TORCH TIMER EVENTS ───────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────
    // Campaign-scoped light timer. Independent of combat sessions — a torch
    // burns whether or not a fight is in progress. Canonical state is stored
    // in campaigns.light_timer_expires_at / light_timer_remaining_secs.
    // GM pushes changes here; server persists and broadcasts to the entire
    // campaign room (GM + players + spectators all see the same countdown).

    // ── push_light_timer ──────────────────────────────────────────────────────
    // GM-only. Persists the timer action to the DB then broadcasts
    // 'light_timer_update' to all sockets in campaign:<id>.
    //
    // Payload : { campaignId, action: 'start'|'pause'|'reset', secs?: number }
    // Callback: { ok: true } | { error: string }
    socket.on('push_light_timer', async ({ campaignId, action, secs } = {}, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {}

      if (!campaignId || !UUID_RE.test(campaignId)) {
        return cb({ error: 'Invalid campaign ID.' })
      }
      if (!['start', 'pause', 'reset'].includes(action)) {
        return cb({ error: 'action must be start, pause, or reset.' })
      }

      try {
        // Validate GM
        const campRow = await db.query(
          'SELECT gm_user_id FROM campaigns WHERE id = $1 AND is_deleted = false LIMIT 1',
          [campaignId]
        )
        if (campRow.rows[0]?.gm_user_id !== socket.userId) {
          return cb({ error: 'Only the GM can control the torch timer.' })
        }

        let expiresAt, remainingSecs

        if (action === 'start') {
          // Use current remaining from DB (never start from 0)
          const cur = await db.query(
            'SELECT light_timer_remaining_secs FROM campaigns WHERE id = $1',
            [campaignId]
          )
          const remaining = cur.rows[0]?.light_timer_remaining_secs ?? 3600
          const startSecs = remaining > 0 ? remaining : 3600
          const result = await db.query(
            `UPDATE campaigns
             SET light_timer_expires_at     = NOW() + ($1 * interval '1 second'),
                 light_timer_remaining_secs = $1
             WHERE id = $2
             RETURNING light_timer_expires_at, light_timer_remaining_secs`,
            [startSecs, campaignId]
          )
          expiresAt    = result.rows[0].light_timer_expires_at
          remainingSecs = result.rows[0].light_timer_remaining_secs

        } else if (action === 'pause') {
          // CASE guard: if already paused (expires_at IS NULL), keep existing remaining_secs
          // rather than computing GREATEST(0, NULL) which violates the NOT NULL constraint.
          const result = await db.query(
            `UPDATE campaigns
             SET light_timer_remaining_secs = CASE
                   WHEN light_timer_expires_at IS NOT NULL
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (light_timer_expires_at - NOW()))::int)
                   ELSE light_timer_remaining_secs
                 END,
                 light_timer_expires_at = NULL
             WHERE id = $1
             RETURNING light_timer_expires_at, light_timer_remaining_secs`,
            [campaignId]
          )
          expiresAt    = null
          remainingSecs = result.rows[0].light_timer_remaining_secs

        } else {
          // reset — set a new duration, clear running state
          const newSecs = (secs != null && Number.isFinite(secs)) ? Math.max(0, Math.min(86400, secs)) : 3600
          const result = await db.query(
            `UPDATE campaigns
             SET light_timer_remaining_secs = $1,
                 light_timer_expires_at     = NULL
             WHERE id = $2
             RETURNING light_timer_expires_at, light_timer_remaining_secs`,
            [newSecs, campaignId]
          )
          expiresAt    = null
          remainingSecs = result.rows[0].light_timer_remaining_secs
        }

        // Broadcast to ALL in the campaign room — GM, players, spectators
        io.to(`campaign:${campaignId}`).emit('light_timer_update', {
          campaignId,
          expiresAt:    expiresAt ?? null,
          remainingSecs: remainingSecs ?? 3600,
        })

        cb({ ok: true })
      } catch (err) {
        console.error('[socket:push_light_timer]', err)
        cb({ error: 'Timer update failed.' })
      }
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
      if (!checkActionRate(socket.userId)) {
        return callback({ error: 'Too many requests. Slow down.' })
      }

      try {
        const ok = await isCampaignMember(campaignId, socket.userId)
        if (!ok) return callback({ error: 'Access denied.' })

        socket.join(`combat:${campaignId}`)
        socket.currentCombatCampaignId = campaignId

        // Return current active session state so players get it when joining mid-combat
        const campResult = await db.query(
          'SELECT gm_user_id FROM campaigns WHERE id = $1 AND is_deleted = false LIMIT 1',
          [campaignId]
        )
        const isGM = campResult.rows[0]?.gm_user_id === socket.userId

        // Explicit columns — avoids leaking internal fields if combat_sessions
        // gains new columns in the future.
        const sessResult = await db.query(
          `SELECT id, campaign_id, is_active, combatants, round_number, combat_mode, created_at, updated_at
           FROM combat_sessions
           WHERE campaign_id = $1 AND is_active = true
           ORDER BY created_at DESC LIMIT 1`,
          [campaignId]
        )
        const session = sessResult.rows[0] ?? null

        if (session && !isGM) {
          session.combatants = sanitizeCombatantsForPlayers(session.combatants)
        }

        callback({ ok: true, session })
      } catch (err) {
        console.error('[socket:join_combat]', err)
        callback({ error: 'Failed to join combat room.' })
      }
    })

    // ── leave_combat ──────────────────────────────────────────────────────────
    // Who sends: GM or any authenticated player navigating away from the combat tracker.
    // What it does: removes the socket from the `combat:<campaignId>` room and
    //   clears socket.currentCombatCampaignId. Socket.io also auto-cleans on disconnect,
    //   but explicit leave keeps the room membership accurate while the tab is still open.
    // What it emits: nothing directly. The GM's next push_combat_update will simply
    //   reach one fewer recipient.
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
    socket.on('push_combat_update', async ({ campaignId, combatants, roundNumber, eventType, phase, activeIndex, combatMode } = {}) => {
      if (!campaignId || !UUID_RE.test(campaignId)) return

      // Only validated GMs may push state
      try {
        const r = await db.query(
          'SELECT gm_user_id FROM campaigns WHERE id = $1 AND is_deleted = false',
          [campaignId]
        )
        if (r.rows[0]?.gm_user_id !== socket.userId) return

        // Sanitize monster HP before broadcasting to players
        const sanitized = sanitizeCombatantsForPlayers(combatants)

        // Broadcast to players (not back to GM — they already have it)
        socket.to(`combat:${campaignId}`).emit('combat_update', {
          combatants:  sanitized,
          roundNumber,
          eventType:   eventType ?? 'update',
          phase,
          activeIndex,
          combatMode,
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
      if (!checkActionRate(socket.userId)) {
        return callback({ error: 'Too many requests. Slow down.' })
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
    // Who sends: any authenticated user who was watching a spectator session
    //   (e.g., SpectatorView.jsx unmount or clicking Leave).
    // What it does: removes the socket from `spectator:<campaignId>`, decrements
    //   session.spectatorCount, and clears socket.currentSpectatorCampaignId.
    // What it emits:
    //   - `spectator_count_update` → `campaign:<campaignId>` (so the GM sees live
    //     watcher numbers drop)
    //   - `spectator_sessions_update` → `lobby` (updates the watcher count on the
    //     room-selection screen)
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

    // ────────────────────────────────────────────────────────────────────────
    // ── ADMIN PRESENCE EVENTS ────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────

    // ── admin:watch_presence ──────────────────────────────────────────────────
    // Called by admin/moderator dashboards on mount. Joins the 'admin:presence'
    // Socket.io room and returns a full snapshot of currently online users.
    // Only admins and moderators are admitted — all others get ACCESS_DENIED.
    //
    // Callback: { snapshot: { userId }[] } | { error: string }
    socket.on('admin:watch_presence', async (_, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {}
      try {
        const result = await db.query(
          'SELECT is_admin, is_moderator FROM users WHERE id = $1 LIMIT 1',
          [socket.userId]
        )
        const u = result.rows[0]
        if (!u || (!u.is_admin && !u.is_moderator)) {
          return cb({ error: 'Access denied.' })
        }
        socket.join('admin:presence')
        cb({ snapshot: getPresenceSnapshot() })
      } catch (err) {
        console.error('[socket:admin:watch_presence]', err)
        cb({ error: 'Failed to load presence data.' })
      }
    })

    // ── admin:unwatch_presence ────────────────────────────────────────────────
    // Called when an admin/moderator navigates away from their dashboard.
    // Removes the socket from the broadcast room so they stop receiving updates.
    socket.on('admin:unwatch_presence', () => {
      socket.leave('admin:presence')
    })

    // ── disconnect ────────────────────────────────────────────────────────────
    // Fired automatically by Socket.io when the underlying transport closes
    // (tab closed, network drop, server-initiated kick via AUTH_INVALID, etc.).
    // Not sent by the client explicitly.
    //
    // What it does (in order):
    //  1. Calls leavePublicRoom() if the socket was in a public chat room —
    //     removes them from occupant tracking and updates all lobby screens.
    //  2. If the socket was a spectator, decrements the watcher count and
    //     pushes the updated count to the campaign room and lobby.
    //  3. If the socket belonged to a GM who owned a spectator session:
    //     - 'pending' → cancelSpectatorSession() (notifies players, removes lobby entry)
    //     - 'active'  → endSpectatorSession() (notifies campaign room + spectators + lobby)
    //     A GM can only own one session at a time, so we break after the first match.
    //
    // Note: campaign and combat room memberships (socket.currentCampaignId /
    // socket.currentCombatCampaignId) are cleaned up automatically by Socket.io
    // room bookkeeping — no manual action needed for those.
    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[socket] - uid=${socket.userId} (${socket.username})`)
      }

      // ── Global presence: remove socket, broadcast if last tab went offline ──
      const wentOffline = removePresence(socket.userId, socket.id)
      if (wentOffline) {
        io.to('admin:presence').emit('admin:presence_update', {
          userId: socket.userId,
          online: false,
        })
      }

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

// Returns the active io instance — used by REST routes to push events to users.
// Returns null before createSocketServer() is called (server startup race is safe
// because routes only call getIO() inside async handlers, never at require-time).
function getIO() { return _io }

module.exports = { createSocketServer, getIO }
