/**
 * DMs REST routes — conversation list for pre-populating the DM widget.
 * All socket-based DM messaging (send, history) remains in socket.js.
 *
 * GET /api/dms/conversations — all users you've exchanged DMs with, most recent first
 */

const express       = require('express')
const db            = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ─── GET /api/dms/conversations ──────────────────────────────────────────────
// Returns up to 20 distinct conversation partners, ordered by most-recent message.
// Used by DMContext on login to pre-populate the DMs tab with existing threads.
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         u.id   AS user_id,
         CASE WHEN u.is_admin THEN 'Site Administrator' ELSE u.username END AS username,
         MAX(dm.created_at) AS last_message_at
       FROM dm_messages dm
       JOIN users u ON u.id = CASE
         WHEN dm.sender_id    = $1 THEN dm.recipient_id
         ELSE dm.sender_id
       END
       WHERE $1 IN (dm.sender_id, dm.recipient_id)
       GROUP BY u.id, u.username, u.is_admin
       ORDER BY last_message_at DESC
       LIMIT 20`,
      [req.user.sub]
    )
    res.json({ conversations: result.rows })
  } catch (err) {
    console.error('[dms/conversations]', err)
    res.status(500).json({ error: 'Failed to load conversations.' })
  }
})

module.exports = router
