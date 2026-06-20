const rateLimit = require('express-rate-limit')

/**
 * Strict limiter for auth endpoints — 10 attempts per 15 minutes per IP.
 * Prevents brute-force on login and password recovery.
 */
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    error: 'Too many attempts from this IP. Please try again in 15 minutes.',
  },
})

/**
 * General API limiter — 200 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error: 'Too many requests. Slow down.',
  },
})

/**
 * Ravens send limiter — 20 outgoing messages per hour per IP.
 * Prevents automated spam via the internal mail system.
 */
const ravensLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error: 'You can only send 20 ravens per hour. Even the ravens need rest.',
  },
})

/**
 * Bestiary share limiter — 15 shares per hour per IP.
 * Prevents flooding another user's share inbox.
 */
const shareLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             15,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error: 'You can only send 15 bestiary shares per hour. Even ravens tire.',
  },
})

module.exports = { authLimiter, apiLimiter, ravensLimiter, shareLimiter }
