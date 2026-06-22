const express  = require('express')
const bcrypt   = require('bcrypt')
const crypto   = require('crypto')
const { body, validationResult } = require('express-validator')
const db       = require('../db')
const { signToken }              = require('../utils/jwt')
const { sendPasswordResetEmail, sendUsernameReminderEmail, sendVerificationEmail } = require('../utils/email')
const { authLimiter, signupLimiter } = require('../middleware/rateLimiter')
const { requireAuth }            = require('../middleware/auth')

const router = express.Router()

const SALT_ROUNDS = 12

// ─── Disposable email domain blocklist ───────────────────────────────────────
// Common throwaway / spam-inbox services. Extend as needed.
// We reject at signup to keep the user base reachable for password recovery.
const BLOCKED_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'sharklasers.com', 'grr.la', 'spam4.me', 'trashmail.com', 'trashmail.me',
  'trashmail.at', 'trashmail.io', 'trashmail.net', 'fakeinbox.com', 'yopmail.com',
  'dispostable.com', 'mailnull.com', 'spamgourmet.com', 'maildrop.cc',
  'discard.email', 'dodgit.com', 'spamex.com', 'mailexpire.com', 'spamfree24.org',
  'spammotel.com', 'weg-werf-email.de', 'mailnesia.com', 'tempinbox.com',
  'tempr.email', 'disposablemail.com', 'throwaway.email', 'tempmail.com',
  'throwam.com', 'spamzilla.net',
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

// Tier limits — 'black' is admin-only, grant admin-equivalent limits
const TIER_SHEET_LIMIT    = { free: 10, bronze: 30, silver: 30, gold: 30, platinum: 30, black: 30 }
const TIER_CAMPAIGN_LIMIT = { free: 6,  bronze: 12, silver: 12, gold: 12, platinum: 12, black: 12 }

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post('/signup', authLimiter, signupLimiter, [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters.')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers, and underscores.'),
  body('email')
    .trim().normalizeEmail()
    .isEmail().withMessage('Please enter a valid email address.'),
  body('firstName')
    .trim().notEmpty().withMessage('First name is required.')
    .isLength({ max: 50 }),
  body('lastName')
    .trim().notEmpty().withMessage('Last name is required.')
    .isLength({ max: 50 }),
  body('middleInitial')
    .optional({ checkFalsy: true })
    .isLength({ max: 1 }).withMessage('Middle initial must be a single character.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/\d/).withMessage('Password must contain at least one number.')
    .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character.'),
  body('confirmPassword')
    .custom((val, { req }) => val === req.body.password)
    .withMessage('Passwords do not match.'),
  body('agreedToTerms')
    .custom(val => val === true || val === 'true')
    .withMessage('You must accept the Terms & Conditions to create an account.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  // Honeypot check — the _hp field is hidden from real users via CSS.
  // If it's filled, a bot almost certainly submitted the form.
  // We return a plausible 201 to avoid tipping off the bot that it was detected.
  if (req.body._hp && req.body._hp.trim() !== '') {
    return res.status(201).json({ token: 'ok', user: {} })
  }

  const { username, email, firstName, lastName, middleInitial,
          password, newsletterOptIn } = req.body

  // Reject disposable/throwaway email domains
  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (emailDomain && BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
    return res.status(400).json({ error: 'Please use a permanent email address to sign up.' })
  }

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Check uniqueness
    const existing = await client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email]
    )
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Username or email is already taken.' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const result = await client.query(
      `INSERT INTO users
         (username, email, first_name, last_name, middle_initial,
          password_hash, newsletter_opt_in, terms_accepted_at, email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),false)
       RETURNING id, username, email, first_name, last_name,
                 supporter_tier, is_admin, is_moderator, newsletter_opt_in, token_version, created_at`,
      [username, email, firstName, lastName, middleInitial || null,
       passwordHash,
       newsletterOptIn === true || newsletterOptIn === 'true']
    )

    const user = result.rows[0]

    // Generate a verification token and email it — no JWT issued until verified
    const rawToken  = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await client.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
      [user.id, tokenHash, expiresAt]
    )

    // Send email before committing — if delivery fails, roll back so no ghost
    // account is left in an unverifiable state.
    await sendVerificationEmail(user.email, rawToken)

    await client.query('COMMIT')

    res.status(201).json({ pending: true, email: user.email })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[signup]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  } finally {
    client.release()
  }
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { username, password } = req.body

  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name,
              u.password_hash, u.supporter_tier, u.is_admin, u.is_moderator,
              u.is_banned, u.banned_at, u.ban_reason, u.banned_until,
              u.token_version, u.email_verified, u.created_at,
              b.username AS banned_by_username
       FROM users u
       LEFT JOIN users b ON b.id = u.banned_by_id
       WHERE u.username = $1 LIMIT 1`,
      [username]
    )

    const user = result.rows[0]

    // Always run bcrypt even if user not found — prevents timing attacks
    const fakeHash   = '$2b$12$invalidhashusedfortimingprotection00000000000000000000000'
    const hashToTest = user ? user.password_hash : fakeHash
    const valid      = await bcrypt.compare(password, hashToTest)

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    // Hard gate: unverified users cannot log in
    if (!user.email_verified) {
      return res.status(403).json({
        error:            'email_not_verified',
        email:            user.email,
      })
    }

    // Check if user is banned (after password verify — don't reveal account existence)
    if (user.is_banned) {
      const now = new Date()
      const bannedUntil = user.banned_until ? new Date(user.banned_until) : null

      // Auto-lift expired timed bans
      if (bannedUntil && bannedUntil <= now) {
        // Fire-and-forget: clear ban fields asynchronously
        db.query(
          `UPDATE users SET is_banned = false, banned_at = null,
           ban_reason = null, banned_by_id = null, banned_until = null
           WHERE id = $1`,
          [user.id]
        ).catch(e => console.error('[login] auto-unban failed', e))
        // Fall through and allow login
      } else {
        // Active ban — return detailed rejection
        return res.status(403).json({
          error:            'banned',
          banReason:        user.ban_reason ?? null,
          bannedUntil:      bannedUntil ? bannedUntil.toISOString() : null,
          bannedByUsername: user.banned_by_username ?? null,
          isPermanent:      bannedUntil === null,
        })
      }
    }

    const token = signToken(user)
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    console.error('[login]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, first_name, last_name,
              supporter_tier, supporter_since, is_admin, is_moderator, newsletter_opt_in, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: sanitizeUser(result.rows[0]) })
  } catch (err) {
    console.error('[me]', err)
    res.status(500).json({ error: 'An error occurred.' })
  }
})

// ─── PATCH /api/auth/settings ─────────────────────────────────────────────────
// Update profile fields: firstName, lastName, email, newsletterOptIn
router.patch('/settings', requireAuth, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be blank.')
    .isLength({ max: 50 }),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be blank.')
    .isLength({ max: 50 }),
  body('email').optional().trim().normalizeEmail()
    .isEmail().withMessage('Please enter a valid email address.'),
  body('newsletterOptIn').optional().isBoolean().withMessage('Invalid newsletter preference.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { firstName, lastName, email, newsletterOptIn } = req.body
  const userId = req.user.sub

  try {
    // Check email uniqueness if changing
    if (email) {
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1',
        [email, userId]
      )
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'That email address is already in use.' })
      }
    }

    const result = await db.query(
      `UPDATE users SET
         first_name        = COALESCE($1, first_name),
         last_name         = COALESCE($2, last_name),
         email             = COALESCE($3, email),
         newsletter_opt_in = COALESCE($4, newsletter_opt_in)
       WHERE id = $5
       RETURNING id, username, email, first_name, last_name,
                 supporter_tier, supporter_since, is_admin, newsletter_opt_in, created_at`,
      [
        firstName ?? null,
        lastName  ?? null,
        email     ?? null,
        newsletterOptIn !== undefined ? newsletterOptIn : null,
        userId,
      ]
    )

    res.json({ user: sanitizeUser(result.rows[0]) })
  } catch (err) {
    console.error('[settings]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── PATCH /api/auth/change-password ──────────────────────────────────────────
router.patch('/change-password', requireAuth, [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
    .matches(/\d/).withMessage('New password must contain at least one number.')
    .matches(/[^a-zA-Z0-9]/).withMessage('New password must contain at least one special character.'),
  body('confirmPassword')
    .custom((val, { req }) => val === req.body.newPassword)
    .withMessage('Passwords do not match.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { currentPassword, newPassword } = req.body

  try {
    const result = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1',
      [req.user.sub]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found.' })

    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' })

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    // Bump token_version to immediately invalidate all previously issued JWTs
    await db.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
      [newHash, user.id]
    )

    res.json({ message: 'Password updated successfully.' })
  } catch (err) {
    console.error('[change-password]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── POST /api/auth/forgot-username ──────────────────────────────────────────
// Looks up the username by email and sends a reminder.
// Always returns 200 — never reveals whether the email is registered.
router.post('/forgot-username', authLimiter, [
  body('email')
    .trim().normalizeEmail()
    .isEmail().withMessage('Please enter a valid email address.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  try {
    const result = await db.query(
      'SELECT username FROM users WHERE email = $1 AND is_admin = false LIMIT 1',
      [req.body.email]
    )

    if (result.rows[0]) {
      await sendUsernameReminderEmail(req.body.email, result.rows[0].username)
    }

    // Always identical response — caller cannot infer whether email was found
    res.json({ message: 'If that email is registered, your username has been sent to it.' })
  } catch (err) {
    console.error('[forgot-username]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── POST /api/auth/forgot-password/request-email ────────────────────────────
router.post('/forgot-password/request-email', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  try {
    const result = await db.query(
      'SELECT id, email FROM users WHERE username = $1 LIMIT 1',
      [req.body.username]
    )

    // Always return 200 — don't reveal if username exists
    if (!result.rows[0]) {
      return res.json({ message: 'If that account exists, a reset link has been sent.' })
    }

    const user      = result.rows[0]
    const rawToken  = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Invalidate any existing tokens for this user
    await db.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1',
      [user.id]
    )

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
      [user.id, tokenHash, expiresAt]
    )

    await sendPasswordResetEmail(user.email, rawToken)

    res.json({ message: 'If that account exists, a reset link has been sent.' })
  } catch (err) {
    console.error('[forgot-password/email]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── POST /api/auth/forgot-password/reset ────────────────────────────────────
router.post('/forgot-password/reset', authLimiter, [
  body('token').notEmpty().withMessage('Reset token is required.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/\d/).withMessage('Password must contain at least one number.')
    .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character.'),
  body('confirmPassword')
    .custom((val, { req }) => val === req.body.password)
    .withMessage('Passwords do not match.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  const { token, password } = req.body
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  try {
    const result = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1 LIMIT 1`,
      [tokenHash]
    )

    const tokenRow = result.rows[0]
    if (!tokenRow || tokenRow.used || new Date(tokenRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Bump token_version alongside the hash — invalidates all prior sessions
    await Promise.all([
      db.query(
        'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
        [passwordHash, tokenRow.user_id]
      ),
      db.query(
        'UPDATE password_reset_tokens SET used = true WHERE id = $1',
        [tokenRow.id]
      ),
    ])

    res.json({ message: 'Password updated successfully.' })
  } catch (err) {
    console.error('[forgot-password/reset]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
// Self-service account deletion. Admins cannot delete themselves this way.
router.delete('/account', requireAuth, [
  body('password').notEmpty().withMessage('Password confirmation is required.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  try {
    const result = await db.query(
      'SELECT id, password_hash, is_admin FROM users WHERE id = $1 LIMIT 1',
      [req.user.sub]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (user.is_admin) {
      return res.status(403).json({ error: 'Administrator accounts cannot be self-deleted. Contact another admin.' })
    }

    const valid = await bcrypt.compare(req.body.password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' })

    // CASCADE in schema handles characters, campaign_members, campaigns, combat_sessions
    await db.query('DELETE FROM users WHERE id = $1', [user.id])

    res.json({ message: 'Account permanently deleted.' })
  } catch (err) {
    console.error('[delete-account]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── GET /api/auth/verify-email?token=... ─────────────────────────────────────
// Called by the frontend when the user clicks the link in the verification email.
// On success: marks user verified, deletes token, issues JWT (auto-login).
router.get('/verify-email', async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Verification token is required.' })

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  try {
    const tokenResult = await db.query(
      `SELECT evt.id, evt.user_id, evt.expires_at, evt.used
       FROM email_verification_tokens evt
       WHERE evt.token_hash = $1 LIMIT 1`,
      [tokenHash]
    )

    const row = tokenResult.rows[0]
    if (!row || row.used || new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This verification link is invalid or has expired.' })
    }

    // Mark token used and user verified atomically
    await Promise.all([
      db.query('UPDATE email_verification_tokens SET used = true WHERE id = $1', [row.id]),
      db.query('UPDATE users SET email_verified = true WHERE id = $1', [row.user_id]),
    ])

    // Fetch user and issue JWT — auto-login after verification
    const userResult = await db.query(
      `SELECT id, username, email, first_name, last_name,
              supporter_tier, is_admin, is_moderator, newsletter_opt_in, token_version, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [row.user_id]
    )

    const user  = userResult.rows[0]
    const jwtToken = signToken(user)

    res.json({ token: jwtToken, user: sanitizeUser(user) })
  } catch (err) {
    console.error('[verify-email]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
// Lets an unverified user request a fresh verification email.
// Rate-limited; always returns 200 to prevent username enumeration.
router.post('/resend-verification', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required.'),
], async (req, res) => {
  if (validationErrors(req, res)) return

  try {
    const result = await db.query(
      'SELECT id, email, email_verified FROM users WHERE username = $1 LIMIT 1',
      [req.body.username]
    )

    const user = result.rows[0]

    // Silently do nothing if user not found or already verified
    if (user && !user.email_verified) {
      // Invalidate old tokens
      await db.query(
        'UPDATE email_verification_tokens SET used = true WHERE user_id = $1',
        [user.id]
      )

      const rawToken  = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await db.query(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
        [user.id, tokenHash, expiresAt]
      )

      await sendVerificationEmail(user.email, rawToken)
    }

    res.json({ message: 'If that account exists and is unverified, a new link has been sent.' })
  } catch (err) {
    console.error('[resend-verification]', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

// ─── Utility ──────────────────────────────────────────────────────────────────
function sanitizeUser(user) {
  return {
    id:               user.id,
    username:         user.username,
    email:            user.email,
    firstName:        user.first_name,
    lastName:         user.last_name,
    supporterTier:    user.supporter_tier,
    supporterSince:   user.supporter_since,
    isAdmin:          user.is_admin    ?? false,
    isModerator:      user.is_moderator ?? false,
    newsletterOptIn:  user.newsletter_opt_in ?? false,
    createdAt:        user.created_at,
    sheetLimit:       TIER_SHEET_LIMIT[user.supporter_tier]    ?? 10,
    campaignLimit:    TIER_CAMPAIGN_LIMIT[user.supporter_tier] ?? 6,
  }
}

module.exports = router
