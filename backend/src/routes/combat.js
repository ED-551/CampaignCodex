const express = require('express')
const { body, validationResult } = require('express-validator')
const crypto  = require('crypto')
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

// Allowlist of keys permitted on each combatant object written to the DB.
// Any key not in this set is stripped before persistence.
const COMBATANT_ALLOWED_KEYS = new Set([
  'id', 'type', 'seatIndex', 'joinOrder', 'name', 'username', 'characterId',
  'isGMCharacter', 'hp_current', 'hp_max', 'hp_label', 'ac', 'dex_mod',
  'agility', 'initiative', 'conditions', 'is_active_turn', 'is_dead',
  'has_gone', 'notes', 'monsterId', 'morale',
  'is_legendary_boss', 'legendary_slots_gone',
])

function sanitizeCombatant(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null
  const out = {}
  for (const key of COMBATANT_ALLOWED_KEYS) {
    if (key in c) out[key] = c[key]
  }
  return out
}

// Mirrors the calcArmor() function in NimbleSheet.jsx
// armor: { type, formula } | null, shield: { formula } | null
// dex/str: raw modifier values from sheet_data.stats
function calcNimbleAC(armor, shield, dex = 0, str = 0, className = '') {
  let value = (className === 'Zephyr' && !armor) ? dex + str : dex
  if (armor) {
    const base = parseInt(armor.formula, 10) || 0
    if (armor.type === 'Cloth' || armor.type === 'Leather') {
      value = base + dex
    } else if (armor.type === 'Mail') {
      value = base + Math.min(dex, 2)
    } else if (armor.type === 'Plate') {
      value = base
    }
  }
  if (shield) {
    const bonus = parseInt((shield.formula || '').replace('+', ''), 10) || 0
    value += bonus
  }
  return value
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

// Returns a label for monster HP without revealing the actual numbers.
function hpLabel(combatant) {
  if (combatant.is_dead) return 'Dead'
  const hp  = combatant.hp_current ?? 0
  const max = combatant.hp_max ?? 1
  const conds = combatant.conditions ?? []
  if (conds.includes('Dead')) return 'Dead'
  if (hp <= 0 || conds.includes('dying')) return 'Dying'
  if (max > 0 && hp / max <= 0.25) return 'Near Death'
  if (max > 0 && hp / max <= 0.5)  return 'Bloodied'
  return 'Healthy'
}

// Strips hp_current / hp_max from non-PC combatants and replaces with hp_label.
// GM cards (type:'gm') are passed through untouched — they have no HP to hide.
function sanitizeCombatants(combatants) {
  if (!Array.isArray(combatants)) return combatants
  return combatants.map(c => {
    if (c.type === 'pc' || c.type === 'gm') return c
    const label = hpLabel(c)
    const { hp_current, hp_max, ...rest } = c
    return { ...rest, hp_label: label }
  })
}

// ─── POST /api/combat/start ───────────────────────────────────────────────────
// GM starts a new combat session for a campaign (ends any active one first).
// Optional body: encounterId (UUID), surpriseRound (boolean).
router.post('/start', requireAuth, [
  body('campaignId').isUUID().withMessage('Valid campaign ID required.'),
  body('encounterId').optional({ nullable: true }).isUUID().withMessage('Invalid encounter ID.'),
  body('surpriseRound').optional().isBoolean(),
], async (req, res) => {
  if (validationErrors(req, res)) return
  const { campaignId, encounterId, surpriseRound } = req.body

  try {
    // Fetch campaign + GM username + GM's own character (if they're playing one)
    const campRow = await db.query(
      `SELECT c.gm_user_id, c.gm_character_id, c.game_system, u.username AS gm_username
       FROM campaigns c JOIN users u ON u.id = c.gm_user_id
       WHERE c.id = $1`,
      [campaignId]
    )
    if (!campRow.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
    if (campRow.rows[0].gm_user_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the GM can manage combat.' })
    }
    const { gm_username: gmUsername, gm_character_id: gmCharacterId, game_system: gameSystem } = campRow.rows[0]

    // ── Nimble RPG uses a completely different combat structure ──────────────────
    // No GM card, no seatIndex. Turn order is "whoever is ready goes first."
    // has_gone tracks who has taken their turn this round (checkbox-based).
    if (gameSystem === 'nimble') {
      await db.query(
        'UPDATE combat_sessions SET is_active = false WHERE campaign_id = $1 AND is_active = true',
        [campaignId]
      )

      const nimbleMembers = await db.query(
        `SELECT u.username, ch.id AS character_id, ch.character_name, ch.sheet_data
         FROM campaign_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN characters ch ON ch.id = cm.character_id
         WHERE cm.campaign_id = $1 AND cm.left_at IS NULL AND cm.user_id != $2
         ORDER BY cm.joined_at ASC`,
        [campaignId, req.user.sub]
      )

      // ── GM's own character as a PC combatant (if they have one linked) ────────
      let nimbleGMChar = null
      if (gmCharacterId) {
        const gmChRow = await db.query(
          'SELECT id, character_name, sheet_data FROM characters WHERE id = $1',
          [gmCharacterId]
        )
        if (gmChRow.rows[0]) {
          const ch = gmChRow.rows[0]
          const sd = ch.sheet_data ?? {}
          nimbleGMChar = {
            id:            crypto.randomUUID(),
            type:          'pc',
            joinOrder:     0,           // GM char always listed first
            isGMCharacter: true,
            name:          ch.character_name,
            username:      gmUsername,
            characterId:   ch.id,
            hp_max:        sd.hp_max     || 10,
            hp_current:    sd.hp_current || sd.hp_max || 10,
            ac:            calcNimbleAC(sd.armor ?? null, sd.shield ?? null, sd.stats?.dex ?? 0, sd.stats?.str ?? 0, sd.className ?? ''),
            has_gone:      false,
            is_dead:       false,
            conditions:    [],
            notes:         '',
            monsterId:     null,
          }
        }
      }

      // Shift player joinOrder up by 1 when GM character occupies slot 0
      const nimbleOffset     = nimbleGMChar ? 1 : 0
      const nimbleCombatants = nimbleMembers.rows.map((m, i) => {
        const sd = m.sheet_data ?? {}
        return {
          id:          crypto.randomUUID(),
          type:        'pc',
          joinOrder:   i + nimbleOffset,
          name:        m.character_name || m.username,
          username:    m.username,
          characterId: m.character_id || null,
          hp_max:      sd.hp_max     || 10,
          hp_current:  sd.hp_current || sd.hp_max || 10,
          ac:          calcNimbleAC(sd.armor ?? null, sd.shield ?? null, sd.stats?.dex ?? 0, sd.stats?.str ?? 0, sd.className ?? ''),
          has_gone:    false,
          is_dead:     false,
          conditions:  [],
          notes:       '',
          monsterId:   null,
        }
      })

      let nimbleMonsters  = []
      let nimbleEncId     = null
      let nimbleEncName   = null

      if (encounterId) {
        const encResult = await db.query(
          'SELECT id, name, monsters FROM encounters WHERE id = $1 AND user_id = $2',
          [encounterId, req.user.sub]
        )
        if (!encResult.rows[0]) return res.status(404).json({ error: 'Encounter not found or access denied.' })
        const enc = encResult.rows[0]
        nimbleEncId   = enc.id
        nimbleEncName = enc.name
        for (const m of enc.monsters ?? []) {
          const count = m.count || 1
          for (let i = 1; i <= count; i++) {
            nimbleMonsters.push({
              id:                   crypto.randomUUID(),
              type:                 'monster',
              name:                 count > 1 ? `${m.name} #${i}` : m.name,
              hp_current:           m.hp,
              hp_max:               m.maxHp || m.hp,
              ac:                   m.ac,
              has_gone:             false,
              is_dead:              false,
              is_legendary_boss:    false,
              legendary_slots_gone: [],
              conditions:           [],
              notes:                m.notes || '',
              monsterId:            m.monsterId || null,
            })
          }
        }
        await db.query('UPDATE encounters SET times_used = times_used + 1 WHERE id = $1', [encounterId])
      }

      const nimbleAll = [
        ...(nimbleGMChar ? [nimbleGMChar] : []),
        ...nimbleCombatants,
        ...nimbleMonsters,
      ]
      const nimbleResult = await db.query(
        `INSERT INTO combat_sessions
           (campaign_id, round_number, is_active, combatants, encounter_id, encounter_name, phase, combat_mode)
         VALUES ($1, 1, true, $2, $3, $4, 'active', 'standard')
         RETURNING *`,
        [campaignId, JSON.stringify(nimbleAll), nimbleEncId, nimbleEncName]
      )
      return res.status(201).json({ session: nimbleResult.rows[0] })
    }
    // ── End Nimble path — Shadowdark / other systems continue below ──────────

    // ── Mörk Borg path ─────────────────────────────────────────────────────────
    // No GM card, no seatIndex, no initiative values at start.
    // Initiative winner (mb_players / mb_enemies) is determined in-session by
    // rolling a d6 — the frontend stores the result via PATCH combat_mode.
    // PCs get agility stored for individual-initiative variant (Agility + d6).
    if (gameSystem === 'morkborg') {
      await db.query(
        'UPDATE combat_sessions SET is_active = false WHERE campaign_id = $1 AND is_active = true',
        [campaignId]
      )

      const mbMembers = await db.query(
        `SELECT u.username, ch.id AS character_id, ch.character_name, ch.sheet_data
         FROM campaign_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN characters ch ON ch.id = cm.character_id
         WHERE cm.campaign_id = $1 AND cm.left_at IS NULL AND cm.user_id != $2
         ORDER BY cm.joined_at ASC`,
        [campaignId, req.user.sub]
      )

      // ── GM's own character as a PC combatant (if they have one linked) ────────
      let mbGMChar = null
      if (gmCharacterId) {
        const gmChRow = await db.query(
          'SELECT id, character_name, sheet_data FROM characters WHERE id = $1',
          [gmCharacterId]
        )
        if (gmChRow.rows[0]) {
          const ch = gmChRow.rows[0]
          const sd = ch.sheet_data ?? {}
          mbGMChar = {
            id:            crypto.randomUUID(),
            type:          'pc',
            joinOrder:     0,
            isGMCharacter: true,
            name:          ch.character_name,
            username:      gmUsername,
            characterId:   ch.id,
            hp_max:        sd.hp_max     || 10,
            hp_current:    sd.hp_current || sd.hp_max || 10,
            ac:            sd.ac         || 10,
            agility:       sd.agility    ?? 0,
            has_gone:      false,
            is_dead:       false,
            conditions:    [],
            notes:         '',
            monsterId:     null,
          }
        }
      }

      const mbOffset     = mbGMChar ? 1 : 0
      const mbCombatants = mbMembers.rows.map((m, i) => {
        const sd = m.sheet_data ?? {}
        return {
          id:          crypto.randomUUID(),
          type:        'pc',
          joinOrder:   i + mbOffset,
          name:        m.character_name || m.username,
          username:    m.username,
          characterId: m.character_id || null,
          hp_max:      sd.hp_max      || 10,
          hp_current:  sd.hp_current  || sd.hp_max || 10,
          ac:          sd.ac          || 10,
          agility:     sd.agility     ?? 0,
          has_gone:    false,
          is_dead:     false,
          conditions:  [],
          notes:       '',
          monsterId:   null,
        }
      })

      let mbMonsters   = []
      let mbEncId      = null
      let mbEncName    = null

      if (encounterId) {
        const encResult = await db.query(
          'SELECT id, name, monsters FROM encounters WHERE id = $1 AND user_id = $2',
          [encounterId, req.user.sub]
        )
        if (!encResult.rows[0]) return res.status(404).json({ error: 'Encounter not found or access denied.' })
        const enc = encResult.rows[0]
        mbEncId   = enc.id
        mbEncName = enc.name
        for (const m of enc.monsters ?? []) {
          const count = m.count || 1
          for (let i = 1; i <= count; i++) {
            mbMonsters.push({
              id:         crypto.randomUUID(),
              type:       'monster',
              name:       count > 1 ? `${m.name} #${i}` : m.name,
              hp_current: m.hp,
              hp_max:     m.maxHp || m.hp,
              ac:         m.ac,
              morale:     m.morale || null,
              has_gone:   false,
              is_dead:    false,
              conditions: [],
              notes:      m.notes || '',
              monsterId:  m.monsterId || null,
            })
          }
        }
        await db.query('UPDATE encounters SET times_used = times_used + 1 WHERE id = $1', [encounterId])
      }

      const mbAll = [
        ...(mbGMChar ? [mbGMChar] : []),
        ...mbCombatants,
        ...mbMonsters,
      ]
      const mbResult = await db.query(
        `INSERT INTO combat_sessions
           (campaign_id, round_number, is_active, combatants, encounter_id, encounter_name, phase, combat_mode)
         VALUES ($1, 1, true, $2, $3, $4, 'active', 'mb_pending')
         RETURNING *`,
        [campaignId, JSON.stringify(mbAll), mbEncId, mbEncName]
      )
      return res.status(201).json({ session: mbResult.rows[0] })
    }
    // ── End Mörk Borg path ───────────────────────────────────────────────────

    // End existing active session
    await db.query(
      'UPDATE combat_sessions SET is_active = false WHERE campaign_id = $1 AND is_active = true',
      [campaignId]
    )

    // ── GM card — always seat 0 ───────────────────────────────────────────────
    const gmCard = {
      id:             `gm-${crypto.randomUUID()}`,
      type:           'gm',
      seatIndex:      0,
      name:           'Game Master',
      username:       gmUsername,
      hp_current:     null,
      hp_max:         null,
      ac:             null,
      dex_mod:        0,
      initiative:     null,
      conditions:     [],
      is_active_turn: false,
      is_dead:        false,
      notes:          '',
    }

    // ── GM's own character combatant (seat 1) — only if they're playing one ──
    // Treated as a regular PC seat, separate from the GM/monster card (seat 0).
    // Gets seatIndex 1 so they sit first clockwise from the GM card.
    let gmCharacterCombatant = null
    if (gmCharacterId) {
      const gmCharRow = await db.query(
        'SELECT id, character_name, sheet_data FROM characters WHERE id = $1',
        [gmCharacterId]
      )
      if (gmCharRow.rows[0]) {
        const ch = gmCharRow.rows[0]
        const sd = ch.sheet_data ?? {}
        gmCharacterCombatant = {
          id:             crypto.randomUUID(),
          type:           'pc',
          seatIndex:      1,             // first clockwise from GM monsters
          isGMCharacter:  true,          // crown badge on the card
          name:           ch.character_name,
          username:       gmUsername,    // so players know whose char this is
          characterId:    ch.id,
          hp_max:         sd.hp_max     || 10,
          hp_current:     sd.hp_current || sd.hp_max || 10,
          ac:             sd.ac         || 10,
          dex_mod:        sd.dex_mod    || 0,
          initiative:     null,
          conditions:     [],
          is_active_turn: false,
          is_dead:        false,
          notes:          '',
          monsterId:      null,
        }
      }
    }

    // ── PC combatants — members in join order, excluding the GM ──────────────
    // Only active members (left_at IS NULL) who are not the GM, ordered by join time.
    // seatIndex starts at 2 when GM has a character (seat 1), otherwise at 1.
    const seatOffset = gmCharacterCombatant ? 2 : 1
    const members = await db.query(
      `SELECT u.username, ch.id AS character_id, ch.character_name, ch.sheet_data
       FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN characters ch ON ch.id = cm.character_id
       WHERE cm.campaign_id = $1
         AND cm.left_at IS NULL
         AND cm.user_id != $2
       ORDER BY cm.joined_at ASC`,
      [campaignId, req.user.sub]
    )

    const pcCombatants = members.rows.map((m, i) => ({
      id:             crypto.randomUUID(),
      type:           'pc',
      seatIndex:      i + seatOffset,   // 1 or 2 onwards depending on GM char
      name:           m.character_name || m.username,
      username:       m.username,
      characterId:    m.character_id || null,
      hp_max:         m.sheet_data?.hp_max     || 10,
      hp_current:     m.sheet_data?.hp_current || m.sheet_data?.hp_max || 10,
      ac:             m.sheet_data?.ac         || 10,
      dex_mod:        m.sheet_data?.dex_mod    || 0,
      initiative:     null,
      conditions:     [],
      is_active_turn: false,
      is_dead:        false,
      notes:          '',
      monsterId:      null,
    }))

    // ── Monster combatants from encounter (seat 0 — act on GM's turn) ────────
    let monsterCombatants = []
    let encounterName     = null
    let resolvedEncId     = null

    if (encounterId) {
      const encResult = await db.query(
        'SELECT id, name, monsters FROM encounters WHERE id = $1 AND user_id = $2',
        [encounterId, req.user.sub]
      )
      if (!encResult.rows[0]) {
        return res.status(404).json({ error: 'Encounter not found or access denied.' })
      }
      const encounter = encResult.rows[0]
      encounterName   = encounter.name
      resolvedEncId   = encounter.id

      for (const m of encounter.monsters ?? []) {
        const count = m.count || 1
        for (let i = 1; i <= count; i++) {
          monsterCombatants.push({
            id:             crypto.randomUUID(),
            type:           'monster',
            seatIndex:      0,    // same seat as GM
            name:           count > 1 ? `${m.name} #${i}` : m.name,
            hp_current:     m.hp,
            hp_max:         m.maxHp || m.hp,
            ac:             m.ac,
            dex_mod:        m.dexMod || 0,
            initiative:     null,
            conditions:     [],
            is_active_turn: false,
            is_dead:        false,
            notes:          m.notes || '',
            monsterId:      m.monsterId || null,
          })
        }
      }

      await db.query(
        'UPDATE encounters SET times_used = times_used + 1 WHERE id = $1',
        [encounterId]
      )
    }

    // Seating order: GM card (seat 0) → monsters (seat 0, indented under GM card)
    //                → GM character (seat 1, own slot) → players in join order (seat 2+)
    // Monsters MUST precede the GM character so they render visually under the GM
    // card, not under the GM's player character.
    const combatants = [
      gmCard,
      ...monsterCombatants,
      ...(gmCharacterCombatant ? [gmCharacterCombatant] : []),
      ...pcCombatants,
    ]

    const result = await db.query(
      `INSERT INTO combat_sessions
         (campaign_id, round_number, is_active, combatants, encounter_id, encounter_name, phase)
       VALUES ($1, 1, true, $2, $3, $4, 'active')
       RETURNING *`,
      [campaignId, JSON.stringify(combatants), resolvedEncId, encounterName]
    )

    res.status(201).json({ session: result.rows[0] })
  } catch (err) {
    console.error('[combat/start]', err)
    res.status(500).json({ error: 'Failed to start combat.' })
  }
})

// ─── GET /api/combat/:campaignId/active ───────────────────────────────────────
// Returns the active combat session.
// GMs receive the full session; non-GMs have monster HP sanitized.
router.get('/:campaignId/active', requireAuth, async (req, res) => {
  try {
    // Fetch campaign to check GM status
    const campResult = await db.query(
      'SELECT gm_user_id FROM campaigns WHERE id = $1',
      [req.params.campaignId]
    )
    if (!campResult.rows[0]) {
      return res.status(404).json({ error: 'Campaign not found.' })
    }

    const result = await db.query(
      'SELECT * FROM combat_sessions WHERE campaign_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [req.params.campaignId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'No active combat session.' })

    const session  = result.rows[0]
    const isGM     = req.user.sub === campResult.rows[0].gm_user_id

    if (!isGM) {
      session.combatants = sanitizeCombatants(session.combatants)
    }

    res.json({ session })
  } catch (err) {
    console.error('[combat/active]', err)
    res.status(500).json({ error: 'Failed to fetch combat session.' })
  }
})

// ─── PATCH /api/combat/:id ────────────────────────────────────────────────────
// Update combatants array or round number
router.patch('/:id', requireAuth, async (req, res) => {
  const { combatants, round_number, combat_mode } = req.body
  try {
    const session = await db.query('SELECT campaign_id FROM combat_sessions WHERE id = $1', [req.params.id])
    if (!session.rows[0]) return res.status(404).json({ error: 'Session not found.' })
    if (!await assertGM(session.rows[0].campaign_id, req.user.sub, res)) return

    // Validate combat_mode if provided
    const validModes = ['standard', 'legendary', 'mb_pending', 'mb_players', 'mb_enemies']
    const safeMode = combat_mode && validModes.includes(combat_mode) ? combat_mode : null

    const result = await db.query(
      `UPDATE combat_sessions SET
         combatants   = COALESCE($1::jsonb, combatants),
         round_number = COALESCE($2, round_number),
         combat_mode  = COALESCE($3, combat_mode)
       WHERE id = $4 RETURNING *`,
      [
        combatants ? JSON.stringify(combatants.map(sanitizeCombatant).filter(Boolean)) : null,
        round_number || null,
        safeMode,
        req.params.id,
      ]
    )
    res.json({ session: result.rows[0] })
  } catch (err) {
    console.error('[combat/update]', err)
    res.status(500).json({ error: 'Failed to update combat.' })
  }
})

// ─── POST /api/combat/:id/add-gm-character ───────────────────────────────────
// Injects the GM's own character into an active combat session mid-session.
// Used as a fallback if gm_character_id was not set when combat was started.
router.post('/:id/add-gm-character', requireAuth, async (req, res) => {
  try {
    const sessRow = await db.query(
      'SELECT campaign_id, combatants FROM combat_sessions WHERE id = $1 AND is_active = true',
      [req.params.id]
    )
    if (!sessRow.rows[0]) return res.status(404).json({ error: 'Active session not found.' })
    if (!await assertGM(sessRow.rows[0].campaign_id, req.user.sub, res)) return

    const campaignId = sessRow.rows[0].campaign_id
    let combatants   = sessRow.rows[0].combatants ?? []

    // Bail early if GM character already present
    if (combatants.some(c => c.isGMCharacter)) {
      return res.status(409).json({ error: 'GM character already in this session.' })
    }

    // Fetch campaign gm_character_id + gm_username
    const campRow = await db.query(
      `SELECT c.gm_character_id, u.username AS gm_username
       FROM campaigns c JOIN users u ON u.id = c.gm_user_id
       WHERE c.id = $1`,
      [campaignId]
    )
    // Explicit campaign-not-found guard before destructuring — avoids the ?? {} fallback
    // masking a missing campaign row with a misleading "No GM character linked" message.
    if (!campRow.rows[0]) return res.status(404).json({ error: 'Campaign not found.' })
    const { gm_character_id: gmCharacterId, gm_username: gmUsername } = campRow.rows[0]
    if (!gmCharacterId) return res.status(404).json({ error: 'No GM character linked to this campaign. Set one in Campaign Settings.' })

    const charRow = await db.query(
      'SELECT id, character_name, sheet_data FROM characters WHERE id = $1',
      [gmCharacterId]
    )
    if (!charRow.rows[0]) return res.status(404).json({ error: 'GM character not found.' })

    const ch = charRow.rows[0]
    const sd = ch.sheet_data ?? {}

    const gmCombatant = {
      id:            crypto.randomUUID(),
      type:          'pc',
      joinOrder:     0,
      isGMCharacter: true,
      name:          ch.character_name,
      username:      gmUsername,
      characterId:   ch.id,
      hp_max:        sd.hp_max     || 10,
      hp_current:    sd.hp_current || sd.hp_max || 10,
      ac:            calcNimbleAC(sd.armor ?? null, sd.shield ?? null, sd.stats?.dex ?? 0, sd.stats?.str ?? 0, sd.className ?? ''),
      has_gone:      false,
      is_dead:       false,
      conditions:    [],
      notes:         '',
      monsterId:     null,
    }

    // Re-number existing PCs so they don't clash with joinOrder 0
    const updated = [
      gmCombatant,
      ...combatants.map(c => c.type === 'pc' ? { ...c, joinOrder: (c.joinOrder ?? 0) + 1 } : c),
    ]

    const result = await db.query(
      'UPDATE combat_sessions SET combatants = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(updated), req.params.id]
    )
    res.json({ session: result.rows[0] })
  } catch (err) {
    console.error('[combat/add-gm-character]', err)
    res.status(500).json({ error: 'Failed to add GM character.' })
  }
})

// NOTE: PATCH /:id/light-timer has been removed.
// The light timer was migrated to campaign-scoped socket events (push_light_timer in socket.js)
// reading from campaigns.light_timer_* columns. The combat_sessions.light_timer_* columns
// are deprecated — see schema.sql. This REST endpoint was dead from the frontend.

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

// ─── PATCH /api/combat/:sessionId/hp-sync ────────────────────────────────────
// Player-side HP sync from character sheet to the active combat session.
// Any authenticated user can sync HP for their own character.
//
// Body: { characterId: UUID, hpCurrent: number, hpMax: number }
router.patch('/:sessionId/hp-sync', requireAuth, [
  body('characterId').isUUID().withMessage('Valid character ID required.'),
  body('hpCurrent').optional().isNumeric().withMessage('hpCurrent must be a number.'),
  body('hpMax').optional().isNumeric().withMessage('hpMax must be a number.'),
], async (req, res) => {
  if (validationErrors(req, res)) return
  const { characterId, hpCurrent, hpMax } = req.body

  if (hpCurrent === undefined && hpMax === undefined) {
    return res.status(400).json({ error: 'At least one of hpCurrent or hpMax is required.' })
  }

  try {
    // Verify the character belongs to the requesting user
    const charCheck = await db.query(
      'SELECT id FROM characters WHERE id = $1 AND user_id = $2',
      [characterId, req.user.sub]
    )
    if (!charCheck.rows[0]) {
      return res.status(403).json({ error: 'Access denied or character not found.' })
    }

    // Find the active combat session that contains this character as a PC combatant.
    // Use JSONB containment: combatants @> '[{"characterId":"<id>"}]'
    const sessResult = await db.query(
      `SELECT id, combatants FROM combat_sessions
       WHERE is_active = true
         AND combatants @> $1::jsonb
       LIMIT 1`,
      [JSON.stringify([{ characterId }])]
    )
    if (!sessResult.rows[0]) {
      return res.json({ ok: true, noSession: true })
    }

    const sess = sessResult.rows[0]
    const updated = (sess.combatants ?? []).map(c => {
      if (c.characterId !== characterId) return c
      return {
        ...c,
        ...(hpCurrent !== undefined ? { hp_current: Number(hpCurrent) } : {}),
        ...(hpMax     !== undefined ? { hp_max:     Number(hpMax)     } : {}),
      }
    })

    await db.query(
      'UPDATE combat_sessions SET combatants = $1 WHERE id = $2',
      [JSON.stringify(updated), sess.id]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('[combat/hp-sync]', err)
    res.status(500).json({ error: 'Failed to sync HP.' })
  }
})

module.exports = router
