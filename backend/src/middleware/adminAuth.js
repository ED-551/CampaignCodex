const db = require('../db')
const { requireAuth } = require('./auth')

/**
 * Protect admin-only routes.
 *
 * Deliberately chains TWO checks rather than relying on the `isAdmin` claim
 * embedded in the JWT:
 *
 *   1. requireAuth — verifies JWT signature + token_version (see auth.js).
 *      This is passed a callback instead of being `await`-ed because
 *      requireAuth calls next() internally; wrapping it this way lets us
 *      inject our own logic into that continuation without touching auth.js.
 *
 *   2. Fresh DB read for `is_admin` — the JWT's isAdmin claim is baked in at
 *      login time and can't be revoked mid-session. If an admin is demoted
 *      (is_admin set to false in the DB), their existing JWT would still
 *      carry isAdmin:true for up to 24 hours. Re-querying here means demotion
 *      takes effect immediately on every admin endpoint, with no need to force
 *      a logout or wait for token expiry.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requireAdmin(req, res, next) {
  // Pass an async callback as the "next" for requireAuth so we can run the
  // is_admin DB check only after the JWT has been verified and req.user set.
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
