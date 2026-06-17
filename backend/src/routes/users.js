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
    const result = await db.query(
      `SELECT id, username
       FROM users
       WHERE username ILIKE $1
         AND id != $2
       ORDER BY username
       LIMIT 8`,
      [`${req.query.q}%`, req.user.sub]
    )
    res.json({ users: result.rows })
  } catch (err) {
    console.error('[users/search]', err)
    res.status(500).json({ error: 'Search failed.' })
  }
})

module.exports = router
