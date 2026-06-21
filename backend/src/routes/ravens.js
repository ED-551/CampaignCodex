/**
 * The Raven Post — internal mail system
 * All routes require authentication.
 *
 * GET    /api/ravens/unread-count  — badge count for nav
 * GET    /api/ravens/inbox         — paginated inbox
 * GET    /api/ravens/sent          — paginated sent box
 * GET    /api/ravens/:id           — single message (full body)
 * POST   /api/ravens               — send a raven (rate-limited)
 * PATCH  /api/ravens/:id/read      — mark as read (recipient only)
 * DELETE /api/ravens/:id           — soft-delete (per-side)
 */

const express    = require('express')
const { body, query, validationResult } = require('express-validator')
const db         = require('../db')
const { requireAuth }    = require('../middleware/auth')
const { ravensLimiter }  = require('../middleware/rateLimiter')

const router = express.Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(val) {
  return typeof val === 'string' && UUID_RE.test(val)
}

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

const PAGE_SIZE = 25

// ─── GET /api/ravens/unread-count ────────────────────────────────────────────
// Returns the number of unread inbox messages for the nav badge.
// Uses the partial index on (recipient_id) WHERE read_at IS NULL AND deleted_by_recipient = false.
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS count
       FROM raven_messages
       WHERE recipient_id = $1
         AND read_at IS NULL
         AND deleted_by_recipient = false`,
      [req.user.sub]
    )
    res.json({ count: parseInt(result.rows[0].count, 10) })
  } catch (err) {
    console.error('[ravens/unread-count]', err)
    res.status(500).json({ error: 'Failed to fetch unread count.' })
  }
})

// ─── GET /api/ravens/inbox ───────────────────────────────────────────────────
// Paginated inbox. Returns message metadata + 200-char body preview.
router.get('/inbox', requireAuth, [
  query('page').optional().isInt({ min: 1 }).toInt(),
], async (req, res) => {
  if (validationErrors(req, res)) return
  const page   = req.query.page ?? 1
  const offset = (page - 1) * PAGE_SIZE

  try {
    const [rows, countRow] = await Promise.all([
      db.query(
        `SELECT
           rm.id,
           rm.subject,
           LEFT(rm.body, 200) AS body_preview,
           rm.created_at,
           rm.read_at,
           rm.character_id,
           u.id             AS sender_id,
           u.username       AS sender_username,
           u.supporter_tier AS sender_supporter_tier,
           u.is_admin       AS sender_is_admin,
           ch.character_name,
           ch.game_system AS character_game_system
         FROM raven_messages rm
         JOIN  users      u  ON u.id  = rm.sender_id
         LEFT JOIN characters ch ON ch.id = rm.character_id
         WHERE rm.recipient_id         = $1
           AND rm.deleted_by_recipient = false
         ORDER BY rm.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.sub, PAGE_SIZE, offset]
      ),
      db.query(
        `SELECT COUNT(*) AS total
         FROM raven_messages
         WHERE recipient_id = $1 AND deleted_by_recipient = false`,
        [req.user.sub]
      ),
    ])

    res.json({
      messages: rows.rows,
      total:    parseInt(countRow.rows[0].total, 10),
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error('[ravens/inbox]', err)
    res.status(500).json({ error: 'Failed to fetch inbox.' })
  }
})

// ─── GET /api/ravens/sent ────────────────────────────────────────────────────
// Paginated sent box.
router.get('/sent', requireAuth, [
  query('page').optional().isInt({ min: 1 }).toInt(),
], async (req, res) => {
  if (validationErrors(req, res)) return
  const page   = req.query.page ?? 1
  const offset = (page - 1) * PAGE_SIZE

  try {
    const [rows, countRow] = await Promise.all([
      db.query(
        `SELECT
           rm.id,
           rm.subject,
           LEFT(rm.body, 200) AS body_preview,
           rm.created_at,
           rm.read_at,
           rm.character_id,
           u.id         AS recipient_id,
           u.username   AS recipient_username,
           ch.character_name,
           ch.game_system AS character_game_system
         FROM raven_messages rm
         JOIN  users      u  ON u.id  = rm.recipient_id
         LEFT JOIN characters ch ON ch.id = rm.character_id
         WHERE rm.sender_id         = $1
           AND rm.deleted_by_sender = false
         ORDER BY rm.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.sub, PAGE_SIZE, offset]
      ),
      db.query(
        `SELECT COUNT(*) AS total
         FROM raven_messages
         WHERE sender_id = $1 AND deleted_by_sender = false`,
        [req.user.sub]
      ),
    ])

    res.json({
      messages: rows.rows,
      total:    parseInt(countRow.rows[0].total, 10),
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error('[ravens/sent]', err)
    res.status(500).json({ error: 'Failed to fetch sent box.' })
  }
})

// ─── GET /api/ravens/:id ─────────────────────────────────────────────────────
// Full message. Only sender or recipient may read it.
router.get('/:id', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid message ID.' })
  }

  try {
    const result = await db.query(
      `SELECT
         rm.*,
         s.username       AS sender_username,
         s.supporter_tier AS sender_supporter_tier,
         s.is_admin       AS sender_is_admin,
         r.username       AS recipient_username,
         ch.character_name,
         ch.game_system AS character_game_system
       FROM raven_messages rm
       JOIN users s  ON s.id = rm.sender_id
       JOIN users r  ON r.id = rm.recipient_id
       LEFT JOIN characters ch ON ch.id = rm.character_id
       WHERE rm.id = $1`,
      [req.params.id]
    )

    const msg = result.rows[0]
    if (!msg) return res.status(404).json({ error: 'Message not found.' })

    // Only sender or recipient may access this message
    if (msg.sender_id !== req.user.sub && msg.recipient_id !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    // If recipient is reading and the message was deleted by recipient, deny
    if (msg.recipient_id === req.user.sub && msg.deleted_by_recipient) {
      return res.status(404).json({ error: 'Message not found.' })
    }
    // If sender is reading and deleted by sender, deny
    if (msg.sender_id === req.user.sub && msg.deleted_by_sender) {
      return res.status(404).json({ error: 'Message not found.' })
    }

    res.json({ message: msg })
  } catch (err) {
    console.error('[ravens/get]', err)
    res.status(500).json({ error: 'Failed to fetch message.' })
  }
})

// ─── POST /api/ravens ────────────────────────────────────────────────────────
// Send a raven. Rate-limited to 20/hour per IP.
router.post('/', requireAuth, ravensLimiter, [
  body('recipientId')
    .trim()
    .notEmpty().withMessage('Recipient is required.')
    .custom(val => isUUID(val)).withMessage('Invalid recipient.'),
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required.')
    .isLength({ max: 120 }).withMessage('Subject must be 120 characters or fewer.'),
  body('body')
    .trim()
    .notEmpty().withMessage('Message body is required.')
    .isLength({ max: 5000 }).withMessage('Message body must be 5,000 characters or fewer.'),
  body('characterId')
    .optional({ nullable: true })
    .custom(val => val === null || val === '' || isUUID(val))
    .withMessage('Invalid character ID.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const senderId = req.user.sub
  const { recipientId, subject, body: msgBody, characterId } = req.body

  // Can't send to yourself
  if (recipientId === senderId) {
    return res.status(400).json({ error: 'You cannot send a raven to yourself.' })
  }

  try {
    // Verify recipient exists
    const recipResult = await db.query(
      'SELECT id FROM users WHERE id = $1', [recipientId]
    )
    if (!recipResult.rows.length) {
      return res.status(404).json({ error: 'Recipient not found.' })
    }

    // If character attached, verify it belongs to the sender
    let safeCharId = null
    if (characterId && characterId !== '') {
      const charResult = await db.query(
        'SELECT id FROM characters WHERE id = $1 AND user_id = $2',
        [characterId, senderId]
      )
      if (!charResult.rows.length) {
        return res.status(403).json({ error: 'You can only attach your own character sheets.' })
      }
      safeCharId = characterId
    }

    const result = await db.query(
      `INSERT INTO raven_messages (sender_id, recipient_id, subject, body, character_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, subject, created_at`,
      [senderId, recipientId, subject.trim(), msgBody.trim(), safeCharId]
    )

    res.status(201).json({ message: result.rows[0] })
  } catch (err) {
    console.error('[ravens/send]', err)
    res.status(500).json({ error: 'Failed to send raven.' })
  }
})

// ─── PATCH /api/ravens/:id/read ──────────────────────────────────────────────
// Mark a message as read. Only the recipient may do this.
router.patch('/:id/read', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid message ID.' })
  }

  try {
    const result = await db.query(
      `UPDATE raven_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND recipient_id = $2
         AND deleted_by_recipient = false
       RETURNING id, read_at`,
      [req.params.id, req.user.sub]
    )

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Message not found.' })
    }

    res.json({ message: result.rows[0] })
  } catch (err) {
    console.error('[ravens/read]', err)
    res.status(500).json({ error: 'Failed to mark as read.' })
  }
})

// ─── DELETE /api/ravens/:id ──────────────────────────────────────────────────
// Soft-delete — sets deleted_by_sender or deleted_by_recipient based on who
// is deleting. Both parties can delete independently without affecting the other.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid message ID.' })
  }

  try {
    const result = await db.query(
      `UPDATE raven_messages
       SET
         deleted_by_sender    = CASE WHEN sender_id    = $1 THEN true ELSE deleted_by_sender    END,
         deleted_by_recipient = CASE WHEN recipient_id = $1 THEN true ELSE deleted_by_recipient END
       WHERE id = $2
         AND (sender_id = $1 OR recipient_id = $1)
       RETURNING id`,
      [req.user.sub, req.params.id]
    )

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Message not found.' })
    }

    res.json({ message: 'Raven dismissed.' })
  } catch (err) {
    console.error('[ravens/delete]', err)
    res.status(500).json({ error: 'Failed to delete message.' })
  }
})

module.exports = router
