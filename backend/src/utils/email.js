/**
 * Email utility — stubs to console in development.
 * Wire up RESEND_API_KEY in .env to send real email.
 */

const FROM    = process.env.EMAIL_FROM   || 'noreply@campaigncodex.com'
const API_KEY = process.env.RESEND_API_KEY
const CLIENT  = process.env.CLIENT_URL   || 'http://localhost:5173'

async function sendPasswordResetEmail(toEmail, resetToken) {
  const link = `${CLIENT}/reset-password?token=${resetToken}`

  if (!API_KEY) {
    // Stub: log to console for homelab dev
    console.log('\n─── PASSWORD RESET EMAIL (stub) ───────────────────')
    console.log(`To:      ${toEmail}`)
    console.log(`Link:    ${link}`)
    console.log('────────────────────────────────────────────────────\n')
    return { ok: true, stub: true }
  }

  // Live: Resend API
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `CampaignCodex <${FROM}>`,
      to:      [toEmail],
      subject: 'Reset your CampaignCodex password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#c9a84c">CampaignCodex</h2>
          <p>A password reset was requested for your account.</p>
          <p>
            <a href="${link}"
               style="display:inline-block;background:#c9a84c;color:#0a0b0f;
                      padding:12px 24px;border-radius:8px;font-weight:600;
                      text-decoration:none">
              Reset Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Resend error: ${JSON.stringify(err)}`)
  }

  return { ok: true }
}

module.exports = { sendPasswordResetEmail }
