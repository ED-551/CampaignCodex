/**
 * Social routes — friends, friend requests, and user blocks.
 *
 * All routes require authentication. Block operations require an explicit
 * { confirm: true } body parameter so accidental HTTP calls don't silently
 * block people.
 *
 * Friend model: the friend_requests table doubles as the friendship table.
 * A row with status='accepted' IS the friendship. Querying friends means
 * finding all accepted rows where the current user is sender OR receiver.
 *
 * Block semantics (enforced here AND in socket.js):
 *  - A blocks B → B cannot DM A, cannot see A in search, cannot send requests to A.
 *  - A blocking B auto-removes any existing friendship between them.
 *  - Block is private — B is never notified they were blocked.
 */

const express = require('express')
const { param, body, validationResult } = require('express-validator')
const rateLimit = require('express-rate-limit')
const db        = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// All social routes require auth
router.use(requireAuth)

// Rate limiter for friend request sends — 20/hour per IP
const friendRequestLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many friend requests. Try again later.' },
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validUUID(val) { return UUID_RE.test(val) }

// ─── GET /api/social/friends ──────────────────────────────────────────────────
// Returns all accepted friendships for the current user.
// Never exposes email, real names, or any sensitive field.
router.get('/friends', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         fr.id           AS request_id,
         fr.created_at   AS friends_since,
         CASE WHEN fr.sender_id = $1 THEN fr.receiver_id ELSE fr.sender_id END AS friend_id,
         CASE WHEN fr.sender_id = $1 THEN u2.username    ELSE u1.username   END AS friend_username
       FROM friend_requests fr
       JOIN users u1 ON u1.id = fr.sender_id
       JOIN users u2 ON u2.id = fr.receiver_id
       WHERE (fr.sender_id = $1 OR fr.receiver_id = $1)
         AND fr.status = 'accepted'
       ORDER BY friend_username ASC`,
      [req.user.sub]
    )
    res.json({ friends: result.rows })
  } catch (err) {
    console.error('[social/friends]', err)
    res.status(500).json({ error: 'Failed to load friends.' })
  }
})

// ─── GET /api/social/friend-requests/incoming ─────────────────────────────────
// Pending requests other users have sent to me.
router.get('/friend-requests/incoming', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT fr.id, fr.sender_id, u.username AS sender_username, fr.created_at
       FROM friend_requests fr
       JOIN users u ON u.id = fr.sender_id
       WHERE fr.receiver_id = $1
         AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.sub]
    )
    res.json({ requests: result.rows })
  } catch (err) {
    console.error('[social/requests/incoming]', err)
    res.status(500).json({ error: 'Failed to load requests.' })
  }
})

// ─── GET /api/social/friend-requests/outgoing ─────────────────────────────────
// Requests I've sent that are still pending — used to show "Pending…" state in UI.
router.get('/friend-requests/outgoing', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT fr.id, fr.receiver_id, u.username AS receiver_username, fr.created_at
       FROM friend_requests fr
       JOIN users u ON u.id = fr.receiver_id
       WHERE fr.sender_id = $1
         AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.sub]
    )
    res.json({ outgoing: result.rows })
  } catch (err) {
    console.error('[social/requests/outgoing]', err)
    res.status(500).json({ error: 'Failed to load outgoing requests.' })
  }
})

// ─── POST /api/social/friend-request/:targetId ───────────────────────────────
// Send a friend request to another user.
router.post('/friend-request/:targetId', friendRequestLimiter, [
  param('targetId').custom(validUUID).withMessage('Invalid user ID.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { targetId } = req.params
  const myId = req.user.sub

  if (targetId === myId) {
    return res.status(400).json({ error: 'Cannot send a friend request to yourself.' })
  }

  try {
    // Verify target exists and is not an admin (admin accounts are not social participants)
    const target = await db.query(
      'SELECT id, username FROM users WHERE id = $1 AND is_admin = false LIMIT 1',
      [targetId]
    )
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' })
    }

    // Block check — if either party has blocked the other, silently return 200
    // (don't reveal to the sender that they've been blocked)
    const blockCheck = await db.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [myId, targetId]
    )
    if (blockCheck.rows.length > 0) {
      // Return 200 so the sender doesn't know they're blocked
      return res.json({ ok: true })
    }

    // Check for existing relationship
    const existing = await db.query(
      `SELECT id, status, sender_id FROM friend_requests
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       LIMIT 1`,
      [myId, targetId]
    )

    if (existing.rows.length > 0) {
      const row = existing.rows[0]
      if (row.status === 'accepted') {
        return res.status(409).json({ error: 'Already friends.' })
      }
      if (row.status === 'pending' && row.sender_id === myId) {
        return res.status(409).json({ error: 'Request already sent.' })
      }
      // If the other person sent us a request, auto-accept it
      if (row.status === 'pending' && row.sender_id === targetId) {
        await db.query(
          `UPDATE friend_requests SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        )
        return res.json({ ok: true, status: 'accepted', requestId: row.id })
      }
      // If previously denied, allow re-send by updating to pending
      if (row.status === 'denied') {
        await db.query(
          `UPDATE friend_requests
           SET status = 'pending', sender_id = $1, receiver_id = $2, updated_at = NOW()
           WHERE id = $3`,
          [myId, targetId, row.id]
        )
        return res.json({ ok: true, status: 'pending', requestId: row.id })
      }
    }

    // Insert new request
    const insert = await db.query(
      `INSERT INTO friend_requests (sender_id, receiver_id)
       VALUES ($1, $2)
       RETURNING id`,
      [myId, targetId]
    )
    res.status(201).json({ ok: true, status: 'pending', requestId: insert.rows[0].id })
  } catch (err) {
    console.error('[social/friend-request]', err)
    res.status(500).json({ error: 'Failed to send friend request.' })
  }
})

// ─── PATCH /api/social/friend-request/:requestId ─────────────────────────────
// Accept or deny a pending friend request addressed to me.
router.patch('/friend-request/:requestId', [
  param('requestId').custom(validUUID).withMessage('Invalid request ID.'),
  body('action')
    .isIn(['accepted', 'denied']).withMessage('Action must be "accepted" or "denied".'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { requestId } = req.params
  const { action } = req.body

  try {
    // Only the receiver can respond to a request
    const result = await db.query(
      `UPDATE friend_requests
       SET status = $1, updated_at = NOW()
       WHERE id = $2
         AND receiver_id = $3
         AND status = 'pending'
       RETURNING id, status, sender_id`,
      [action, requestId, req.user.sub]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already resolved.' })
    }

    res.json({ ok: true, status: action, requestId: result.rows[0].id })
  } catch (err) {
    console.error('[social/respond-request]', err)
    res.status(500).json({ error: 'Failed to respond to request.' })
  }
})

// ─── DELETE /api/social/friend/:friendId ─────────────────────────────────────
// Remove an existing friendship (unfriend). Deletes the request row entirely
// so either party can send a new request later without any constraint violations.
router.delete('/friend/:friendId', [
  param('friendId').custom(validUUID).withMessage('Invalid user ID.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { friendId } = req.params

  try {
    await db.query(
      `DELETE FROM friend_requests
       WHERE status = 'accepted'
         AND (
           (sender_id   = $1 AND receiver_id = $2) OR
           (sender_id   = $2 AND receiver_id = $1)
         )`,
      [req.user.sub, friendId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[social/unfriend]', err)
    res.status(500).json({ error: 'Failed to remove friend.' })
  }
})

// ─── POST /api/social/block/:targetId ────────────────────────────────────────
// Block a user. Requires { confirm: true } in the body to prevent accidental calls.
// Automatically removes any existing friendship with the blocked user.
router.post('/block/:targetId', [
  param('targetId').custom(validUUID).withMessage('Invalid user ID.'),
  body('confirm').custom(val => val === true).withMessage('Confirmation required.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { targetId } = req.params
  const myId = req.user.sub

  if (targetId === myId) {
    return res.status(400).json({ error: 'Cannot block yourself.' })
  }

  try {
    // Verify target exists
    const target = await db.query(
      'SELECT id FROM users WHERE id = $1 LIMIT 1',
      [targetId]
    )
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' })
    }

    // Use a transaction so the block + friendship removal are atomic
    await db.query('BEGIN')
    try {
      // Insert block (ignore if already blocked)
      await db.query(
        `INSERT INTO user_blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [myId, targetId]
      )

      // Remove any existing friendship or pending requests between the two
      await db.query(
        `DELETE FROM friend_requests
         WHERE (sender_id = $1 AND receiver_id = $2)
            OR (sender_id = $2 AND receiver_id = $1)`,
        [myId, targetId]
      )

      await db.query('COMMIT')
    } catch (txErr) {
      await db.query('ROLLBACK')
      throw txErr
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[social/block]', err)
    res.status(500).json({ error: 'Failed to block user.' })
  }
})

// ─── DELETE /api/social/block/:targetId ──────────────────────────────────────
// Unblock a user.
router.delete('/block/:targetId', [
  param('targetId').custom(validUUID).withMessage('Invalid user ID.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  try {
    await db.query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [req.user.sub, req.params.targetId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[social/unblock]', err)
    res.status(500).json({ error: 'Failed to unblock user.' })
  }
})

module.exports = router
