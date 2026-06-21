const db = require('../db')
const { requireAuth } = require('./auth')

/**
 * Protect admin-only routes.
 * Chains requireAuth (verifies JWT + token_version), then re-queries the DB
 * for is_admin — this ensures a revoked admin cannot use a stale JWT to access
 * admin endpoints, even within the 24-hour JWT lifetime.
 */
async function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const result = await db.query(
        'SELECT is_admin FROM users WHERE id = $1 LIMIT 1',
        [req.user.sub]
      )
      if (!result.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Admin access required.' })
      }
      next()
    } catch (err) {
      console.error('[requireAdmin]', err)
      res.status(500).json({ error: 'An unexpected error occurred.' })
    }
  })
}

module.exports = { requireAdmin }
