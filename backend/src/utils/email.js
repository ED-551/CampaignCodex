/**
 * Email utility — stubs to console in development.
 * Wire up RESEND_API_KEY in .env to send real email.
 */

const FROM    = process.env.EMAIL_FROM   || 'noreply@campaigncodex.com'
const API_KEY = process.env.RESEND_API_KEY
const CLIENT  = process.env.CLIENT_URL   || 'http://localhost:5173'

// Shared HTML shell for all outbound emails
function wrapHtml(inner) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;
                background:#0f1117;color:#e2e8f0;padding:32px 24px;border-radius:12px">
      <div style="border-bottom:1px solid #2d3748;padding-bottom:16px;margin-bottom:24px">
        <h1 style="color:#c9a84c;font-size:20px;margin:0;font-weight:700;letter-spacing:0.05em">
          CampaignCodex
        </h1>
      </div>
      <div style="line-height:1.7;color:#e2e8f0;font-size:15px">
        ${inner}
      </div>
      <div style="border-top:1px solid #2d3748;padding-top:16px;margin-top:32px;
                  font-size:12px;color:#6b7280;line-height:1.5">
        You're receiving this because you opted in to the CampaignCodex newsletter.<br>
        To unsubscribe, sign in and update your notification preferences in account settings.
      </div>
    </div>
  `
}

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

  const html = wrapHtml(`
    <p>A password reset was requested for your account.</p>
    <p>
      <a href="${link}"
         style="display:inline-block;background:#c9a84c;color:#0a0b0f;
                padding:12px 24px;border-radius:8px;font-weight:600;
                text-decoration:none">
        Reset Password
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280">
      This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
  `)

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
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Resend error: ${JSON.stringify(err)}`)
  }

  return { ok: true }
}

/**
 * Send a broadcast email to a list of opted-in newsletter subscribers.
 * Uses Resend's batch API (up to 100 per request) for efficiency.
 * Falls back to console stub when RESEND_API_KEY is unset.
 *
 * @param {Array<{email:string, username:string}>} recipients
 * @param {string} subject
 * @param {string} plainBody — Admin's plain-text message (newlines → <p> tags)
 * @returns {Promise<{sent:number, failed:number, stub:boolean}>}
 */
async function sendBroadcastEmail(recipients, subject, plainBody) {
  // Escape HTML entities and convert newlines to paragraphs
  const escaped = plainBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const htmlBody = escaped
    .split('\n')
    .map(line => line.trim()
      ? `<p style="margin:0 0 14px">${line}</p>`
      : '<p style="margin:0 0 14px">&nbsp;</p>')
    .join('\n')

  const html = wrapHtml(htmlBody)

  if (!API_KEY) {
    console.log('\n─── BROADCAST EMAIL (stub) ─────────────────────────')
    console.log(`Subject:    ${subject}`)
    console.log(`Recipients: ${recipients.length}`)
    recipients.slice(0, 5).forEach(r => console.log(`  → ${r.email} (${r.username})`))
    if (recipients.length > 5) console.log(`  … and ${recipients.length - 5} more`)
    console.log('────────────────────────────────────────────────────\n')
    return { sent: recipients.length, failed: 0, stub: true }
  }

  // Chunk into groups of 100 (Resend batch API limit)
  const CHUNK_SIZE = 100
  let sent   = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE)
    const batch = chunk.map(r => ({
      from:    `CampaignCodex <${FROM}>`,
      to:      [r.email],
      subject,
      html,
    }))

    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(batch),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[broadcast] Resend batch error:', err)
        failed += chunk.length
      } else {
        sent += chunk.length
      }
    } catch (err) {
      console.error('[broadcast] Network error on batch:', err.message)
      failed += chunk.length
    }
  }

  return { sent, failed, stub: false }
}

module.exports = { sendPasswordResetEmail, sendBroadcastEmail }
