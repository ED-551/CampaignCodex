const express  = require('express')
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')
const { v4: uuidv4 } = require('uuid')
const db       = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const UPLOAD_DIR    = process.env.UPLOAD_DIR || '/app/uploads'
const MAX_FILE_BYTES = 10 * 1024 * 1024   // 10 MB per file
const QUOTA_BYTES    = 1024 * 1024 * 1024 // 1 GB per user
const ALLOWED_TYPES  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// ─── Multer storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_DIR, req.user.sub)
    fs.mkdirSync(userDir, { recursive: true })
    cb(null, userDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin'
    cb(null, `${uuidv4()}${ext}`)
  },
})

const uploader = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true)
    cb(Object.assign(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'), { status: 400 }))
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadsEnabled() {
  const { rows } = await db.query(`SELECT value FROM app_settings WHERE key = 'uploads_enabled'`)
  return rows[0]?.value === 'true'
}

async function getUserUsed(userId) {
  const { rows: [r] } = await db.query(
    `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used FROM user_uploads WHERE user_id = $1`,
    [userId]
  )
  return Number(r.used)
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
// Accepts: multipart/form-data with `file` field and optional `purpose` field.
// purpose: 'profile' | 'portrait' | 'vtt_map' | 'vtt_token' | 'general'
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!await uploadsEnabled()) {
      return res.status(403).json({ error: 'Uploads are currently disabled by the administrator.' })
    }
    const used = await getUserUsed(req.user.sub)
    if (used >= QUOTA_BYTES) {
      return res.status(413).json({ error: 'Upload quota exceeded (1 GB limit per user).' })
    }
  } catch (err) { return next(err) }

  uploader.single('file')(req, res, async (err) => {
    if (err) {
      const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`
        : (err.message || 'Upload failed.')
      return res.status(status).json({ error: message })
    }
    if (!req.file) return res.status(400).json({ error: 'No file provided.' })

    const purpose  = (req.body.purpose || 'general').slice(0, 50)
    const urlPath  = `/uploads/${req.user.sub}/${req.file.filename}`

    try {
      const { rows: [row] } = await db.query(
        `INSERT INTO user_uploads
           (user_id, filename, original_name, mime_type, size_bytes, purpose, url_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, url_path, size_bytes`,
        [req.user.sub, req.file.filename, req.file.originalname,
         req.file.mimetype, req.file.size, purpose, urlPath]
      )
      return res.status(201).json({ id: row.id, url: row.url_path, size: row.size_bytes })
    } catch (dbErr) {
      fs.unlink(req.file.path, () => {})
      return next(dbErr)
    }
  })
})

// ─── GET /api/upload/quota ────────────────────────────────────────────────────
router.get('/quota', requireAuth, async (req, res, next) => {
  try {
    const used      = await getUserUsed(req.user.sub)
    const remaining = Math.max(0, QUOTA_BYTES - used)
    res.json({
      used,
      total:     QUOTA_BYTES,
      remaining,
      pct:       Math.round((used / QUOTA_BYTES) * 100),
    })
  } catch (err) { next(err) }
})

// ─── DELETE /api/upload/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `DELETE FROM user_uploads WHERE id = $1 AND user_id = $2
       RETURNING filename, user_id`,
      [req.params.id, req.user.sub]
    )
    if (!row) return res.status(404).json({ error: 'Upload not found.' })
    fs.unlink(path.join(UPLOAD_DIR, row.user_id, row.filename), () => {})
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
