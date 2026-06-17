/**
 * Bestiary routes — /api/bestiary
 *
 * User-created monster stat blocks, scoped per game system.
 * stat_data is kept as flexible JSONB so each system's full block can be
 * added later without a schema change. The challenge + tags columns are
 * denormalized for fast card-listing without parsing JSONB.
 *
 * All routes require authentication. Ownership enforced on PATCH/DELETE.
 */

const express = require('express')
const { body, query, validationResult } = require('express-validator')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const GAME_SYSTEMS = ['shadowdark', 'morkborg', 'nimble']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

// ─── GET /api/bestiary ────────────────────────────────────────────────────────
// List all monsters owned by the authenticated user.
// Optional: ?system=shadowdark to filter by game system.
router.get('/', requireAuth, [
  query('system').optional().isIn(GAME_SYSTEMS).withMessage('Invalid game system.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { system } = req.query
  try {
    const result = await db.query(
      `SELECT id, game_system, name, challenge, tags, created_at, updated_at
       FROM monsters
       WHERE user_id = $1
         ${system ? 'AND game_system = $2' : ''}
       ORDER BY game_system, created_at DESC`,
      system ? [req.user.sub, system] : [req.user.sub]
    )
    res.json({ monsters: result.rows })
  } catch (err) {
    console.error('[bestiary/list]', err)
    res.status(500).json({ error: 'Failed to fetch bestiary.' })
  }
})

// ─── POST /api/bestiary ───────────────────────────────────────────────────────
// Create a new monster. stat_data defaults to {} and can be filled in later.
router.post('/', requireAuth, [
  body('name')
    .trim().notEmpty().withMessage('Monster name is required.')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer.'),
  body('gameSystem')
    .isIn(GAME_SYSTEMS).withMessage('Invalid game system.'),
  body('challenge')
    .optional({ nullable: true }).trim()
    .isLength({ max: 50 }).withMessage('Challenge must be 50 characters or fewer.'),
  body('tags')
    .optional({ nullable: true }).trim()
    .isLength({ max: 200 }).withMessage('Tags must be 200 characters or fewer.'),
  body('statData')
    .optional({ nullable: true }).isObject().withMessage('statData must be an object.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { name, gameSystem, challenge, tags, statData } = req.body

  try {
    const result = await db.query(
      `INSERT INTO monsters (user_id, game_system, name, challenge, tags, stat_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, game_system, name, challenge, tags, stat_data, created_at, updated_at`,
      [req.user.sub, gameSystem, name, challenge || null, tags || null,
       statData ? JSON.stringify(statData) : '{}']
    )
    res.status(201).json({ monster: result.rows[0] })
  } catch (err) {
    console.error('[bestiary/create]', err)
    res.status(500).json({ error: 'Failed to create monster.' })
  }
})

// ─── GET /api/bestiary/:id ────────────────────────────────────────────────────
// Fetch a single monster — owner only.
router.get('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid monster ID.' })

  try {
    const result = await db.query(
      `SELECT id, user_id, game_system, name, challenge, tags, stat_data, created_at, updated_at
       FROM monsters WHERE id = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Monster not found.' })
    if (result.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied.' })
    }
    res.json({ monster: result.rows[0] })
  } catch (err) {
    console.error('[bestiary/get]', err)
    res.status(500).json({ error: 'Failed to fetch monster.' })
  }
})

// ─── PATCH /api/bestiary/:id ──────────────────────────────────────────────────
// Update any combination of fields. Owner or admin only.
router.patch('/:id', requireAuth, [
  body('name')
    .optional().trim().notEmpty().isLength({ max: 100 }),
  body('challenge')
    .optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('tags')
    .optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('statData')
    .optional({ nullable: true }).isObject(),
], async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid monster ID.' })
  if (validationErrors(req, res)) return

  try {
    const existing = await db.query(
      'SELECT user_id FROM monsters WHERE id = $1', [req.params.id]
    )
    if (!existing.rows[0]) return res.status(404).json({ error: 'Monster not found.' })
    if (existing.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const { name, challenge, tags, statData } = req.body

    const result = await db.query(
      `UPDATE monsters SET
         name      = COALESCE($1, name),
         challenge = COALESCE($2, challenge),
         tags      = COALESCE($3, tags),
         stat_data = COALESCE($4, stat_data)
       WHERE id = $5
       RETURNING id, game_system, name, challenge, tags, stat_data, created_at, updated_at`,
      [name || null,
       challenge !== undefined ? (challenge || null) : null,
       tags      !== undefined ? (tags      || null) : null,
       statData  ? JSON.stringify(statData) : null,
       req.params.id]
    )
    res.json({ monster: result.rows[0] })
  } catch (err) {
    console.error('[bestiary/update]', err)
    res.status(500).json({ error: 'Failed to update monster.' })
  }
})

// ─── DELETE /api/bestiary/:id ─────────────────────────────────────────────────
// Permanently delete a monster. Owner or admin only.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid monster ID.' })

  try {
    const result = await db.query(
      'SELECT user_id FROM monsters WHERE id = $1', [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Monster not found.' })
    if (result.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own monsters.' })
    }
    await db.query('DELETE FROM monsters WHERE id = $1', [req.params.id])
    res.json({ message: 'Monster deleted.' })
  } catch (err) {
    console.error('[bestiary/delete]', err)
    res.status(500).json({ error: 'Failed to delete monster.' })
  }
})

module.exports = router
