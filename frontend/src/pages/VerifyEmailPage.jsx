import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { setToken } from '../utils/api'
import { useAuth } from '../context/AuthContext'

/**
 * /verify-email?token=...
 *
 * Automatically processes the verification token from the email link.
 * On success: stores JWT, updates auth context, redirects to dashboard.
 * On failure: shows error with a resend option.
 */
export default function VerifyEmailPage() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()
  const { login: _login, signup: _signup, ...auth } = useAuth()

  const [status, setStatus]           = useState('verifying') // verifying | success | error
  const [errorMsg, setErrorMsg]       = useState('')
  const [username, setUsername]       = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg]     = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setErrorMsg('No verification token found. Make sure you opened the full link from your email.')
      setStatus('error')
      return
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then(data => {
        // Auto-login: store the JWT and reload auth state
        setToken(data.token)
        // Give the context a moment to pick up the new token, then redirect
        setStatus('success')
        setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
      })
      .catch(err => {
        setErrorMsg(err.message || 'This verification link is invalid or has expired.')
        setStatus('error')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResend() {
    if (!username.trim()) return
    setResendLoading(true)
    setResendMsg('')
    try {
      await api.post('/auth/resend-verification', { username: username.trim() })
      setResendMsg('A new verification link has been sent. Check your inbox.')
    } catch {
      setResendMsg('Could not resend. Please try again in a moment.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-codex-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-codex-gold tracking-wide">CampaignCodex</h1>
        </div>

        {/* Verifying */}
        {status === 'verifying' && (
          <div className="rounded-xl border border-codex-border bg-codex-surface p-8 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-codex-gold/30 border-t-codex-gold rounded-full animate-spin" />
            <p className="text-sm text-codex-subtext">Verifying your email…</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 flex flex-col items-center gap-4 text-center">
            <span className="text-4xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-400">Email verified!</p>
              <p className="text-xs text-codex-subtext mt-1">
                Taking you to your dashboard…
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-red-400">Verification failed</p>
                  <p className="text-xs text-codex-subtext mt-0.5 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs text-codex-muted text-center">
                Enter your username to get a fresh link:
              </p>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your username"
                className="w-full bg-codex-surface border border-codex-border rounded-lg px-4 py-2.5 text-codex-text placeholder-codex-muted text-sm focus:outline-none focus:ring-1 focus:border-codex-gold focus:ring-codex-gold/30 transition-colors"
              />
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || !username.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>

              {resendMsg && (
                <p className="text-xs text-center text-codex-gold">{resendMsg}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="text-xs text-codex-subtext hover:text-codex-text transition-colors text-center"
            >
              ← Back to sign in
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
