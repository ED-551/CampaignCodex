const express = require('express')
const { body, validationResult } = require('express-validator')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

async function assertGM(campaignId, userId, res) {
  const r = await db.query('SELECT gm_user_id FROM campaigns WHERE id = $1', [campaignId])
  if (!r.rows[0]) { res.status(404).json({ error: 'Campaign not found.' }); return false }
  if (r.rows[0].gm_user_id !== userId) {
    res.status(403).json({ error: 'Only the GM can manage combat.' })
    return false
  }
  return true
}

// ─── POST /api/combat/start ───────────────────────────────────────────────────
// GM starts a new combat session for a campaign (ends any active one first)
router.post('/start', requireAuth, [
  body('campaignId').isUUID().withMessage('Valid campaign ID required.'),
], async (req, res) => {
  if (validationErrors(req, res)) return
  const { campaignId } = req.body

  try {
    if (!await assertGM(campaignId, req.user.sub, res)) return

    // End existing active session
    await db.query(
      'UPDATE combat_sessions SET is_active = false WHERE campaign_id = $1 AND is_active = true',
      [campaignId]
    )

    // Pull campaign members as initial combatant stubs
    const members = await db.query(
      `SELECT u.username, ch.character_name, ch.sheet_data, ch.game_system
       FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN characters ch ON ch.id = cm.character_id
       WHERE cm.campaign_id = $1`,
      [campaignId]
    )

    const combatants = members.rows.map((m, i) => ({
      id:             `pc-${i}`,
      type:           'pc',
      name:           m.character_name || m.username,
      username:       m.username,
      hp_max:         m.sheet_data?.hp_max || 10,
      hp_current:     m.sheet_data?.hp_current || m.sheet_data?.hp_max || 10,
      initiative:     null,
      initiative_roll: null,
      actions_max:    3,
      actions_left:   3,
      conditions:     [],
      armor_tier:     m.sheet_data?.armor_tier || 0,
      is_active_turn: false,
    }))

    const result = await db.query(
      `INSERT INTO combat_sessions (campaign_id, round_number, is_active, combatants)
       VALUES ($1, 1, true, $2) RETURNING *`,
      [campaignId, JSON.stringify(combatants)]
    )

    res.status(201).json({ session: result.rows[0] })
  } catch (err) {
    console.error('[combat/start]', err)
    res.status(500).json({ error: 'Failed to start combat.' })
  }
})

// ─── GET /api/combat/:campaignId/active ───────────────────────────────────────
router.get('/:campaignId/active', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM combat_sessions WHERE campaign_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [req.params.campaignId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'No active combat session.' })
    res.json({ session: result.rows[0] })
  } catch (err) {
    console.error('[combat/active]', err)
    res.status(500).json({ error: 'Failed to fetch combat session.' })
  }
})

// ─── PATCH /api/combat/:id ────────────────────────────────────────────────────
// Update combatants array or round number
router.patch('/:id', requireAuth, async (req, res) => {
  const { combatants, round_number } = req.body
  try {
    const session = await db.query('SELECT campaign_id FROM combat_sessions WHERE id = $1', [req.params.id])
    if (!session.rows[0]) return res.status(404).json({ error: 'Session not found.' })
    if (!await assertGM(session.rows[0].campaign_id, req.user.sub, res)) return

    const result = await db.query(
      `UPDATE combat_sessions SET
         combatants   = COALESCE($1::jsonb, combatants),
         round_number = COALESCE($2, round_number)
       WHERE id = $3 RETURNING *`,
      [
        combatants ? JSON.stringify(combatants) : null,
        round_number || null,
        req.params.id,
      ]
    )
    res.json({ session: result.rows[0] })
  } catch (err) {
    console.error('[combat/update]', err)
    res.status(500).json({ error: 'Failed to update combat.' })
  }
})

// ─── POST /api/combat/:id/end ─────────────────────────────────────────────────
router.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const session = await db.query('SELECT campaign_id FROM combat_sessions WHERE id = $1', [req.params.id])
    if (!session.rows[0]) return res.status(404).json({ error: 'Session not found.' })
    if (!await assertGM(session.rows[0].campaign_id, req.user.sub, res)) return

    await db.query('UPDATE combat_sessions SET is_active = false WHERE id = $1', [req.params.id])
    res.json({ message: 'Combat ended.' })
  } catch (err) {
    console.error('[combat/end]', err)
    res.status(500).json({ error: 'Failed to end combat.' })
  }
})

module.exports = router
