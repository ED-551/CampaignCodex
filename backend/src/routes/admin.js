const express = require('express')
const db      = require('../db')
const { requireAdmin } = require('../middleware/adminAuth')

const router = express.Router()

// All admin routes are protected by requireAdmin middleware
router.use(requireAdmin)

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeCampaigns,
      totalCharacters,
      totalSupporters,
      supportersByTier,
      charactersBySystem,
      campaignsBySystem,
      recentUsers,
      recentCampaigns,
    ] = await Promise.all([

      db.query('SELECT COUNT(*) AS count FROM users WHERE is_admin = false'),

      db.query('SELECT COUNT(*) AS count FROM campaigns WHERE is_active = true'),

      db.query('SELECT COUNT(*) AS count FROM characters'),

      db.query(`SELECT COUNT(*) AS count FROM users
                WHERE supporter_tier != 'free' AND is_admin = false`),

      db.query(`SELECT supporter_tier AS tier, COUNT(*) AS count
                FROM users WHERE supporter_tier != 'free' AND is_admin = false
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
    ])

    res.json({
      stats: {
        totalUsers:         parseInt(totalUsers.rows[0].count),
        activeCampaigns:    parseInt(activeCampaigns.rows[0].count),
        totalCharacters:    parseInt(totalCharacters.rows[0].count),
        totalSupporters:    parseInt(totalSupporters.rows[0].count),
        supportersByTier:   supportersByTier.rows,
        charactersBySystem: charactersBySystem.rows,
        campaignsBySystem:  campaignsBySystem.rows,
      },
      recentUsers:     recentUsers.rows,
      recentCampaigns: recentCampaigns.rows,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    res.status(500).json({ error: 'Failed to fetch stats.' })
  }
})

// ─── PATCH /api/admin/users/:id/tier ─────────────────────────────────────────
// Manually grant a supporter tier (gifted support)
router.patch('/users/:id/tier', async (req, res) => {
  const { tier } = req.body
  const valid = ['free', 'bronze', 'silver', 'gold', 'platinum']
  if (!valid.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier.' })
  }
  try {
    const result = await db.query(
      `UPDATE users SET supporter_tier = $1,
         supporter_since = CASE WHEN $1 != 'free' THEN NOW() ELSE NULL END
       WHERE id = $2 AND is_admin = false
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

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, first_name, last_name,
              supporter_tier, supporter_since, created_at,
              (SELECT COUNT(*) FROM characters c WHERE c.user_id = users.id) AS character_count,
              (SELECT COUNT(*) FROM campaigns ca WHERE ca.gm_user_id = users.id) AS campaign_count
       FROM users WHERE is_admin = false
       ORDER BY created_at DESC
       LIMIT 100`
    )
    res.json({ users: result.rows })
  } catch (err) {
    console.error('[admin/users]', err)
    res.status(500).json({ error: 'Failed to fetch users.' })
  }
})

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
// Permanently delete a non-admin user and all their data.
router.delete('/users/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND is_admin = false RETURNING id, username',
      [req.params.id]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found or is an administrator.' })
    }
    res.json({ message: `User "${result.rows[0].username}" permanently deleted.` })
  } catch (err) {
    console.error('[admin/delete-user]', err)
    res.status(500).json({ error: 'Failed to delete user.' })
  }
})

module.exports = router
