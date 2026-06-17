const express = require('express')
const { body, validationResult } = require('express-validator')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const GAME_SYSTEMS    = ['shadowdark', 'morkborg', 'nimble']
const FREE_CAP        = 6
const SUPPORTER_CAP   = 12
const tierCap = (tier) => tier === 'free' ? FREE_CAP : SUPPORTER_CAP

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < 7; i++) {
    if (i === 3) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code // e.g. "XKF-9TRA"
}

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
// Lists campaigns the user is involved in.
// • GM   → only non-deleted campaigns (they deleted them, no point showing)
// • Player → all campaigns they're a member of, including soft-deleted ones
//            (so they see the "GM deleted this" tombstone and can dismiss it)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.username AS gm_username,
              (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.id) AS member_count
       FROM campaigns c
       JOIN users u ON u.id = c.gm_user_id
       WHERE (c.gm_user_id = $1 AND c.is_deleted = false)
          OR c.id IN (SELECT campaign_id FROM campaign_members WHERE user_id = $1 AND left_at IS NULL)
       ORDER BY c.created_at DESC`,
      [req.user.sub]
    )
    res.json({ campaigns: result.rows })
  } catch (err) {
    console.error('[campaigns/list]', err)
    res.status(500).json({ error: 'Failed to fetch campaigns.' })
  }
})

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
router.post('/', requireAuth, [
  body('name').trim().notEmpty().withMessage('Campaign name is required.')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters.'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('gameSystem').isIn(GAME_SYSTEMS)
    .withMessage('Game system must be shadowdark, morkborg, or nimble.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { name, description, gameSystem } = req.body

  try {
    // Generate a unique join code
    let joinCode, tries = 0
    do {
      joinCode = generateJoinCode()
      const exists = await db.query('SELECT id FROM campaigns WHERE join_code = $1', [joinCode])
      if (!exists.rows.length) break
    } while (++tries < 10)

    const result = await db.query(
      `INSERT INTO campaigns (name, description, game_system, gm_user_id, join_code)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, description || null, gameSystem, req.user.sub, joinCode]
    )

    res.status(201).json({ campaign: result.rows[0] })
  } catch (err) {
    console.error('[campaigns/create]', err)
    res.status(500).json({ error: 'Failed to create campaign.' })
  }
})

// ─── GET /api/campaigns/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const camp = await db.query(
      `SELECT c.*, u.username AS gm_username
       FROM campaigns c JOIN users u ON u.id = c.gm_user_id
       WHERE c.id = $1`, [req.params.id]
    )
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })

    const members = await db.query(
      `SELECT cm.id, cm.user_id, cm.character_id, cm.joined_at, cm.left_at,
              u.username,
              ch.character_name, ch.portrait_url, ch.game_system
       FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN characters ch ON ch.id = cm.character_id
       WHERE cm.campaign_id = $1
       ORDER BY cm.joined_at ASC`,
      [req.params.id]
    )

    res.json({ campaign: camp.rows[0], members: members.rows })
  } catch (err) {
    console.error('[campaigns/get]', err)
    res.status(500).json({ error: 'Failed to fetch campaign.' })
  }
})

// ─── POST /api/campaigns/join ─────────────────────────────────────────────────
router.post('/join', requireAuth, [
  body('joinCode').trim().notEmpty().withMessage('Join code is required.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const code = req.body.joinCode.toUpperCase().trim()

  try {
    const campResult = await db.query(
      'SELECT * FROM campaigns WHERE join_code = $1 AND is_active = true LIMIT 1',
      [code]
    )
    if (!campResult.rows[0]) {
      return res.status(404).json({ error: 'Campaign not found. Check your join code.' })
    }

    const campaign = campResult.rows[0]

    // Can't join your own campaign as a player
    if (campaign.gm_user_id === req.user.sub) {
      return res.status(400).json({ error: 'You are the GM of this campaign.' })
    }

    // Check if already joined
    const already = await db.query(
      'SELECT id FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
      [campaign.id, req.user.sub]
    )
    if (already.rows.length) {
      return res.status(409).json({ error: 'You are already in this campaign.' })
    }

    // Check player cap — determined by GM's tier
    const gmResult = await db.query(
      'SELECT supporter_tier FROM users WHERE id = $1', [campaign.gm_user_id]
    )
    const cap = tierCap(gmResult.rows[0]?.supporter_tier ?? 'free')
    const memberCount = await db.query(
      'SELECT COUNT(*) FROM campaign_members WHERE campaign_id = $1', [campaign.id]
    )
    if (parseInt(memberCount.rows[0].count) >= cap) {
      return res.status(403).json({ error: `This campaign is full (max ${cap} players).` })
    }

    await db.query(
      'INSERT INTO campaign_members (campaign_id, user_id) VALUES ($1,$2)',
      [campaign.id, req.user.sub]
    )

    res.status(201).json({ campaign, message: 'Joined campaign successfully.' })
  } catch (err) {
    console.error('[campaigns/join]', err)
    res.status(500).json({ error: 'Failed to join campaign.' })
  }
})

// ─── DELETE /api/campaigns/:id ────────────────────────────────────────────────
// Soft-deletes the campaign. Players still see it as a dismissible tombstone.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT gm_user_id FROM campaigns WHERE id = $1', [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
    if (result.rows[0].gm_user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only the GM can delete this campaign.' })
    }

    await db.query(
      'UPDATE campaigns SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
      [req.params.id]
    )
    res.json({ message: 'Campaign deleted.' })
  } catch (err) {
    console.error('[campaigns/delete]', err)
    res.status(500).json({ error: 'Failed to delete campaign.' })
  }
})

// ─── POST /api/campaigns/:id/dismiss ─────────────────────────────────────────
// Player dismisses a soft-deleted campaign — removes them from campaign_members.
router.post('/:id/dismiss', requireAuth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    res.json({ message: 'Campaign dismissed.' })
  } catch (err) {
    console.error('[campaigns/dismiss]', err)
    res.status(500).json({ error: 'Failed to dismiss campaign.' })
  }
})

// ─── POST /api/campaigns/:id/leave ───────────────────────────────────────────
// Player voluntarily leaves a campaign (soft-leave: sets left_at).
// The GM can still see the departed member on the campaign detail page.
router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const camp = await db.query('SELECT gm_user_id FROM campaigns WHERE id = $1', [req.params.id])
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
    if (camp.rows[0].gm_user_id === req.user.sub) {
      return res.status(400).json({ error: 'GMs cannot leave their own campaign. Delete it instead.' })
    }
    const result = await db.query(
      `UPDATE campaign_members SET left_at = NOW()
       WHERE campaign_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING id`,
      [req.params.id, req.user.sub]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'You are not an active member of this campaign.' })
    res.json({ message: 'You have left the campaign.' })
  } catch (err) {
    console.error('[campaigns/leave]', err)
    res.status(500).json({ error: 'Failed to leave campaign.' })
  }
})

// ─── DELETE /api/campaigns/:id/members/:memberId ─────────────────────────────
// GM dismisses a departed (left_at set) member — permanently removes the record.
router.delete('/:id/members/:memberId', requireAuth, async (req, res) => {
  try {
    const camp = await db.query('SELECT gm_user_id FROM campaigns WHERE id = $1', [req.params.id])
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
    if (camp.rows[0].gm_user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only the GM can remove members.' })
    }
    await db.query(
      'DELETE FROM campaign_members WHERE id = $1 AND campaign_id = $2 AND left_at IS NOT NULL',
      [req.params.memberId, req.params.id]
    )
    res.json({ message: 'Member record removed.' })
  } catch (err) {
    console.error('[campaigns/remove-member]', err)
    res.status(500).json({ error: 'Failed to remove member.' })
  }
})

module.exports = router
