import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input from '../ui/Input'
import PasswordInput from '../ui/PasswordInput'

// Format a UTC ISO timestamp into a readable local date/time string
function formatBanExpiry(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

export default function LoginForm() {
  const { login }               = useAuth()
  const navigate                = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [banInfo, setBanInfo]   = useState(null)   // { banReason, bannedUntil, bannedByUsername, isPermanent }
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBanInfo(null)
    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      navigate(user.isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      // Structured ban response — api.js attaches err.data = full JSON body
      if (err.status === 403 && err.data?.error === 'banned') {
        setBanInfo({
          banReason:        err.data.banReason,
          bannedUntil:      err.data.bannedUntil,
          bannedByUsername: err.data.bannedByUsername,
          isPermanent:      err.data.isPermanent,
        })
      } else {
        setError(err.message || 'Sign in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Ban screen ───────────────────────────────────────────────────────────────
  if (banInfo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-xl leading-none mt-0.5">⛔</span>
            <div>
              <p className="text-sm font-semibold text-red-400">Account suspended</p>
              <p className="text-xs text-codex-subtext mt-0.5 leading-relaxed">
                This account has been suspended from CampaignCodex.
              </p>
            </div>
          </div>

          {banInfo.banReason && (
            <div className="bg-codex-bg/60 border border-codex-border rounded-lg px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-codex-muted font-medium mb-1">Reason</p>
              <p className="text-sm text-codex-text leading-relaxed">{banInfo.banReason}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5 text-xs text-codex-subtext">
            {banInfo.isPermanent ? (
              <p className="text-red-400 font-medium">This ban is permanent.</p>
            ) : (
              <p>
                <span className="text-codex-muted">Expires: </span>
                <span className="text-codex-text font-medium">{formatBanExpiry(banInfo.bannedUntil)}</span>
              </p>
            )}
            {banInfo.bannedByUsername && (
              <p>
                <span className="text-codex-muted">Issued by: </span>
                <span className="text-codex-text">@{banInfo.bannedByUsername}</span>
              </p>
            )}
          </div>

          <p className="text-xs text-codex-muted border-t border-codex-border pt-3">
            If you believe this is an error, contact support at{' '}
            <a href="mailto:support@campaigncodex.net" className="text-codex-gold hover:underline">
              support@campaigncodex.net
            </a>
          </p>
        </div>

        <button
          onClick={() => { setBanInfo(null); setUsername(''); setPassword('') }}
          className="text-xs text-codex-subtext hover:text-codex-text transition-colors text-center"
        >
          ← Back to sign in
        </button>
      </div>
    )
  }

  // ── Normal login form ────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Input
        id="username" label="Username"
        value={username} onChange={e => setUsername(e.target.value)}
        placeholder="Enter your username"
        autoComplete="username" required
      />
      <PasswordInput
        id="password" label="Password"
        value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Enter your password"
        autoComplete="current-password"
      />

      {error && <p className="text-sm text-red-400 text-center -mt-1">{error}</p>}

      <button
        type="submit" disabled={loading}
        className="w-full mt-1 py-2.5 px-4 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow hover:shadow-none"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="flex items-center justify-between text-xs text-codex-subtext pt-1">
        <Link to="/forgot-password" className="hover:text-codex-gold transition-colors duration-150">
          Forgot password?
        </Link>
        <Link to="/signup" className="hover:text-codex-gold transition-colors duration-150">
          Create an account →
        </Link>
      </div>
    </form>
  )
}
