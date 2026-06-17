require('dotenv').config()
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
const bestiaryRoutes   = require('./routes/bestiary')

const app        = express()
const httpServer = http.createServer(app)
const PORT       = process.env.PORT || 3001

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet())

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
app.use('/api/users',      usersRoutes)
app.use('/api/bestiary',   bestiaryRoutes)

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
