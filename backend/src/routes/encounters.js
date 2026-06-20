/**
 * Encounter routes — /api/encounters
 *
 * Saved reusable combat encounter templates.
 * Scoped to game_system (NOT to a campaign) so a GM can reuse
 * encounters across all campaigns of the same system.
 *
 * monsters JSONB entry shape:
 *   { monsterId, name, count, hp, maxHp, ac, dexMod, notes }
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

// ─── GET /api/encounters ──────────────────────────────────────────────────────
// List the authenticated user's encounters.
// Optional: ?system=shadowdark to filter by game system.
router.get('/', requireAuth, [
  query('system').optional().isIn(GAME_SYSTEMS).withMessage('Invalid game system.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { system } = req.query
  try {
    const result = await db.query(
      `SELECT id, game_system, name, description, tags, times_used,
              jsonb_array_length(monsters) AS monster_count,
              created_at, updated_at
       FROM encounters
       WHERE user_id = $1
         ${system ? 'AND game_system = $2' : ''}
       ORDER BY created_at DESC`,
      system ? [req.user.sub, system] : [req.user.sub]
    )
    res.json({ encounters: result.rows })
  } catch (err) {
    console.error('[encounters/list]', err)
    res.status(500).json({ error: 'Failed to fetch encounters.' })
  }
})

// ─── POST /api/encounters ─────────────────────────────────────────────────────
// Create a new encounter template.
router.post('/', requireAuth, [
  body('name')
    .trim().notEmpty().withMessage('Encounter name is required.')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer.'),
  body('gameSystem')
    .isIn(GAME_SYSTEMS).withMessage('Invalid game system.'),
  body('description')
    .optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('tags')
    .optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('monsters')
    .optional({ nullable: true }).isArray().withMessage('monsters must be an array.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { name, gameSystem, description, tags, monsters = [] } = req.body

  const VALID_HIT_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12'])

  // Sanitise each monster entry — only allow known keys through
  const clean = monsters.map(m => ({
    monsterId:  m.monsterId  || null,
    name:       String(m.name  ?? '').slice(0, 100),
    count:      Math.max(1, Math.min(99, parseInt(m.count)  || 1)),
    hp:         Math.max(1, Math.min(9999, parseInt(m.hp)   || 1)),
    maxHp:      Math.max(1, Math.min(9999, parseInt(m.maxHp) || parseInt(m.hp) || 1)),
    ac:         Math.max(0, Math.min(99, parseInt(m.ac)     || 10)),
    dexMod:     Math.max(-10, Math.min(10, parseInt(m.dexMod) || 0)),
    hitDie:     VALID_HIT_DICE.has(m.hitDie) ? m.hitDie : '',
    talents:    Array.isArray(m.talents)
      ? m.talents.slice(0, 10).map(t => ({
          name:        String(t?.name        ?? '').slice(0, 100),
          description: String(t?.description ?? '').slice(0, 500),
        }))
      : [],
    notes:      String(m.notes ?? '').slice(0, 500),
  }))

  try {
    const result = await db.query(
      `INSERT INTO encounters (user_id, game_system, name, description, tags, monsters)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.sub, gameSystem, name, description || null, tags || null,
       JSON.stringify(clean)]
    )
    res.status(201).json({ encounter: result.rows[0] })
  } catch (err) {
    console.error('[encounters/create]', err)
    res.status(500).json({ error: 'Failed to create encounter.' })
  }
})

// ─── GET /api/encounters/:id ──────────────────────────────────────────────────
// Fetch a single encounter — owner only.
router.get('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid encounter ID.' })

  try {
    const result = await db.query(
      'SELECT * FROM encounters WHERE id = $1', [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Encounter not found.' })
    if (result.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied.' })
    }
    res.json({ encounter: result.rows[0] })
  } catch (err) {
    console.error('[encounters/get]', err)
    res.status(500).json({ error: 'Failed to fetch encounter.' })
  }
})

// ─── PUT /api/encounters/:id ──────────────────────────────────────────────────
// Full replace (update) an encounter. Owner only.
router.put('/:id', requireAuth, [
  body('name')
    .trim().notEmpty().withMessage('Encounter name is required.')
    .isLength({ max: 100 }),
  body('description')
    .optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('tags')
    .optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('monsters')
    .optional({ nullable: true }).isArray(),
], async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid encounter ID.' })
  if (validationErrors(req, res)) return

  try {
    const existing = await db.query(
      'SELECT user_id FROM encounters WHERE id = $1', [req.params.id]
    )
    if (!existing.rows[0]) return res.status(404).json({ error: 'Encounter not found.' })
    if (existing.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const { name, description, tags, monsters = [] } = req.body

    const VALID_HIT_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12'])
    const clean = monsters.map(m => ({
      monsterId:  m.monsterId  || null,
      name:       String(m.name  ?? '').slice(0, 100),
      count:      Math.max(1, Math.min(99, parseInt(m.count)  || 1)),
      hp:         Math.max(1, Math.min(9999, parseInt(m.hp)   || 1)),
      maxHp:      Math.max(1, Math.min(9999, parseInt(m.maxHp) || parseInt(m.hp) || 1)),
      ac:         Math.max(0, Math.min(99, parseInt(m.ac)     || 10)),
      dexMod:     Math.max(-10, Math.min(10, parseInt(m.dexMod) || 0)),
      hitDie:     VALID_HIT_DICE.has(m.hitDie) ? m.hitDie : '',
      talents:    Array.isArray(m.talents)
        ? m.talents.slice(0, 10).map(t => ({
            name:        String(t?.name        ?? '').slice(0, 100),
            description: String(t?.description ?? '').slice(0, 500),
          }))
        : [],
      notes:      String(m.notes ?? '').slice(0, 500),
    }))

    const result = await db.query(
      `UPDATE encounters
       SET name = $1, description = $2, tags = $3, monsters = $4
       WHERE id = $5
       RETURNING *`,
      [name, description || null, tags || null, JSON.stringify(clean), req.params.id]
    )
    res.json({ encounter: result.rows[0] })
  } catch (err) {
    console.error('[encounters/update]', err)
    res.status(500).json({ error: 'Failed to update encounter.' })
  }
})

// ─── DELETE /api/encounters/:id ───────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid encounter ID.' })

  try {
    const result = await db.query(
      'SELECT user_id FROM encounters WHERE id = $1', [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Encounter not found.' })
    if (result.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own encounters.' })
    }
    await db.query('DELETE FROM encounters WHERE id = $1', [req.params.id])
    res.json({ message: 'Encounter deleted.' })
  } catch (err) {
    console.error('[encounters/delete]', err)
    res.status(500).json({ error: 'Failed to delete encounter.' })
  }
})

module.exports = router
