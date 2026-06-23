const db = require('../db')
const { requireAuth } = require('./auth')
// Used to compute req.liveIsPrimaryAdmin — the most-privileged gate in the
// admin routes. Sourced from config (env var) rather than from the JWT so it
// cannot be spoofed by a stale or crafted token claim.
const { PRIMARY_ADMIN_USERNAME } = require('../config')

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
 *   2. Fresh DB read for `is_admin` + `username` — the JWT's isAdmin claim is
 *      baked in at login time and can't be revoked mid-session. If an admin is
 *      demoted (is_admin set to false in the DB), their existing JWT would still
 *      carry isAdmin:true for up to 24 hours. Re-querying here means demotion
 *      takes effect immediately on every admin endpoint, with no need to force
 *      a logout or wait for token expiry.
 *
 *      `username` is also fetched so we can derive `req.liveIsPrimaryAdmin`
 *      without relying on `req.user.username` — a JWT claim that could be stale
 *      if the username were ever changed between token issuance and this request.
 *      Routes that are restricted to the primary admin (assign-moderator,
 *      assign-admin) must use `req.liveIsPrimaryAdmin` rather than comparing
 *      against the JWT username directly.
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
        'SELECT is_admin, username FROM users WHERE id = $1 LIMIT 1',
        [req.user.sub]
      )
      const row = result.rows[0]
      if (!row?.is_admin) {
        return res.status(403).json({ error: 'Admin access required.' })
      }
      // Attach live primary-admin flag so downstream routes can gate on it
      // without repeating the username comparison or trusting the JWT claim.
      req.liveIsPrimaryAdmin = row.username === PRIMARY_ADMIN_USERNAME
      next()
    } catch (err) {
      console.error('[requireAdmin]', err)
      res.status(500).json({ error: 'An unexpected error occurred.' })
    }
  })
}

/**
 * Protect routes that require admin OR moderator access.
 *
 * Allows through if the user has `is_admin = true` OR `is_moderator = true`
 * in the DB. Like requireAdmin, this performs a fresh DB read on every request
 * so that role changes take effect immediately without waiting for token expiry.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requireModerator(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const result = await db.query(
        'SELECT is_admin, is_moderator FROM users WHERE id = $1 LIMIT 1',
        [req.user.sub]
      )
      const row = result.rows[0]
      if (!row?.is_admin && !row?.is_moderator) {
        return res.status(403).json({ error: 'Moderator access required.' })
      }
      // Attach live DB role flags so downstream route handlers can use fresh
      // values rather than trusting the potentially-stale JWT claims. The JWT
      // isAdmin/isModerator claims are baked in at login and cannot be relied
      // upon after a role change (e.g., demotion between token issuance and
      // this request). Using req.liveIsAdmin in the ban route prevents a
      // demoted admin from retaining elevated ban privileges mid-session.
      req.liveIsAdmin     = row.is_admin
      req.liveIsModerator = row.is_moderator
      next()
    } catch (err) {
      console.error('[requireModerator]', err)
      res.status(500).json({ error: 'An unexpected error occurred.' })
    }
  })
}

module.exports = { requireAdmin, requireModerator }
