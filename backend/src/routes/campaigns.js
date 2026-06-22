const express    = require('express')
const { randomInt } = require('crypto')
const { body, validationResult } = require('express-validator')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

// Uses crypto.randomInt — cryptographically secure, unlike Math.random().
// Join codes are short-lived access credentials; predictability is a real risk.
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < 7; i++) {
    if (i === 3) code += '-'
    code += chars[randomInt(chars.length)]
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
    // Generate a unique join code — crypto.randomInt makes collisions exceedingly rare,
    // but we loop up to 10 times as a safety net against DB duplicates.
    let joinCode, tries = 0
    do {
      joinCode = generateJoinCode()
      const exists = await db.query('SELECT id FROM campaigns WHERE join_code = $1', [joinCode])
      if (!exists.rows.length) break
    } while (++tries < 10)

    if (tries >= 10) {
      console.error('[campaigns/create] Failed to generate unique join code after 10 attempts')
      return res.status(503).json({ error: 'Could not generate a unique join code. Please try again.' })
    }

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
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
  try {
    const camp = await db.query(
      `SELECT c.*, u.username AS gm_username,
              u.supporter_tier AS gm_supporter_tier,
              u.is_admin       AS gm_is_admin,
              ch.character_name AS gm_character_name,
              ch.portrait_url   AS gm_portrait_url,
              (SELECT COUNT(*)::int FROM combat_sessions cs
               WHERE cs.campaign_id = c.id AND cs.is_active = false) AS encounters_completed
       FROM campaigns c
       JOIN users u ON u.id = c.gm_user_id
       LEFT JOIN characters ch ON ch.id = c.gm_character_id
       WHERE c.id = $1`, [req.params.id]
    )
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })

    const members = await db.query(
      `SELECT cm.id, cm.user_id, cm.character_id, cm.joined_at, cm.left_at,
              u.username, u.supporter_tier, u.is_admin,
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
      'SELECT COUNT(*) FROM campaign_members WHERE campaign_id = $1 AND left_at IS NULL', [campaign.id]
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
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
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
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
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
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
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
  if (!UUID_RE.test(req.params.id) || !UUID_RE.test(req.params.memberId)) {
    return res.status(400).json({ error: 'Invalid ID.' })
  }
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

// ─── POST /api/campaigns/:id/invite ──────────────────────────────────────────
// GM invites a player by username.
router.post('/:id/invite', requireAuth, [
  body('username').trim().notEmpty().withMessage('Username is required.'),
], async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
  if (validationErrors(req, res)) return

  const { username } = req.body

  try {
    // Fetch campaign
    const campResult = await db.query(
      'SELECT * FROM campaigns WHERE id = $1', [req.params.id]
    )
    if (!campResult.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })

    const campaign = campResult.rows[0]

    // Requester must be GM
    if (campaign.gm_user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the GM can invite players.' })
    }

    // Look up target user by username (case-sensitive exact match)
    const userResult = await db.query(
      'SELECT id, username FROM users WHERE username = $1', [username]
    )
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: `No user found with username "${username}".` })
    }

    const targetUser = userResult.rows[0]

    // Cannot invite self
    if (targetUser.id === req.user.sub) {
      return res.status(400).json({ error: 'You cannot invite yourself.' })
    }

    // Cannot invite someone who has any row in campaign_members (active or departed)
    const existing = await db.query(
      'SELECT id FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
      [campaign.id, targetUser.id]
    )
    if (existing.rows.length) {
      return res.status(409).json({ error: 'This user already was a member of this campaign.' })
    }

    // Check player cap — determined by GM's tier, count active members only
    const gmResult = await db.query(
      'SELECT supporter_tier FROM users WHERE id = $1', [campaign.gm_user_id]
    )
    const cap = tierCap(gmResult.rows[0]?.supporter_tier ?? 'free')
    const memberCount = await db.query(
      'SELECT COUNT(*) FROM campaign_members WHERE campaign_id = $1 AND left_at IS NULL',
      [campaign.id]
    )
    if (parseInt(memberCount.rows[0].count) >= cap) {
      return res.status(403).json({ error: `This campaign is full (max ${cap} players).` })
    }

    // Insert member and return shaped row
    const insertResult = await db.query(
      `INSERT INTO campaign_members (campaign_id, user_id)
       VALUES ($1, $2)
       RETURNING id, user_id, character_id, joined_at, left_at`,
      [campaign.id, targetUser.id]
    )

    const row = insertResult.rows[0]
    const member = {
      id:             row.id,
      user_id:        row.user_id,
      character_id:   row.character_id,
      joined_at:      row.joined_at,
      left_at:        row.left_at,
      username:       targetUser.username,
      character_name: null,
      portrait_url:   null,
      game_system:    null,
    }

    res.status(201).json({ member })
  } catch (err) {
    console.error('[campaigns/invite]', err)
    res.status(500).json({ error: 'Failed to invite player.' })
  }
})

// ─── PATCH /api/campaigns/:id/gm-character ────────────────────────────────────
// GM sets or clears their own character for the campaign.
router.patch('/:id/gm-character', requireAuth, [
  body('characterId').optional({ nullable: true }),
], async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
  if (validationErrors(req, res)) return

  const { characterId } = req.body

  try {
    // Fetch campaign
    const campResult = await db.query(
      'SELECT gm_user_id, game_system FROM campaigns WHERE id = $1', [req.params.id]
    )
    if (!campResult.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })

    const campaign = campResult.rows[0]

    // Requester must be GM
    if (campaign.gm_user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the GM can set their character.' })
    }

    // If clearing, set to null directly
    if (characterId === null || characterId === undefined) {
      await db.query(
        'UPDATE campaigns SET gm_character_id = $1 WHERE id = $2',
        [null, req.params.id]
      )
      return res.json({ gm_character: null })
    }

    // Verify character exists, belongs to requesting user, and matches campaign game_system
    const charResult = await db.query(
      'SELECT id, user_id, character_name, portrait_url, game_system FROM characters WHERE id = $1',
      [characterId]
    )
    if (!charResult.rows[0]) {
      return res.status(404).json({ error: 'Character not found.' })
    }

    const character = charResult.rows[0]

    if (character.user_id !== req.user.sub) {
      return res.status(403).json({ error: 'You do not own this character.' })
    }

    if (character.game_system !== campaign.game_system) {
      return res.status(400).json({
        error: `Character must be a ${campaign.game_system} character for this campaign.`,
      })
    }

    await db.query(
      'UPDATE campaigns SET gm_character_id = $1 WHERE id = $2',
      [characterId, req.params.id]
    )

    res.json({
      gm_character: {
        id:             character.id,
        character_name: character.character_name,
        portrait_url:   character.portrait_url,
      },
    })
  } catch (err) {
    console.error('[campaigns/gm-character]', err)
    res.status(500).json({ error: 'Failed to update GM character.' })
  }
})

// ── PATCH /campaigns/:id/my-character ──────────────────────────────────────
// Let a player (non-GM member) set or clear the character they're playing in
// this campaign. Updates campaign_members.character_id for the calling user.
router.patch('/:id/my-character', requireAuth, [
  body('characterId').optional({ nullable: true }),
], async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid campaign ID.' })
  if (validationErrors(req, res)) return

  const { characterId } = req.body

  try {
    // Fetch campaign to get game_system and verify requester is not GM
    const campResult = await db.query(
      'SELECT gm_user_id, game_system FROM campaigns WHERE id = $1', [req.params.id]
    )
    if (!campResult.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })

    const campaign = campResult.rows[0]

    if (campaign.gm_user_id === req.user.sub) {
      return res.status(403).json({ error: 'GMs must use the /gm-character endpoint.' })
    }

    // Verify requester is an active member
    const memberResult = await db.query(
      `SELECT id FROM campaign_members
       WHERE campaign_id = $1 AND user_id = $2 AND left_at IS NULL
       LIMIT 1`,
      [req.params.id, req.user.sub]
    )
    if (!memberResult.rows[0]) {
      return res.status(403).json({ error: 'You are not a member of this campaign.' })
    }

    // Clearing — set to null
    if (characterId === null || characterId === undefined) {
      await db.query(
        `UPDATE campaign_members SET character_id = NULL
         WHERE campaign_id = $1 AND user_id = $2 AND left_at IS NULL`,
        [req.params.id, req.user.sub]
      )
      return res.json({ character: null })
    }

    // Validate the character UUID
    if (!UUID_RE.test(characterId)) {
      return res.status(400).json({ error: 'Invalid character ID.' })
    }

    // Verify character exists, belongs to requester, and matches campaign system
    const charResult = await db.query(
      'SELECT id, user_id, character_name, portrait_url, game_system FROM characters WHERE id = $1',
      [characterId]
    )
    if (!charResult.rows[0]) return res.status(404).json({ error: 'Character not found.' })

    const character = charResult.rows[0]

    if (character.user_id !== req.user.sub) {
      return res.status(403).json({ error: 'You do not own this character.' })
    }

    if (character.game_system !== campaign.game_system) {
      return res.status(400).json({
        error: `Character must be a ${campaign.game_system} character for this campaign.`,
      })
    }

    await db.query(
      `UPDATE campaign_members SET character_id = $1
       WHERE campaign_id = $2 AND user_id = $3 AND left_at IS NULL`,
      [characterId, req.params.id, req.user.sub]
    )

    res.json({
      character: {
        id:             character.id,
        character_name: character.character_name,
        portrait_url:   character.portrait_url,
      },
    })
  } catch (err) {
    console.error('[campaigns/my-character]', err)
    res.status(500).json({ error: 'Failed to update character.' })
  }
})

module.exports = router
