/**
 * Profile routes — public user profiles and own profile editing.
 *
 * Route order matters: GET /me and PATCH / must be defined BEFORE GET /:username
 * so Express doesn't interpret the literal string "me" as a username parameter.
 *
 * Block semantics: blocked users see each other's profiles as 404. This is
 * intentional — it prevents the blocker from being identified by the blocked user.
 */

const express = require('express')
const { body, param, validationResult } = require('express-validator')
const db          = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

const VALID_GAME_SYSTEMS = new Set(['shadowdark', 'morkborg', 'nimble'])
const VALID_THEMES       = new Set(['default', 'shadowdark', 'morkborg', 'nimble'])
const VALID_ROLE_PREFS   = new Set(['player', 'dm', 'both'])
const VALID_DISPLAY_PREFS = new Set(['username', 'first_and_username'])

// ─── Shared stats helper ──────────────────────────────────────────────────────
async function fetchStats(userId) {
  const [statsRes, friendsRes] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE cm.left_at IS NULL AND c.is_deleted = false)       AS campaign_count,
         COUNT(*) FILTER (WHERE cm.left_at IS NULL AND c.is_deleted = false
                            AND c.gm_user_id = $1)                                 AS dm_count,
         COUNT(*) FILTER (WHERE cm.left_at IS NULL AND c.is_deleted = false
                            AND c.gm_user_id != $1)                                AS player_count
       FROM campaign_members cm
       JOIN campaigns c ON c.id = cm.campaign_id
       WHERE cm.user_id = $1`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(*) FROM friend_requests
       WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`,
      [userId]
    ),
  ])
  return {
    campaigns: parseInt(statsRes.rows[0]?.campaign_count ?? 0),
    dm:        parseInt(statsRes.rows[0]?.dm_count        ?? 0),
    player:    parseInt(statsRes.rows[0]?.player_count    ?? 0),
    friends:   parseInt(friendsRes.rows[0]?.count         ?? 0),
  }
}

// ─── GET /api/profile/me ──────────────────────────────────────────────────────
// Own full profile — includes editable fields and real names.
router.get('/me', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, first_name, last_name, display_name_pref, about_text,
              role_pref, game_interests, profile_theme, supporter_tier, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.sub]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' })
    const u = result.rows[0]
    const stats = await fetchStats(req.user.sub)

    res.json({
      profile: {
        id:              u.id,
        username:        u.username,
        firstName:       u.first_name,
        lastName:        u.last_name,
        displayNamePref: u.display_name_pref ?? 'username',
        aboutText:       u.about_text        ?? '',
        rolePref:        u.role_pref         ?? 'both',
        gameInterests:   u.game_interests    ?? [],
        profileTheme:    u.profile_theme     ?? 'default',
        supporterTier:   u.supporter_tier,
        joinedAt:        u.created_at,
        stats,
      },
    })
  } catch (err) {
    console.error('[profile/me]', err)
    res.status(500).json({ error: 'Failed to load profile.' })
  }
})

// ─── PATCH /api/profile ───────────────────────────────────────────────────────
// Update own profile fields. Only provided fields are updated (partial patch).
router.patch('/', [
  body('displayNamePref')
    .optional()
    .custom(v => VALID_DISPLAY_PREFS.has(v)).withMessage('Invalid display name preference.'),
  body('aboutText')
    .optional({ nullable: true })
    .isString().isLength({ max: 1200 }).withMessage('About text must be 1200 characters or fewer.'),
  body('rolePref')
    .optional()
    .custom(v => VALID_ROLE_PREFS.has(v)).withMessage('Role must be player, dm, or both.'),
  body('gameInterests')
    .optional()
    .isArray({ max: 3 })
    .custom(arr => arr.every(g => VALID_GAME_SYSTEMS.has(g)))
    .withMessage('Invalid game interest value.'),
  body('profileTheme')
    .optional()
    .custom(v => VALID_THEMES.has(v)).withMessage('Invalid profile theme.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

  const { displayNamePref, aboutText, rolePref, gameInterests, profileTheme } = req.body

  const cols = []
  const vals = []
  let   i    = 1

  if (displayNamePref !== undefined) { cols.push(`display_name_pref = $${i++}`); vals.push(displayNamePref) }
  if (aboutText       !== undefined) { cols.push(`about_text = $${i++}`);        vals.push(aboutText || null) }
  if (rolePref        !== undefined) { cols.push(`role_pref = $${i++}`);         vals.push(rolePref) }
  if (gameInterests   !== undefined) { cols.push(`game_interests = $${i++}`);    vals.push(gameInterests) }
  if (profileTheme    !== undefined) { cols.push(`profile_theme = $${i++}`);     vals.push(profileTheme) }

  if (cols.length === 0) return res.json({ ok: true })

  cols.push(`updated_at = NOW()`)
  vals.push(req.user.sub)

  try {
    await db.query(
      `UPDATE users SET ${cols.join(', ')} WHERE id = $${i}`,
      vals
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[profile/patch]', err)
    res.status(500).json({ error: 'Failed to update profile.' })
  }
})

// ─── GET /api/profile/:username ───────────────────────────────────────────────
// Public profile view. Blocked users see 404.
router.get('/:username', [
  param('username')
    .matches(/^[a-zA-Z0-9_]{1,20}$/).withMessage('Invalid username.'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(404).json({ error: 'User not found.' })

  try {
    const result = await db.query(
      `SELECT id, username, first_name, display_name_pref, about_text,
              role_pref, game_interests, profile_theme, supporter_tier, created_at
       FROM users
       WHERE username = $1 AND is_admin = false
       LIMIT 1`,
      [req.params.username]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' })
    const u = result.rows[0]

    // Block check — symmetric: blocked users can't see each other's profiles
    if (u.id !== req.user.sub) {
      const blockCheck = await db.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [req.user.sub, u.id]
      )
      if (blockCheck.rows.length > 0) return res.status(404).json({ error: 'User not found.' })
    }

    const stats = await fetchStats(u.id)

    // Apply display name preference
    const displayName = (u.display_name_pref === 'first_and_username') ? u.first_name : null

    res.json({
      profile: {
        id:            u.id,
        username:      u.username,
        displayName,
        aboutText:     u.about_text     ?? '',
        rolePref:      u.role_pref      ?? 'both',
        gameInterests: u.game_interests ?? [],
        profileTheme:  u.profile_theme  ?? 'default',
        supporterTier: u.supporter_tier,
        joinedAt:      u.created_at,
        stats,
      },
    })
  } catch (err) {
    console.error('[profile/get]', err)
    res.status(500).json({ error: 'Failed to load profile.' })
  }
})

module.exports = router
