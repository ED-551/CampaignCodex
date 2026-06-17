const { requireAuth } = require('./auth')

/**
 * Protect admin-only routes.
 * Must be used AFTER requireAuth, or chain with it.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' })
    }
    next()
  })
}

module.exports = { requireAdmin }
