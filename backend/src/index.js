require('dotenv').config()
const express    = require('express')
const helmet     = require('helmet')
const cors       = require('cors')
const { apiLimiter } = require('./middleware/rateLimiter')

const authRoutes       = require('./routes/auth')
const campaignRoutes   = require('./routes/campaigns')
const characterRoutes  = require('./routes/characters')
const adminRoutes      = require('./routes/admin')
const combatRoutes     = require('./routes/combat')

const app  = express()
const PORT = process.env.PORT || 3001

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

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐉 CampaignCodex API running on port ${PORT}`)
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   DB host     : ${process.env.DB_HOST || 'localhost'}`)
  console.log(`   Client URL  : ${process.env.CLIENT_URL || 'http://localhost:5173'}\n`)
})

module.exports = app
