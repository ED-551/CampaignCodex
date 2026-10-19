import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Mail } from 'lucide-react'
import { api } from '../utils/api'
import { useServerInfo } from '../hooks/useServerInfo'

export default function VerifyEmailPendingPage() {
  const location = useLocation()
  const navigate  = useNavigate()

  const email    = location.state?.email    || ''
  const username = location.state?.username || ''

  // With verification off this server sends no links, so an account that is
  // still unverified (created before the switch) can only be verified by an
  // admin. Show that instead of "check your inbox".
  const { emailVerificationRequired } = useServerInfo()

  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg,     setResendMsg]     = useState('')

  async function handleResend() {
    if (!username) return
    setResendLoading(true)
    setResendMsg('')
    try {
      await api.post('/auth/resend-verification', { username })
      setResendMsg('A new verification link has been sent — check your inbox.')
    } catch {
      setResendMsg('Could not resend. Please try again in a moment.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-codex-bg flex items-center justify-center p-4">
      <Helmet><title>Verify Your Email — CampaignCodex</title></Helmet>

      <div className="w-full max-w-md flex flex-col gap-6">

        {/* Wordmark */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-codex-gold tracking-wide">CampaignCodex</h1>
        </div>

        {/* Verification off: nothing will arrive by email */}
        {!emailVerificationRequired && (
          <div className="rounded-xl border border-codex-border bg-codex-surface p-8 flex flex-col gap-4 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-codex-gold/10 border border-codex-gold/30 flex items-center justify-center">
              <Mail className="w-7 h-7 text-codex-gold" />
            </div>
            <h2 className="text-lg font-semibold text-codex-text">Account not verified yet</h2>
            <p className="text-sm text-codex-subtext leading-relaxed">
              This server doesn't send verification emails. Ask the server's admin to
              verify your account from the Admin dashboard, then sign in again.
            </p>
          </div>
        )}

        {/* Main card */}
        {emailVerificationRequired && (
        <div className="rounded-xl border border-codex-border bg-codex-surface p-8 flex flex-col gap-6">

          {/* Icon + heading */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-codex-gold/10 border border-codex-gold/30 flex items-center justify-center">
              <Mail className="w-7 h-7 text-codex-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-codex-text">Almost there!</h2>
              <p className="text-sm text-codex-subtext mt-1">
                One last step before you get started.
              </p>
              {email && (
                <p className="text-sm text-codex-subtext mt-0.5">
                  We sent a verification link to{' '}
                  <span className="text-codex-text font-medium">{email}</span>
                </p>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="flex flex-col gap-3 text-sm text-codex-subtext leading-relaxed">
            <p>
              Go ahead and check your inbox — there should be a message from us waiting for
              you. Click the link inside to verify your account and you're all set.
            </p>
            <p>
              The link expires in <span className="text-codex-text">24 hours</span>. If you
              don't see it, check your spam or junk folder just in case.
            </p>
          </div>

          {/* Why we do this */}
          <div className="rounded-lg bg-codex-bg border border-codex-border px-4 py-3">
            <p className="text-xs text-codex-muted leading-relaxed">
              <span className="text-codex-subtext font-medium">Why do we require this?</span>{' '}
              Email verification helps us prevent spam accounts and protect the CampaignCodex
              community — keeping the platform safe and welcoming for every adventurer.
            </p>
          </div>

          {/* Resend */}
          {username && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="w-full py-2.5 px-4 rounded-lg border border-codex-border text-codex-subtext hover:text-codex-text hover:border-codex-gold/50 text-sm font-medium transition-all duration-150 disabled:opacity-50"
              >
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendMsg && (
                <p className="text-xs text-center text-codex-gold">{resendMsg}</p>
              )}
            </div>
          )}

          {/* Sign-off */}
          <p className="text-xs text-codex-muted text-center leading-relaxed pt-1 border-t border-codex-border">
            Thank you for joining us.<br />
            <span className="text-codex-subtext font-medium">— The CampaignCodex Team</span>
          </p>

        </div>
        )}

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="text-xs text-codex-subtext hover:text-codex-text transition-colors text-center"
        >
          ← Back to sign in
        </button>

      </div>
    </div>
  )
}
