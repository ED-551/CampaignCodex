const express       = require('express')
const { requireAuth } = require('../middleware/auth')
const db            = require('../db')
const { getVTTNamespace } = require('../socket-vtt')
const { getIO }           = require('../socket')

const router = express.Router()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Guard: VTT must be enabled ────────────────────────────────────────────────
function requireVTT(req, res, next) {
  if (process.env.VTT_ENABLED !== 'true') return res.status(404).json({ error: 'VTT is not enabled.' })
  next()
}

// ── Guard: user must be a member or GM of the campaign ────────────────────────
async function requireCampaignAccess(req, res, next) {
  const { campaignId } = req.params
  if (!UUID_RE.test(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID.' })
  const { rows } = await db.query(
    `SELECT c.gm_user_id,
            (cm.user_id IS NOT NULL) AS is_member
     FROM campaigns c
     LEFT JOIN campaign_members cm
       ON cm.campaign_id = c.id AND cm.user_id = $2 AND cm.left_at IS NULL
     WHERE c.id = $1`,
    [campaignId, req.user.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
  const isGM     = rows[0].gm_user_id === req.user.id
  const isMember = rows[0].is_member
  if (!isGM && !isMember) return res.status(403).json({ error: 'Not a campaign member.' })
  req.campaign = { id: campaignId, isGM, gmUserId: rows[0].gm_user_id }
  next()
}

// ── GET /api/vtt/:campaignId/scenes ──────────────────────────────────────────
// List all scenes for a campaign.
router.get('/:campaignId/scenes', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, is_active, updated_at FROM vtt_scenes
       WHERE campaign_id = $1 ORDER BY updated_at DESC`,
      [req.params.campaignId]
    )
    res.json({ scenes: rows })
  } catch (err) { next(err) }
})

// ── GET /api/vtt/:campaignId/scenes/active ────────────────────────────────────
// Get the active scene's full data.
router.get('/:campaignId/scenes/active', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, scene_data FROM vtt_scenes
       WHERE campaign_id = $1 AND is_active = true LIMIT 1`,
      [req.params.campaignId]
    )
    res.json(rows[0] ?? null)
  } catch (err) { next(err) }
})

// ── POST /api/vtt/:campaignId/scenes ─────────────────────────────────────────
// Create a new scene (GM only).
router.post('/:campaignId/scenes', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  if (!req.campaign.isGM) return res.status(403).json({ error: 'Only the GM can create scenes.' })
  try {
    const name = (req.body.name || 'Untitled Scene').slice(0, 100)
    const { rows: [row] } = await db.query(
      `INSERT INTO vtt_scenes (campaign_id, name) VALUES ($1, $2) RETURNING id, name, is_active`,
      [req.params.campaignId, name]
    )
    res.status(201).json(row)
  } catch (err) { next(err) }
})

// ── PATCH /api/vtt/:campaignId/scenes/:sceneId/activate ──────────────────────
// Set a scene as active, deactivating all others (GM only).
router.patch('/:campaignId/scenes/:sceneId/activate', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  if (!req.campaign.isGM) return res.status(403).json({ error: 'Only the GM can switch scenes.' })
  const { sceneId } = req.params
  if (!UUID_RE.test(sceneId)) return res.status(400).json({ error: 'Invalid scene ID.' })
  try {
    await db.query('BEGIN')
    await db.query(
      `UPDATE vtt_scenes SET is_active = false WHERE campaign_id = $1`,
      [req.params.campaignId]
    )
    const { rows: [row] } = await db.query(
      `UPDATE vtt_scenes SET is_active = true, updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2 RETURNING id, name, is_active`,
      [sceneId, req.params.campaignId]
    )
    await db.query('COMMIT')
    if (!row) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Scene not found.' }) }
    res.json(row)
  } catch (err) { await db.query('ROLLBACK'); next(err) }
})

// ── DELETE /api/vtt/:campaignId/scenes/:sceneId ───────────────────────────────
// Delete a scene (GM only).
router.delete('/:campaignId/scenes/:sceneId', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  if (!req.campaign.isGM) return res.status(403).json({ error: 'Only the GM can delete scenes.' })
  const { sceneId } = req.params
  if (!UUID_RE.test(sceneId)) return res.status(400).json({ error: 'Invalid scene ID.' })
  try {
    const { rows: [row] } = await db.query(
      `DELETE FROM vtt_scenes WHERE id = $1 AND campaign_id = $2 RETURNING id`,
      [sceneId, req.params.campaignId]
    )
    if (!row) return res.status(404).json({ error: 'Scene not found.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── GET /api/vtt/:campaignId/session ──────────────────────────────────────────
// Returns whether a VTT session is currently active for the campaign.
router.get('/:campaignId/session', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT session_active FROM vtt_scenes
       WHERE campaign_id = $1 AND is_active = true LIMIT 1`,
      [req.params.campaignId]
    )
    res.json({ active: rows[0]?.session_active ?? false })
  } catch (err) { next(err) }
})

// ── POST /api/vtt/:campaignId/session/start ───────────────────────────────────
// GM sets the active scene's session_active = true and broadcasts to the room.
router.post('/:campaignId/session/start', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  if (!req.campaign.isGM) return res.status(403).json({ error: 'Only the GM can start a session.' })
  try {
    const { rows } = await db.query(
      `UPDATE vtt_scenes SET session_active = true
       WHERE campaign_id = $1 AND is_active = true
       RETURNING id`,
      [req.params.campaignId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'No active scene found.' })
    const vtt = getVTTNamespace()
    if (vtt) vtt.to(`campaign:${req.params.campaignId}`).emit('vtt:session_started', { campaignId: req.params.campaignId })
    // Also emit on main namespace so campaign page members receive the notification
    const io = getIO()
    if (io) io.to(`campaign:${req.params.campaignId}`).emit('vtt:session_started', { campaignId: req.params.campaignId })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── POST /api/vtt/:campaignId/session/end ────────────────────────────────────
// GM sets the active scene's session_active = false and broadcasts to the room.
router.post('/:campaignId/session/end', requireAuth, requireVTT, requireCampaignAccess, async (req, res, next) => {
  if (!req.campaign.isGM) return res.status(403).json({ error: 'Only the GM can end a session.' })
  try {
    await db.query(
      `UPDATE vtt_scenes SET session_active = false WHERE campaign_id = $1`,
      [req.params.campaignId]
    )
    const vtt = getVTTNamespace()
    if (vtt) vtt.to(`campaign:${req.params.campaignId}`).emit('vtt:session_ended', { campaignId: req.params.campaignId })
    // Also emit on main namespace so campaign page members receive the notification
    const io = getIO()
    if (io) io.to(`campaign:${req.params.campaignId}`).emit('vtt:session_ended', { campaignId: req.params.campaignId })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
