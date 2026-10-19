/**
 * Email delivery settings, read once from the environment at startup.
 *
 * Provider order:
 *   1. Resend  — when RESEND_API_KEY is set
 *   2. SMTP    — when SMTP_HOST is set
 *   3. console — neither set; emails (including links) are printed to the log
 *
 * REQUIRE_EMAIL_VERIFICATION = true | false | auto (default auto).
 * auto means verification is required only when Resend or SMTP is configured,
 * so a self-hosted instance with no mail set up lets people sign straight in.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const SMTP_HOST      = process.env.SMTP_HOST || ''

const EMAIL_MODE = RESEND_API_KEY ? 'resend' : SMTP_HOST ? 'smtp' : 'console'

const SMTP_PORT   = parseInt(process.env.SMTP_PORT || '587', 10)
// Port 465 speaks TLS from the first byte; other ports upgrade with STARTTLS.
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true'
  : SMTP_PORT === 465

const SMTP = {
  host:   SMTP_HOST,
  port:   SMTP_PORT,
  secure: SMTP_SECURE,
  user:   process.env.SMTP_USER || '',
  pass:   process.env.SMTP_PASS || '',
}

const rawRequire = (process.env.REQUIRE_EMAIL_VERIFICATION || 'auto').trim().toLowerCase()
const VERIFICATION_SETTING = ['true', 'false', 'auto'].includes(rawRequire) ? rawRequire : 'auto'
const VERIFICATION_SETTING_INVALID = rawRequire !== VERIFICATION_SETTING

const EMAIL_CONFIGURED = EMAIL_MODE !== 'console'

const EMAIL_VERIFICATION_REQUIRED =
  VERIFICATION_SETTING === 'true'  ? true  :
  VERIFICATION_SETTING === 'false' ? false :
  EMAIL_CONFIGURED

module.exports = {
  EMAIL_MODE,
  EMAIL_CONFIGURED,
  EMAIL_VERIFICATION_REQUIRED,
  VERIFICATION_SETTING,
  VERIFICATION_SETTING_INVALID,
  RESEND_API_KEY,
  SMTP,
}
