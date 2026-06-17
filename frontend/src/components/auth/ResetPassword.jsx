/**
 * ResetPassword — handles the /reset-password?token=... landing page.
 *
 * The user arrives here by clicking the link in their password-reset email.
 * We extract the token from the URL, show a new-password form, and call
 * POST /api/auth/forgot-password/reset on submit.
 *
 * If the token is missing, expired, or already used, the backend returns 400
 * and we show a clear error with a link back to the recovery flow.
 */

import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import PasswordInput from '../ui/PasswordInput'
import { api } from '../../utils/api'

export default function ResetPassword() {
  const [searchParams]          = useSearchParams()
  const token                   = searchParams.get('token')

  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)

  // ── No token in URL ───────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="text-sm text-codex-subtext">
          This link is missing its reset token. It may have been copied incorrectly.
        </p>
        <Link to="/forgot-password" className="text-codex-gold hover:text-codex-goldHover text-sm transition-colors">
          Request a new reset link →
        </Link>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-codex-gold/10 border border-codex-gold/30 flex items-center justify-center text-2xl">
          ✓
        </div>
        <p className="text-codex-text text-sm font-medium">Password updated successfully.</p>
        <p className="text-xs text-codex-subtext">You can now sign in with your new password.</p>
        <Link to="/" className="text-codex-gold hover:text-codex-goldHover text-sm transition-colors">
          ← Sign in
        </Link>
      </div>
    )
  }

  // ── Reset form ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPass !== confirmPass) { setError('Passwords do not match.'); return }
    if (newPass.length < 8)     { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/reset', {
        token,
        password:        newPass,
        confirmPassword: confirmPass,
      })
      setDone(true)
    } catch (err) {
      // Common case: expired or already-used token
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-codex-subtext text-center">
        Enter a new password for your account.
      </p>

      <PasswordInput
        id="rp-new" label="New Password"
        value={newPass} onChange={e => setNewPass(e.target.value)}
        placeholder="Min. 8 chars, 1 number, 1 symbol"
        autoComplete="new-password"
      />
      <PasswordInput
        id="rp-confirm" label="Confirm New Password"
        value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
        placeholder="Re-enter new password"
        autoComplete="new-password"
      />

      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-400 text-center">{error}</p>
          {/* Expired token? Give them a quick path to re-request */}
          {error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid') ? (
            <Link to="/forgot-password"
              className="text-xs text-codex-gold hover:text-codex-goldHover text-center transition-colors">
              Request a new reset link →
            </Link>
          ) : null}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !newPass || !confirmPass}
        className="w-full py-2.5 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg
          font-semibold text-sm disabled:opacity-50 transition-all"
      >
        {loading ? 'Saving…' : 'Set New Password'}
      </button>

      <Link to="/forgot-password"
        className="text-xs text-codex-subtext hover:text-codex-text transition-colors text-center">
        ← Try a different recovery method
      </Link>
    </form>
  )
}
