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

module.exports = { authLimiter, apiLimiter }
