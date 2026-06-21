/**
 * User routes — public-facing user data only.
 *
 * GET /api/users/search?q=   — username prefix search (for Raven Post compose)
 */

const express = require('express')
const { query, validationResult } = require('express-validator')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ─── GET /api/users/search ───────────────────────────────────────────────────
// Returns up to 8 users whose username starts with `q` (case-insensitive).
// Only exposes id + username — no email, no hashes, no sensitive fields.
// Excludes the requesting user from results.
router.get('/search', requireAuth, [
  query('q')
    .trim()
    .notEmpty().withMessage('Search query is required.')
    .isLength({ min: 1, max: 30 }).withMessage('Query too long.')
    .matches(/^[a-zA-Z0-9_\-]+$/).withMessage('Invalid characters in search query.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }

  try {
    const q = req.query.q.trim()

    // Exclude is_admin accounts from normal search results — the admin username
    // is never exposed. Admins are surfaced only as the "Site Administrator" alias.
    const result = await db.query(
      `SELECT id, username
       FROM users
       WHERE username ILIKE $1
         AND id != $2
         AND is_admin = false
       ORDER BY username
       LIMIT 8`,
      [`${q}%`, req.user.sub]
    )

    let users = result.rows

    // Synthetic alias: if the query prefix-matches "administrator" or
    // "site administrator", surface the primary admin as "Site Administrator"
    // so users can still send ravens to the admin team without knowing the
    // real login username.
    const ql = q.toLowerCase()
    if ('administrator'.startsWith(ql) || 'site administrator'.startsWith(ql)) {
      const adminRow = await db.query(
        `SELECT id FROM users WHERE is_admin = true LIMIT 1`
      )
      if (adminRow.rows[0]) {
        users = [
          { id: adminRow.rows[0].id, username: 'Site Administrator' },
          ...users,
        ].slice(0, 8)
      }
    }

    res.json({ users })
  } catch (err) {
    console.error('[users/search]', err)
    res.status(500).json({ error: 'Search failed.' })
  }
})

// ─── GET /api/users/contacts ─────────────────────────────────────────────────
// Returns users you've exchanged ravens with — used as the "friends" dropdown
// in the bestiary share modal. Never exposes sensitive user data.
router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT
         u.id,
         CASE WHEN u.is_admin THEN 'Site Administrator' ELSE u.username END AS username
       FROM users u
       WHERE u.id IN (
         SELECT sender_id    FROM raven_messages WHERE recipient_id = $1
         UNION
         SELECT recipient_id FROM raven_messages WHERE sender_id    = $1
       )
         AND u.id != $1
       ORDER BY username
       LIMIT 50`,
      [req.user.sub]
    )
    res.json({ contacts: result.rows })
  } catch (err) {
    console.error('[users/contacts]', err)
    res.status(500).json({ error: 'Failed to fetch contacts.' })
  }
})

module.exports = router
