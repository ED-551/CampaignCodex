const { verifyToken } = require('../utils/jwt')
const db              = require('../db')

/**
 * Protect a route — requires a valid Bearer JWT with a current token version.
 *
 * Two-layer verification:
 *   1. JWT signature + expiry (stateless, no DB)
 *   2. token_version match (single indexed PK lookup — detects revoked tokens
 *      issued before a password change or account reset)
 *
 * Attaches req.user = { sub, username, isAdmin, tier, tv }
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  const token = header.slice(7)
  try {
    const payload = verifyToken(token)

    // Check that the token's version matches the current version in the DB.
    // If the user changed their password, token_version is incremented in the DB
    // and any previously issued JWT (with the old tv) is immediately invalid.
    // Existing tokens without tv default to 1, which matches the column default.
    const result = await db.query(
      'SELECT token_version FROM users WHERE id = $1 LIMIT 1',
      [payload.sub]
    )
    const row = result.rows[0]
    if (!row || row.token_version !== (payload.tv ?? 1)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' })
    }

    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

module.exports = { requireAuth }
