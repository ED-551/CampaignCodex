const { verifyToken } = require('../utils/jwt')
const db              = require('../db')

/**
 * Protect a route — requires a valid Bearer JWT with a current token version.
 *
 * Two-layer verification:
 *   1. JWT signature + expiry (stateless, no DB hit) — rejects tampered or
 *      expired tokens before any database work is done.
 *   2. token_version match against the DB — catches tokens that are
 *      cryptographically valid but were issued before a password change or
 *      account reset. Without this check, a stolen JWT would remain usable
 *      for its full lifetime (up to 24 h) even after the user changes their
 *      password. The DB lookup is a single indexed primary-key read, so the
 *      overhead is minimal compared to the security benefit.
 *
 * Flow:
 *   Authorization: Bearer <jwt>
 *     → verifyToken() checks signature & exp claim
 *     → DB query checks users.token_version === jwt.tv
 *     → req.user is populated and next() is called
 *
 * Attaches req.user = { sub, username, isAdmin, isModerator, tier, tv }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  // Strip the "Bearer " prefix (7 characters) to get the raw JWT string.
  const token = header.slice(7)
  try {
    const payload = verifyToken(token)

    // Why query the DB here instead of trusting the JWT alone?
    //
    // JWTs are self-contained and stateless — once issued they stay valid until
    // expiry. If a user changes their password, we increment token_version in
    // the DB so that every previously issued token (which carries the old tv
    // value) immediately fails this check. This is the only way to revoke a
    // JWT without maintaining a server-side blocklist.
    //
    // The `?? 1` fallback handles tokens minted before tv was introduced:
    // those tokens have no `tv` claim, so we treat them as version 1, which
    // matches the column's DEFAULT 1 for existing accounts.
    //
    // We also fetch is_banned and banned_until so that banned users are
    // blocked on every REST request — not just at login. Without this check,
    // a banned user with an active JWT could continue calling the API for up
    // to 24 hours after the ban was issued (the token lifetime).
    const result = await db.query(
      'SELECT token_version, is_banned, banned_until FROM users WHERE id = $1 LIMIT 1',
      [payload.sub]
    )
    const row = result.rows[0]
    if (!row || row.token_version !== (payload.tv ?? 1)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' })
    }

    // Block actively banned users. Timed bans that have already expired are
    // allowed through — auto-lift happens at the next successful login rather
    // than on every request, to avoid a DB write on every API call.
    if (row.is_banned) {
      const bannedUntil = row.banned_until ? new Date(row.banned_until) : null
      if (!bannedUntil || bannedUntil > new Date()) {
        return res.status(403).json({ error: 'Your account has been suspended.' })
      }
      // Expired timed ban — fall through and allow the request.
    }

    req.user = payload
    next()
  } catch {
    // verifyToken() throws on bad signature, expired token, or malformed JWT.
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

module.exports = { requireAuth }
