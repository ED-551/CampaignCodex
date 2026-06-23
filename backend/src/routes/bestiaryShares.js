/**
 * Bestiary Shares routes — /api/bestiary/shares
 *
 * Lets users gift monster stat blocks to other users. The full monster data is
 * snapshotted at send-time so edits/deletions by the sender don't affect the
 * recipient's pending share. An automated Raven notification is fired on send.
 *
 * POST   /              — Send a share (rate-limited, 15/hr)
 * GET    /inbox         — Incoming pending shares for the authenticated user
 * POST   /:id/accept    — Accept all or a subset of the shared monsters
 * PATCH  /:id/dismiss   — Decline without adding anything
 *
 * All routes require authentication.
 */

const express = require('express')
const { body, validationResult } = require('express-validator')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')
const { shareLimiter } = require('../middleware/rateLimiter')

const router = express.Router()

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

const SYSTEM_LABELS = {
  shadowdark: 'Shadowdark',
  morkborg:   'Mörk Borg',
  nimble:     'Nimble RPG',
}

// ─── POST / ───────────────────────────────────────────────────────────────────
// Create a bestiary share. Snapshots monster data and fires a Raven notification.
router.post('/', requireAuth, shareLimiter, [
  body('toUserId')
    .trim().notEmpty().withMessage('Recipient is required.')
    .custom(val => isUUID(val)).withMessage('Invalid recipient ID.'),
  body('monsterIds')
    .isArray({ min: 1, max: 50 }).withMessage('Select between 1 and 50 monsters to share.')
    .custom(arr => arr.every(id => isUUID(id))).withMessage('Invalid monster ID in list.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const senderId  = req.user.sub
  const { toUserId, monsterIds } = req.body

  // Can't share to yourself
  if (toUserId === senderId) {
    return res.status(400).json({ error: 'You cannot share monsters with yourself.' })
  }

  try {
    // Verify recipient exists — fetch username for the raven subject at same time
    const recipientResult = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [toUserId]
    )
    if (!recipientResult.rows.length) {
      return res.status(404).json({ error: 'Recipient not found.' })
    }
    const recipient = recipientResult.rows[0]

    // Fetch sender username for raven body
    const senderResult = await db.query(
      'SELECT username FROM users WHERE id = $1',
      [senderId]
    )
    const senderUsername = senderResult.rows[0]?.username ?? 'Someone'

    // Fetch all requested monsters — must all belong to sender
    const monsterResult = await db.query(
      `SELECT id, name, challenge, tags, stat_data, game_system
       FROM monsters
       WHERE id = ANY($1::uuid[])
         AND user_id = $2`,
      [monsterIds, senderId]
    )

    if (monsterResult.rows.length !== monsterIds.length) {
      return res.status(403).json({
        error: 'One or more monsters were not found in your bestiary.',
      })
    }

    const monsters = monsterResult.rows

    // All monsters must be from the same game system
    const systems = [...new Set(monsters.map(m => m.game_system))]
    if (systems.length > 1) {
      return res.status(400).json({
        error: 'All shared monsters must be from the same game system.',
      })
    }

    const gameSystem  = systems[0]
    const systemLabel = SYSTEM_LABELS[gameSystem] ?? gameSystem

    // Block check — prevent shares when either party has blocked the other.
    // Mirrors the block enforcement in ravens.js so users cannot circumvent a
    // social block by gifting monsters instead of sending a direct message.
    const blockCheck = await db.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [senderId, toUserId]
    )
    if (blockCheck.rows.length) {
      return res.status(403).json({ error: 'You cannot share monsters with this user.' })
    }

    // Build snapshot (strip user_id from each record for clean transfer)
    const snapshot = monsters.map(m => ({
      id:        m.id,
      name:      m.name,
      challenge: m.challenge,
      tags:      m.tags,
      stat_data: m.stat_data,
    }))

    // Wrap share creation and raven notification in one transaction — if the
    // raven INSERT fails after the share is committed the recipient ends up with
    // a share they were never notified about. Atomicity prevents that split state.
    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      const shareResult = await client.query(
        `INSERT INTO bestiary_shares (from_user_id, to_user_id, game_system, monsters_data)
         VALUES ($1, $2, $3, $4)
         RETURNING id, game_system, created_at`,
        [senderId, toUserId, gameSystem, JSON.stringify(snapshot)]
      )
      const share = shareResult.rows[0]

      // Compose automated Raven notification
      const monsterCount = monsters.length
      const monsterList  = monsters.map(m => `• ${m.name}`).join('\n')
      const subject = `📦 ${senderUsername} shared ${monsterCount} monster${monsterCount !== 1 ? 's' : ''} from their ${systemLabel} bestiary`
      const body_   = [
        `${senderUsername} has gifted you ${monsterCount} monster${monsterCount !== 1 ? 's' : ''} from their ${systemLabel} bestiary!\n`,
        `Monsters included:\n${monsterList}\n`,
        `Visit your Bestiary Shares inbox to review and add them to your collection:`,
        `/bestiary/shares`,
      ].join('\n')

      await client.query(
        `INSERT INTO raven_messages (sender_id, recipient_id, subject, body)
         VALUES ($1, $2, $3, $4)`,
        [senderId, toUserId, subject, body_]
      )

      await client.query('COMMIT')

      res.status(201).json({
        share: {
          id:            share.id,
          to_username:   recipient.username,
          monster_count: monsterCount,
          game_system:   gameSystem,
          created_at:    share.created_at,
        },
      })
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[shares/create]', err)
    res.status(500).json({ error: 'Failed to send share.' })
  }
})

// ─── GET /inbox ───────────────────────────────────────────────────────────────
// Returns all pending incoming shares for the authenticated user.
router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         bs.id,
         bs.game_system,
         bs.monsters_data,
         bs.status,
         bs.created_at,
         u.id       AS from_user_id,
         u.username AS from_username
       FROM bestiary_shares bs
       JOIN users u ON u.id = bs.from_user_id
       WHERE bs.to_user_id = $1
         AND bs.status     = 'pending'
       ORDER BY bs.created_at DESC
       LIMIT 50`,
      [req.user.sub]
    )
    res.json({ shares: result.rows })
  } catch (err) {
    console.error('[shares/inbox]', err)
    res.status(500).json({ error: 'Failed to fetch shares.' })
  }
})

// ─── POST /:id/accept ─────────────────────────────────────────────────────────
// Accept a share in full or partially (by passing a subset of monsterIds).
// Creates new monsters in the recipient's bestiary from the snapshot.
router.post('/:id/accept', requireAuth, [
  body('monsterIds')
    .optional({ nullable: true })
    .isArray().withMessage('monsterIds must be an array.')
    .custom(arr => !arr || arr.every(id => isUUID(id))).withMessage('Invalid monster ID in list.'),
], async (req, res) => {
  if (!isUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid share ID.' })
  }
  if (validationErrors(req, res)) return

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // SELECT FOR UPDATE locks the share row before reading it. Without this lock,
    // two simultaneous accept requests can both see status='pending', both insert
    // every monster, and both flip status='accepted' — doubling the recipient's
    // bestiary. The second request now waits at this line until the first commits,
    // at which point status is 'accepted' and the WHERE clause returns 0 rows.
    const shareResult = await client.query(
      `SELECT * FROM bestiary_shares
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       FOR UPDATE`,
      [req.params.id, req.user.sub]
    )

    if (!shareResult.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Share not found or already processed.' })
    }

    const share    = shareResult.rows[0]
    let   monsters = share.monsters_data ?? []

    // If specific IDs were requested, filter to just those
    const { monsterIds } = req.body
    if (monsterIds && monsterIds.length > 0) {
      const idSet = new Set(monsterIds)
      monsters    = monsters.filter(m => idSet.has(m.id))
      if (monsters.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'No valid monsters selected.' })
      }
    }

    // Fetch the sender's username for attribution (same client, inside transaction)
    const senderRow = await client.query(
      'SELECT username FROM users WHERE id = $1 LIMIT 1',
      [share.from_user_id]
    )
    const senderUsername = senderRow.rows[0]?.username ?? null

    // Insert each monster, validating stat_data before serialisation.
    // An array or primitive would silently write bad JSON and corrupt the stat block.
    const inserted = []
    for (const m of monsters) {
      const statData = m.stat_data
      const safeStatData = (statData && typeof statData === 'object' && !Array.isArray(statData))
        ? JSON.stringify(statData)
        : '{}'

      const result = await client.query(
        `INSERT INTO monsters (user_id, game_system, name, challenge, tags, stat_data, shared_from_username)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, challenge, tags, stat_data, game_system, shared_from_username, created_at`,
        [
          req.user.sub,
          share.game_system,
          String(m.name ?? '').slice(0, 100),
          m.challenge ? String(m.challenge).slice(0, 50) : null,
          m.tags      ? String(m.tags).slice(0, 200)     : null,
          safeStatData,
          senderUsername,
        ]
      )
      inserted.push(result.rows[0])
    }

    // Flip status — the FOR UPDATE lock guarantees only one concurrent request
    // reaches this point with status='pending'.
    await client.query(
      `UPDATE bestiary_shares SET status = 'accepted' WHERE id = $1`,
      [req.params.id]
    )

    await client.query('COMMIT')
    res.json({ accepted: inserted })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[shares/accept]', err)
    res.status(500).json({ error: 'Failed to accept share.' })
  } finally {
    client.release()
  }
})

// ─── PATCH /:id/dismiss ───────────────────────────────────────────────────────
// Dismiss (decline) a pending share without adding anything.
router.patch('/:id/dismiss', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid share ID.' })
  }

  try {
    const result = await db.query(
      `UPDATE bestiary_shares
       SET status = 'dismissed'
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING id`,
      [req.params.id, req.user.sub]
    )

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Share not found or already processed.' })
    }

    res.json({ message: 'Share dismissed.' })
  } catch (err) {
    console.error('[shares/dismiss]', err)
    res.status(500).json({ error: 'Failed to dismiss share.' })
  }
})

module.exports = router
