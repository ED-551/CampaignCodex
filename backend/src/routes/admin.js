const express = require('express')
const db      = require('../db')
const { requireAdmin, requireModerator } = require('../middleware/adminAuth')
const { sendBroadcastEmail } = require('../utils/email')

const router = express.Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      activeCampaigns,
      totalCharacters,
      totalSupporters,
      newsletterSubscribers,
      supportersByTier,
      charactersBySystem,
      campaignsBySystem,
      recentUsers,
      recentCampaigns,
      adminRoster,
      allUserCount,
    ] = await Promise.all([

      db.query('SELECT COUNT(*) AS count FROM users WHERE is_admin = false'),

      db.query('SELECT COUNT(*) AS count FROM campaigns WHERE is_active = true'),

      db.query('SELECT COUNT(*) AS count FROM characters'),

      db.query(`SELECT COUNT(*) AS count FROM users
                WHERE supporter_tier != 'free' AND is_admin = false`),

      db.query(`SELECT COUNT(*) AS count FROM users
                WHERE newsletter_opt_in = true AND is_admin = false`),

      db.query(`SELECT supporter_tier AS tier, COUNT(*) AS count
                FROM users WHERE supporter_tier != 'free' AND is_admin = false AND is_moderator = false
                GROUP BY supporter_tier
                ORDER BY CASE supporter_tier
                  WHEN 'platinum' THEN 1
                  WHEN 'gold'     THEN 2
                  WHEN 'silver'   THEN 3
                  WHEN 'bronze'   THEN 4
                END`),

      db.query(`SELECT game_system AS system, COUNT(*) AS count
                FROM characters GROUP BY game_system ORDER BY count DESC`),

      db.query(`SELECT game_system AS system, COUNT(*) AS count
                FROM campaigns GROUP BY game_system ORDER BY count DESC`),

      db.query(`SELECT id, username, email, supporter_tier, created_at
                FROM users WHERE is_admin = false
                ORDER BY created_at DESC LIMIT 10`),

      db.query(`SELECT c.id, c.name, c.game_system, c.join_code, c.created_at,
                       u.username AS gm_username,
                       (SELECT COUNT(*) FROM campaign_members cm
                        WHERE cm.campaign_id = c.id) AS member_count
                FROM campaigns c JOIN users u ON u.id = c.gm_user_id
                ORDER BY c.created_at DESC LIMIT 10`),

      // Admin/moderator roster for tier overview section
      db.query(`SELECT id, username, supporter_tier, is_admin, is_moderator, created_at
                FROM users
                WHERE (is_admin = true OR is_moderator = true) AND id != $1
                ORDER BY is_admin DESC, created_at ASC`, [req.user.sub]),

      // Total user count for broadcast raven (everyone except adm_ sender)
      db.query('SELECT COUNT(*) AS count FROM users WHERE id != $1', [req.user.sub]),
    ])

    res.json({
      stats: {
        totalUsers:             parseInt(totalUsers.rows[0].count),
        activeCampaigns:        parseInt(activeCampaigns.rows[0].count),
        totalCharacters:        parseInt(totalCharacters.rows[0].count),
        totalSupporters:        parseInt(totalSupporters.rows[0].count),
        newsletterSubscribers:  parseInt(newsletterSubscribers.rows[0].count),
        supportersByTier:       supportersByTier.rows,
        charactersBySystem:     charactersBySystem.rows,
        campaignsBySystem:      campaignsBySystem.rows,
      },
      recentUsers:     recentUsers.rows,
      recentCampaigns: recentCampaigns.rows,
      adminRoster:     adminRoster.rows,
      totalAllUsers:   parseInt(allUserCount.rows[0].count),
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    res.status(500).json({ error: 'Failed to fetch stats.' })
  }
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Primary admin (adm_) account is hidden from its own list via WHERE id != $1
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, first_name, last_name,
              supporter_tier, supporter_since, created_at,
              is_admin, is_moderator, is_banned, ban_reason, banned_until,
              (SELECT COUNT(*) FROM characters c WHERE c.user_id = users.id) AS character_count,
              (SELECT COUNT(*) FROM campaigns ca WHERE ca.gm_user_id = users.id) AS campaign_count
       FROM users
       WHERE id != $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.sub]
    )
    res.json({ users: result.rows })
  } catch (err) {
    console.error('[admin/users]', err)
    res.status(500).json({ error: 'Failed to fetch users.' })
  }
})

// ─── GET /api/admin/moderator/users ──────────────────────────────────────────
// Moderator-accessible user list with only the fields a moderator needs.
router.get('/moderator/users', requireModerator, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, created_at,
              is_banned, ban_reason, banned_at, banned_until, supporter_tier
       FROM users
       WHERE is_admin = false AND is_moderator = false
       ORDER BY created_at DESC
       LIMIT 200`
      // Note: banned_until included so future UI can show ban expiry in moderator view
    )
    res.json({ users: result.rows })
  } catch (err) {
    console.error('[admin/moderator/users]', err)
    res.status(500).json({ error: 'Failed to fetch users.' })
  }
})

// ─── PATCH /api/admin/users/:id/tier ─────────────────────────────────────────
// Manually grant a supporter tier (gifted support)
router.patch('/users/:id/tier', requireAdmin, async (req, res) => {
  const { tier } = req.body
  const valid = ['free', 'bronze', 'silver', 'gold', 'platinum', 'black']
  if (!valid.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier.' })
  }
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' })
  }

  try {
    // 'black' tier is reserved for admin accounts only
    if (tier === 'black') {
      const targetUser = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.params.id])
      if (!targetUser.rows[0]?.is_admin) {
        return res.status(400).json({ error: "'black' tier is reserved for admin accounts." })
      }
    }

    const result = await db.query(
      `UPDATE users SET supporter_tier = $1,
         supporter_since = CASE WHEN $1 != 'free' THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING id, username, supporter_tier`,
      [tier, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: result.rows[0], message: `Tier updated to ${tier}.` })
  } catch (err) {
    console.error('[admin/tier]', err)
    res.status(500).json({ error: 'Failed to update tier.' })
  }
})

// ─── PATCH /api/admin/users/:id/moderator ────────────────────────────────────
// Assign or remove the moderator role (admin only).
router.patch('/users/:id/moderator', requireAdmin, async (req, res) => {
  const { isModerator } = req.body
  if (typeof isModerator !== 'boolean') {
    return res.status(400).json({ error: 'isModerator must be a boolean.' })
  }
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' })
  }
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot change your own moderator status.' })
  }

  try {
    // Cannot assign moderator role to an admin account
    const targetUser = await db.query(
      'SELECT is_admin FROM users WHERE id = $1 LIMIT 1',
      [req.params.id]
    )
    if (!targetUser.rows[0]) {
      return res.status(404).json({ error: 'User not found.' })
    }
    if (targetUser.rows[0].is_admin) {
      return res.status(400).json({ error: 'Cannot assign moderator role to an admin account.' })
    }

    const result = await db.query(
      `UPDATE users
       SET is_moderator = $1, token_version = token_version + 1
       WHERE id = $2
       RETURNING id, username, is_moderator`,
      [isModerator, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    console.error('[admin/moderator]', err)
    res.status(500).json({ error: 'Failed to update moderator status.' })
  }
})

// ─── PATCH /api/admin/users/:id/ban ──────────────────────────────────────────
// Ban or unban a user. Primary admin can ban anyone; moderators cannot ban admins/mods.
// Duration options: '1day' | '1week' | '1month' | 'permanent'
router.patch('/users/:id/ban', requireModerator, async (req, res) => {
  const { isBanned, reason, duration } = req.body
  const isPrimaryAdmin = req.user.isAdmin === true

  if (typeof isBanned !== 'boolean') {
    return res.status(400).json({ error: 'isBanned must be a boolean.' })
  }
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' })
  }
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot ban yourself.' })
  }

  // Reason is required when banning
  if (isBanned) {
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required when issuing a ban.' })
    }
    const validDurations = ['1day', '1week', '1month', 'permanent']
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ error: 'Duration must be one of: 1day, 1week, 1month, permanent.' })
    }
  }

  try {
    const targetUser = await db.query(
      'SELECT is_admin, is_moderator FROM users WHERE id = $1 LIMIT 1',
      [req.params.id]
    )
    if (!targetUser.rows[0]) {
      return res.status(404).json({ error: 'User not found.' })
    }

    // Moderators cannot ban admins or other moderators — only primary admin can
    if (!isPrimaryAdmin && (targetUser.rows[0].is_admin || targetUser.rows[0].is_moderator)) {
      return res.status(400).json({ error: 'Cannot ban an admin or moderator account.' })
    }

    let result
    if (isBanned) {
      // Compute banned_until timestamp (null = permanent)
      let bannedUntil = null
      if (duration !== 'permanent') {
        const ms = { '1day': 86400000, '1week': 604800000, '1month': 2592000000 }
        bannedUntil = new Date(Date.now() + ms[duration]).toISOString()
      }

      result = await db.query(
        `UPDATE users
         SET is_banned = true,
             banned_at = NOW(),
             ban_reason = $1,
             banned_by_id = $2,
             banned_until = $3,
             token_version = token_version + 1
         WHERE id = $4
         RETURNING id, username, is_banned, ban_reason, banned_until`,
        [reason.trim(), req.user.sub, bannedUntil, req.params.id]
      )
    } else {
      result = await db.query(
        `UPDATE users
         SET is_banned = false,
             banned_at = null,
             ban_reason = null,
             banned_by_id = null,
             banned_until = null,
             token_version = token_version + 1
         WHERE id = $1
         RETURNING id, username, is_banned, ban_reason, banned_until`,
        [req.params.id]
      )
    }

    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    console.error('[admin/ban]', err)
    res.status(500).json({ error: 'Failed to update ban status.' })
  }
})

// ─── PATCH /api/admin/users/:id/admin ────────────────────────────────────────
// Grant or revoke admin (moderator) status — primary admin only.
router.patch('/users/:id/admin', requireAdmin, async (req, res) => {
  const { isAdmin: grantAdmin } = req.body
  if (typeof grantAdmin !== 'boolean') {
    return res.status(400).json({ error: 'isAdmin must be a boolean.' })
  }
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' })
  }
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot change your own admin status.' })
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET is_admin = $1,
           -- Revoking admin also clears moderator flag and black tier
           is_moderator = CASE WHEN $1 = false THEN false ELSE is_moderator END,
           supporter_tier = CASE WHEN $1 = false AND supporter_tier = 'black' THEN 'free' ELSE supporter_tier END,
           token_version = token_version + 1
       WHERE id = $2
       RETURNING id, username, is_admin, is_moderator, supporter_tier`,
      [grantAdmin, req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    console.error('[admin/admin-role]', err)
    res.status(500).json({ error: 'Failed to update admin status.' })
  }
})

// ─── POST /api/admin/broadcast-email ─────────────────────────────────────────
// Send a newsletter to all opted-in users via Resend.
// Requires { subject, body, confirm: true } in request body.
// `confirm: true` is a mandatory safety gate against accidental API calls.
router.post('/broadcast-email', requireAdmin, async (req, res) => {
  const { subject, body, confirm } = req.body

  if (!confirm) {
    return res.status(400).json({ error: 'Send not confirmed. Set confirm: true to proceed.' })
  }

  const subjectStr = (subject || '').trim()
  const bodyStr    = (body    || '').trim()

  if (!subjectStr)             return res.status(400).json({ error: 'Subject is required.' })
  if (subjectStr.length > 200) return res.status(400).json({ error: 'Subject must be 200 characters or fewer.' })
  if (!bodyStr)                return res.status(400).json({ error: 'Message body is required.' })
  if (bodyStr.length > 5000)   return res.status(400).json({ error: 'Message body must be 5,000 characters or fewer.' })

  try {
    const result = await db.query(
      `SELECT username, email FROM users
       WHERE newsletter_opt_in = true AND is_admin = false
       ORDER BY created_at ASC`
    )
    const recipients = result.rows

    if (recipients.length === 0) {
      return res.json({
        sent: 0, failed: 0, total: 0, stub: false,
        message: 'No users have opted in to the newsletter.',
      })
    }

    const stats = await sendBroadcastEmail(recipients, subjectStr, bodyStr)

    console.log(
      `[admin/broadcast] Admin: "${req.user?.username ?? 'unknown'}" | ` +
      `Subject: "${subjectStr}" | Sent: ${stats.sent} | Failed: ${stats.failed}`
    )

    res.json({
      ...stats,
      total: recipients.length,
      message: stats.stub
        ? `Stubbed to console (no RESEND_API_KEY). Would have reached ${recipients.length} subscriber(s).`
        : `Broadcast complete — ${stats.sent} delivered, ${stats.failed} failed.`,
    })
  } catch (err) {
    console.error('[admin/broadcast]', err)
    res.status(500).json({ error: 'Broadcast failed. Check server logs.' })
  }
})

// ─── POST /api/admin/broadcast-raven ─────────────────────────────────────────
// Send an in-app raven message to every user on the platform (no opt-out).
// A single INSERT ... SELECT fans out to all users in one round-trip.
// Requires { subject, body, confirm: true } in request body.
router.post('/broadcast-raven', requireAdmin, async (req, res) => {
  const { subject, body, confirm } = req.body

  if (!confirm) {
    return res.status(400).json({ error: 'Send not confirmed. Set confirm: true to proceed.' })
  }

  const subjectStr = (subject || '').trim()
  const bodyStr    = (body    || '').trim()

  if (!subjectStr)             return res.status(400).json({ error: 'Subject is required.' })
  if (subjectStr.length > 120) return res.status(400).json({ error: 'Subject must be 120 characters or fewer.' })
  if (!bodyStr)                return res.status(400).json({ error: 'Message body is required.' })
  if (bodyStr.length > 5000)   return res.status(400).json({ error: 'Message body must be 5,000 characters or fewer.' })

  try {
    // Batch-insert one raven per user (excluding the adm_ sender)
    const result = await db.query(
      `INSERT INTO raven_messages (sender_id, recipient_id, subject, body)
       SELECT $1, id, $2, $3
       FROM users
       WHERE id != $1
       RETURNING id`,
      [req.user.sub, subjectStr, bodyStr]
    )

    const sent = result.rows.length

    console.log(
      `[admin/broadcast-raven] Admin: "${req.user?.username ?? 'unknown'}" | ` +
      `Subject: "${subjectStr}" | Recipients: ${sent}`
    )

    res.json({
      sent,
      message: `Raven broadcast sent to ${sent} user${sent !== 1 ? 's' : ''}.`,
    })
  } catch (err) {
    console.error('[admin/broadcast-raven]', err)
    res.status(500).json({ error: 'Broadcast raven failed. Check server logs.' })
  }
})

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
// Permanently delete a non-admin user and all their data.
router.delete('/users/:id', requireAdmin, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' })
  }
  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND is_admin = false AND is_moderator = false RETURNING id, username',
      [req.params.id]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found or is a privileged account.' })
    }
    res.json({ message: `User "${result.rows[0].username}" permanently deleted.` })
  } catch (err) {
    console.error('[admin/delete-user]', err)
    res.status(500).json({ error: 'Failed to delete user.' })
  }
})

module.exports = router
