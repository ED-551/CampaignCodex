require('dotenv').config()

// ─── Startup Environment Validation ──────────────────────────────────────────
// Catch misconfigured deployments before they become security incidents.
;(function validateEnv() {
  const errors   = []
  const warnings = []

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET is missing or too short (minimum 32 characters).')
    errors.push('  Generate one: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"')
  }

  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'devpassword') {
    if (process.env.NODE_ENV === 'production') {
      errors.push('DB_PASSWORD must be set to a strong value in production.')
    } else {
      warnings.push('DB_PASSWORD is using the development default — do not use in production.')
    }
  }

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    warnings.push('ADMIN_USERNAME or ADMIN_PASSWORD not set — admin seeding will fail.')
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.RESEND_API_KEY) {
      warnings.push('RESEND_API_KEY not set — all emails will stub to console in production.')
    }
    if (!process.env.CLIENT_URL || process.env.CLIENT_URL.includes('localhost')) {
      errors.push('CLIENT_URL must be set to a non-localhost URL in production — CORS will be misconfigured otherwise.')
    }
  } else {
    if (!process.env.CLIENT_URL) {
      warnings.push('CLIENT_URL not set — CORS defaulting to http://localhost:5173.')
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  CampaignCodex startup warnings:')
    warnings.forEach(w => console.warn(`   • ${w}`))
  }

  if (errors.length > 0) {
    console.error('\n🚨 CampaignCodex FATAL startup errors — server will not start:')
    errors.forEach(e => console.error(`   • ${e}`))
    console.error('')
    process.exit(1)
  }
})()

const http       = require('http')
const express    = require('express')
const helmet     = require('helmet')
const cors       = require('cors')
const { apiLimiter }       = require('./middleware/rateLimiter')
const { createSocketServer } = require('./socket')

const authRoutes       = require('./routes/auth')
const campaignRoutes   = require('./routes/campaigns')
const characterRoutes  = require('./routes/characters')
const adminRoutes      = require('./routes/admin')
const combatRoutes     = require('./routes/combat')
const ravensRoutes     = require('./routes/ravens')
const usersRoutes      = require('./routes/users')
const bestiaryRoutes       = require('./routes/bestiary')
const bestiarySharesRoutes = require('./routes/bestiaryShares')
const encounterRoutes      = require('./routes/encounters')

const app        = express()
const httpServer = http.createServer(app)
const PORT       = process.env.PORT || 3001

// ─── Security Headers ─────────────────────────────────────────────────────────
// contentSecurityPolicy blocks inline script injection (XSS mitigation).
// unsafe-inline for styles is required by Tailwind CSS.
// wss: / ws: for Socket.io WebSocket connections.
// https: for imgSrc to allow external portrait URLs.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'", "wss:", "ws:"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      mediaSrc:    ["'self'"],
      frameSrc:    ["'none'"],
    },
  },
}))

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))

// ─── Rate Limiting (global) ───────────────────────────────────────────────────
app.use('/api', apiLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes)
app.use('/api/campaigns',  campaignRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/admin',      adminRoutes)
app.use('/api/combat',     combatRoutes)
app.use('/api/ravens',     ravensRoutes)
app.use('/api/users',            usersRoutes)
// IMPORTANT: /api/bestiary/shares must be mounted BEFORE /api/bestiary
// so the shares sub-router intercepts those paths before the bestiary router's /:id handler.
app.use('/api/bestiary/shares',  bestiarySharesRoutes)
app.use('/api/bestiary',         bestiaryRoutes)
app.use('/api/encounters',       encounterRoutes)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` })
})

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[unhandled]', err)
  res.status(500).json({ error: 'An unexpected error occurred.' })
})

// ─── Socket.io (attached to the same HTTP server) ────────────────────────────
// Must be attached AFTER Express middleware but BEFORE server.listen()
createSocketServer(httpServer)

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🐉 CampaignCodex API running on port ${PORT}`)
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   DB host     : ${process.env.DB_HOST || 'localhost'}`)
  console.log(`   Client URL  : ${process.env.CLIENT_URL || 'http://localhost:5173'}`)
  console.log(`   WebSocket   : enabled (Socket.io)\n`)
})

module.exports = app
