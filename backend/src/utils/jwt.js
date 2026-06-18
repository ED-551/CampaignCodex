const jwt = require('jsonwebtoken')

const SECRET      = process.env.JWT_SECRET
const EXPIRES_IN  = process.env.JWT_EXPIRES_IN || '24h'

if (!SECRET) {
  throw new Error('JWT_SECRET is not set in environment variables.')
}

/**
 * Sign a JWT for a given user row.
 * `tv` (token version) is embedded so requireAuth can detect stale tokens
 * that pre-date a password change or account reset without touching the DB
 * on every verify — the DB check happens in requireAuth after signature verify.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub:      user.id,
      username: user.username,
      isAdmin:  user.is_admin,
      tier:     user.supporter_tier,
      tv:       user.token_version ?? 1,
    },
    SECRET,
    { expiresIn: EXPIRES_IN }
  )
}

/**
 * Verify and decode a JWT. Returns the payload or throws.
 */
function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

module.exports = { signToken, verifyToken }
