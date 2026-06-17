const express = require('express')
const { body, validationResult } = require('express-validator')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const GAME_SYSTEMS  = ['shadowdark', 'morkborg', 'nimble']
const FREE_LIMIT    = 10
const SUPPORTER_LIMIT = 30
const tierLimit = (tier) => tier === 'free' ? FREE_LIMIT : SUPPORTER_LIMIT

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

// ─── GET /api/characters ──────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, character_name, game_system, campaign_id, portrait_url,
              sheet_data, created_at, updated_at
       FROM characters WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.user.sub]
    )
    res.json({ characters: result.rows })
  } catch (err) {
    console.error('[characters/list]', err)
    res.status(500).json({ error: 'Failed to fetch characters.' })
  }
})

// ─── POST /api/characters ─────────────────────────────────────────────────────
router.post('/', requireAuth, [
  body('characterName').trim().notEmpty().withMessage('Character name is required.')
    .isLength({ max: 100 }),
  body('gameSystem').isIn(GAME_SYSTEMS)
    .withMessage('Invalid game system.'),
  body('campaignId').optional().isUUID().withMessage('Invalid campaign ID.'),
  body('sheetData').optional().isObject().withMessage('Sheet data must be an object.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { characterName, gameSystem, campaignId, sheetData } = req.body

  try {
    // Check the user's tier sheet limit
    const tierResult = await db.query(
      'SELECT supporter_tier FROM users WHERE id = $1', [req.user.sub]
    )
    const limit = tierLimit(tierResult.rows[0]?.supporter_tier ?? 'free')
    const countResult = await db.query(
      'SELECT COUNT(*) FROM characters WHERE user_id = $1', [req.user.sub]
    )
    if (parseInt(countResult.rows[0].count) >= limit) {
      return res.status(403).json({
        error: `You've reached your character sheet limit (${limit}). ${
          limit === FREE_LIMIT
            ? 'Support CampaignCodex to unlock 30 sheets.'
            : 'Maximum supporter limit reached.'
        }`,
      })
    }

    // If joining a campaign, verify membership AND game system match
    if (campaignId) {
      const campResult = await db.query(
        'SELECT game_system FROM campaigns WHERE id = $1', [campaignId]
      )
      if (!campResult.rows[0]) {
        return res.status(404).json({ error: 'Campaign not found.' })
      }
      if (campResult.rows[0].game_system !== gameSystem) {
        return res.status(400).json({
          error: `This campaign uses ${campResult.rows[0].game_system}. Your character must match.`,
        })
      }
      // Must be a member of the campaign to link a character to it
      const memberCheck = await db.query(
        'SELECT id FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
        [campaignId, req.user.sub]
      )
      if (!memberCheck.rows[0]) {
        return res.status(403).json({ error: 'You must join the campaign before adding a character.' })
      }
    }

    const result = await db.query(
      `INSERT INTO characters (user_id, campaign_id, game_system, character_name, sheet_data)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.user.sub, campaignId || null, gameSystem, characterName, sheetData || {}]
    )

    // If campaign is set, link character in campaign_members
    if (campaignId) {
      await db.query(
        `UPDATE campaign_members SET character_id = $1
         WHERE campaign_id = $2 AND user_id = $3`,
        [result.rows[0].id, campaignId, req.user.sub]
      )
    }

    res.status(201).json({ character: result.rows[0] })
  } catch (err) {
    console.error('[characters/create]', err)
    res.status(500).json({ error: 'Failed to create character.' })
  }
})

// ─── GET /api/characters/:id ──────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.username AS owner_username
       FROM characters c JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Character not found.' })

    const char = result.rows[0]
    // Allow: owner, campaign GM, or admin
    const isOwner = char.user_id === req.user.sub
    let   isGM    = false
    if (char.campaign_id) {
      const gm = await db.query(
        'SELECT gm_user_id FROM campaigns WHERE id = $1', [char.campaign_id]
      )
      isGM = gm.rows[0]?.gm_user_id === req.user.sub
    }

    if (!isOwner && !isGM && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    // Include viewer role flags so the frontend can render edit vs. read-only
    // without needing a separate campaign fetch.
    res.json({
      character: {
        ...char,
        viewer_is_owner: isOwner,
        viewer_is_gm:    isGM || req.user.isAdmin,
      },
    })
  } catch (err) {
    console.error('[characters/get]', err)
    res.status(500).json({ error: 'Failed to fetch character.' })
  }
})

// ─── PATCH /api/characters/:id ────────────────────────────────────────────────
// Allowed editors: the character owner, the GM of the campaign the character
// is currently assigned to, or a site admin.
//
// Portrait URL updates are owner-only — it's a personal asset. GMs can edit
// all sheet data and the character name but cannot swap another player's portrait.
router.patch('/:id', requireAuth, [
  body('characterName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('sheetData').optional().isObject(),
  body('portraitUrl').optional().isURL().withMessage('Invalid portrait URL.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  try {
    const result = await db.query(
      'SELECT user_id, campaign_id FROM characters WHERE id = $1',
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Character not found.' })

    const char    = result.rows[0]
    const isOwner = char.user_id === req.user.sub

    // Check GM access only if not the owner (saves a DB query in the common case)
    let isGM = false
    if (!isOwner && char.campaign_id) {
      const gmCheck = await db.query(
        `SELECT gm_user_id FROM campaigns
         WHERE id = $1 AND is_deleted = false`,
        [char.campaign_id]
      )
      isGM = gmCheck.rows[0]?.gm_user_id === req.user.sub
    }

    if (!isOwner && !isGM && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const { characterName, sheetData, portraitUrl } = req.body

    // GMs cannot change another player's portrait — that's personal
    if (portraitUrl && !isOwner && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only the character owner can change their portrait.' })
    }

    const updated = await db.query(
      `UPDATE characters SET
         character_name = COALESCE($1, character_name),
         sheet_data     = COALESCE($2, sheet_data),
         portrait_url   = COALESCE($3, portrait_url)
       WHERE id = $4
       RETURNING *`,
      [characterName || null, sheetData ? JSON.stringify(sheetData) : null,
       portraitUrl || null, req.params.id]
    )
    res.json({ character: updated.rows[0] })
  } catch (err) {
    console.error('[characters/update]', err)
    res.status(500).json({ error: 'Failed to update character.' })
  }
})

// ─── DELETE /api/characters/:id ───────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT user_id FROM characters WHERE id = $1', [req.params.id])
    if (!result.rows[0]) return res.status(404).json({ error: 'Character not found.' })
    if (result.rows[0].user_id !== req.user.sub && !req.user.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own characters.' })
    }
    await db.query('DELETE FROM characters WHERE id = $1', [req.params.id])
    res.json({ message: 'Character deleted.' })
  } catch (err) {
    console.error('[characters/delete]', err)
    res.status(500).json({ error: 'Failed to delete character.' })
  }
})

module.exports = router
