/**
 * socket-vtt.js — VTT Socket.io namespace (/vtt).
 *
 * Auth: same JWT handshake middleware as the main namespace.
 * Rooms: one Socket.io room per campaign (campaign:<id>).
 *        Only campaign members and the GM may join.
 *
 * The GM is the only client that sends scene_sync / scene_save.
 * Players receive scene state on join and live updates from the GM.
 *
 * Token moves are forwarded at high frequency (no server-side rate limit
 * beyond Socket.io's default). All other mutations go through scene_sync
 * (debounced on the client, 300ms).
 *
 * Scene persistence: scene_sync from the GM is written to vtt_scenes
 * (debounced 2s server-side to avoid hammering Postgres on every token drag).
 */

const { verifyToken }  = require('./utils/jwt')
const db               = require('./db')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Server-side scene persistence debounce ────────────────────────────────────
// Per campaign: timer + pending scene JSON. Fires 2s after last GM scene_sync.
const saveTimers = new Map()  // campaignId → { timer, sceneId, data }

function scheduleSceneSave(campaignId, sceneId, sceneData) {
  if (saveTimers.has(campaignId)) clearTimeout(saveTimers.get(campaignId).timer)
  const timer = setTimeout(async () => {
    saveTimers.delete(campaignId)
    try {
      await db.query(
        `UPDATE vtt_scenes SET scene_data = $1, updated_at = NOW()
         WHERE id = $2 AND campaign_id = $3`,
        [JSON.stringify(sceneData), sceneId, campaignId]
      )
    } catch (err) {
      console.error(`[vtt] Failed to persist scene ${sceneId}:`, err.message)
    }
  }, 2000)
  saveTimers.set(campaignId, { timer, sceneId, data: sceneData })
}

// ─── Register the /vtt namespace ─────────────────────────────────────────────

function createVTTNamespace(io) {
  if (process.env.VTT_ENABLED !== 'true') return  // no-op when disabled

  const vtt = io.of('/vtt')

  // ── JWT handshake auth ─────────────────────────────────────────────────────
  vtt.use((socket, next) => {
    const token = socket.handshake.auth?.token
                  ?? socket.handshake.headers?.authorization?.replace('Bearer ', '')
    if (!token) return next(new Error('No token'))
    try {
      socket.user = verifyToken(token)
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  // ── Connection handler ─────────────────────────────────────────────────────
  vtt.on('connection', (socket) => {

    // ── join_campaign — client connects to a campaign VTT session ─────────────
    socket.on('join_campaign', async ({ campaignId }, callback) => {
      if (!UUID_RE.test(campaignId ?? '')) {
        return callback?.({ ok: false, error: 'Invalid campaign ID.' })
      }

      try {
        // Verify membership
        const { rows } = await db.query(
          `SELECT c.gm_user_id, c.name AS campaign_name,
                  (cm.user_id IS NOT NULL) AS is_member
           FROM campaigns c
           LEFT JOIN campaign_members cm
             ON cm.campaign_id = c.id AND cm.user_id = $2 AND cm.left_at IS NULL
           WHERE c.id = $1`,
          [campaignId, socket.user.id]
        )

        if (!rows[0]) return callback?.({ ok: false, error: 'Campaign not found.' })

        const isGM     = rows[0].gm_user_id === socket.user.id
        const isMember = rows[0].is_member

        if (!isGM && !isMember) {
          return callback?.({ ok: false, error: 'Not a campaign member.' })
        }

        // Join the Socket.io room for this campaign
        const roomName = `campaign:${campaignId}`
        socket.join(roomName)
        socket.campaignId = campaignId
        socket.isGM       = isGM

        // Fetch (or create) the active scene
        let scene = null
        const { rows: sceneRows } = await db.query(
          `SELECT id, name, scene_data FROM vtt_scenes
           WHERE campaign_id = $1 AND is_active = true LIMIT 1`,
          [campaignId]
        )

        if (sceneRows[0]) {
          scene = { id: sceneRows[0].id, name: sceneRows[0].name, sceneData: sceneRows[0].scene_data }
        } else if (isGM) {
          // Auto-create first scene for GMs
          const { rows: [newScene] } = await db.query(
            `INSERT INTO vtt_scenes (campaign_id, name, is_active)
             VALUES ($1, 'Scene 1', true) RETURNING id, name`,
            [campaignId]
          )
          scene = { id: newScene.id, name: newScene.name, sceneData: {} }
        }

        // Broadcast to existing room members that someone joined
        socket.to(roomName).emit('vtt:member_joined', {
          userId:   socket.user.id,
          username: socket.user.username,
          isGM,
        })

        callback?.({
          ok: true,
          isGM,
          scene,
          campaignName: rows[0].campaign_name,
        })
      } catch (err) {
        console.error('[vtt] join_campaign error:', err.message)
        callback?.({ ok: false, error: 'Server error.' })
      }
    })

    // ── scene_sync — GM broadcasts full scene state ───────────────────────────
    socket.on('scene_sync', (data) => {
      if (!socket.isGM || !socket.campaignId) return
      const roomName = `campaign:${socket.campaignId}`

      // Forward to all players in the room
      socket.to(roomName).emit('scene_sync', data)

      // Persist (debounced 2s) — need the active scene ID
      db.query(
        `SELECT id FROM vtt_scenes WHERE campaign_id = $1 AND is_active = true LIMIT 1`,
        [socket.campaignId]
      ).then(({ rows }) => {
        if (rows[0]) scheduleSceneSave(socket.campaignId, rows[0].id, data)
      }).catch(() => {})
    })

    // ── token_move — high-frequency forwarding (no DB write) ─────────────────
    socket.on('token_move', (data) => {
      if (!socket.isGM || !socket.campaignId) return
      socket.to(`campaign:${socket.campaignId}`).emit('token_move', data)
    })

    // ── Granular events forwarded to players ──────────────────────────────────
    const FORWARD_EVENTS = [
      'token_add', 'token_delete',
      'wall_add',  'wall_delete', 'door_toggle',
      'light_add', 'light_delete',
      'drawing_add', 'drawing_delete',
      'fog_update',
      'ping_marker',
    ]
    for (const event of FORWARD_EVENTS) {
      socket.on(event, (data) => {
        if (!socket.isGM || !socket.campaignId) return
        socket.to(`campaign:${socket.campaignId}`).emit(event, data)
      })
    }

    // ── scene_activate — GM switches to a different scene ────────────────────
    socket.on('scene_activate', async ({ sceneId }, callback) => {
      if (!socket.isGM || !socket.campaignId) return callback?.({ ok: false, error: 'Not the GM.' })
      if (!UUID_RE.test(sceneId ?? '')) return callback?.({ ok: false, error: 'Invalid scene ID.' })

      try {
        await db.query('BEGIN')
        await db.query(`UPDATE vtt_scenes SET is_active = false WHERE campaign_id = $1`, [socket.campaignId])
        const { rows: [row] } = await db.query(
          `UPDATE vtt_scenes SET is_active = true, updated_at = NOW()
           WHERE id = $1 AND campaign_id = $2 RETURNING id, name, scene_data`,
          [sceneId, socket.campaignId]
        )
        await db.query('COMMIT')
        if (!row) {
          await db.query('ROLLBACK')
          return callback?.({ ok: false, error: 'Scene not found.' })
        }
        // Broadcast new scene to everyone in the room
        vtt.to(`campaign:${socket.campaignId}`).emit('scene_sync', row.scene_data)
        callback?.({ ok: true, scene: { id: row.id, name: row.name, sceneData: row.scene_data } })
      } catch (err) {
        await db.query('ROLLBACK')
        console.error('[vtt] scene_activate error:', err.message)
        callback?.({ ok: false, error: 'Server error.' })
      }
    })

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.campaignId) {
        socket.to(`campaign:${socket.campaignId}`).emit('vtt:member_left', {
          userId: socket.user.id,
        })
      }
    })
  })

  return vtt
}

module.exports = { createVTTNamespace }
