import { useState } from 'react'
import { Link } from 'react-router-dom'
import Input from '../ui/Input'
import PasswordInput from '../ui/PasswordInput'
import { api } from '../../utils/api'

const STEPS = {
  CHOOSE:    'choose',
  EMAIL:     'email',
  QUESTIONS: 'questions',
  RESET:     'reset',
  DONE:      'done',
}

const INPUT_CLASS = `w-full bg-codex-surface border border-codex-border rounded-lg px-4 py-2.5
  text-codex-text placeholder-codex-muted text-sm
  focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
  transition-colors`

export default function ForgotPassword() {
  const [step,           setStep]           = useState(STEPS.CHOOSE)
  const [recoveryMethod, setRecoveryMethod] = useState(null)   // 'email' | 'questions'
  const [username,       setUsername]       = useState('')
  const [answer1,  setAnswer1]  = useState('')
  const [answer2,  setAnswer2]  = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // ── Email recovery ────────────────────────────────────────────────────────────
  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    const un = username.trim()
    if (!un) { setError('Please enter your username.'); return }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/request-email', { username: un })
      setRecoveryMethod('email')
      setStep(STEPS.DONE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Security questions recovery ───────────────────────────────────────────────
  async function handleQuestionsSubmit(e) {
    e.preventDefault()
    setError('')
    const un = username.trim()
    if (!un)                    { setError('Please enter your username.'); return }
    if (!answer1.trim())        { setError('Please answer the first question.'); return }
    if (!answer2.trim())        { setError('Please answer the second question.'); return }
    setLoading(true)
    try {
      const { resetToken: token } = await api.post('/auth/forgot-password/verify-answers', {
        username: un,
        answer1:  answer1.trim(),
        answer2:  answer2.trim(),
      })
      setResetToken(token)
      setStep(STEPS.RESET)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Set new password ──────────────────────────────────────────────────────────
  async function handleResetSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPass !== confirmPass) { setError('Passwords do not match.'); return }
    if (newPass.length < 8)     { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/reset', {
        token:           resetToken,
        password:        newPass,
        confirmPassword: confirmPass,
      })
      setRecoveryMethod('questions')
      setStep(STEPS.DONE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (step === STEPS.DONE) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-codex-gold/10 border border-codex-gold/30 flex items-center justify-center text-2xl">
          ✓
        </div>
        <p className="text-codex-text text-sm">
          {recoveryMethod === 'email'
            ? 'If that account exists, a reset link has been sent to your email. Check your inbox (and spam folder).'
            : 'Your password has been updated successfully.'}
        </p>
        <Link to="/" className="text-codex-gold hover:text-codex-goldHover text-sm transition-colors">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  // ── Set new password (after security-question verification) ───────────────────
  if (step === STEPS.RESET) {
    return (
      <form onSubmit={handleResetSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-codex-subtext">Set your new password.</p>
        <PasswordInput
          id="new-pass" label="New Password"
          value={newPass} onChange={e => setNewPass(e.target.value)}
          placeholder="Min. 8 chars, 1 number, 1 symbol" autoComplete="new-password"
        />
        <PasswordInput
          id="confirm-pass" label="Confirm New Password"
          value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
          placeholder="Re-enter new password" autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm disabled:opacity-50 transition-all">
          {loading ? 'Saving…' : 'Set New Password'}
        </button>
      </form>
    )
  }

  // ── Security questions step ───────────────────────────────────────────────────
  if (step === STEPS.QUESTIONS) {
    return (
      <form onSubmit={handleQuestionsSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          id="fq-username" label="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Your username"
          required
        />
        <p className="text-xs text-codex-muted -mt-2 leading-relaxed">
          Enter the answers to the two security questions you chose when you signed up.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">Security Question 1</label>
          <input
            type="text"
            value={answer1}
            onChange={e => setAnswer1(e.target.value)}
            placeholder="Your answer to question 1"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">Security Question 2</label>
          <input
            type="text"
            value={answer2}
            onChange={e => setAnswer2(e.target.value)}
            placeholder="Your answer to question 2"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </div>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm disabled:opacity-50 transition-all">
          {loading ? 'Verifying…' : 'Verify Answers'}
        </button>
        <button type="button" onClick={() => { setError(''); setStep(STEPS.CHOOSE) }}
          className="text-xs text-codex-subtext hover:text-codex-text transition-colors text-center">
          ← Other options
        </button>
      </form>
    )
  }

  // ── Email link step ───────────────────────────────────────────────────────────
  if (step === STEPS.EMAIL) {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-codex-subtext">
          Enter your username and we'll send a reset link to the email on your account.
        </p>
        <Input
          id="fe-username" label="Username"
          value={username} onChange={e => setUsername(e.target.value)}
          placeholder="Your username" required
        />
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm disabled:opacity-50 transition-all">
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
        <button type="button" onClick={() => { setError(''); setStep(STEPS.CHOOSE) }}
          className="text-xs text-codex-subtext hover:text-codex-text transition-colors text-center">
          ← Other options
        </button>
      </form>
    )
  }

  // ── Choose recovery method ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-codex-subtext text-center">
        How would you like to recover your account?
      </p>
      <button
        onClick={() => { setError(''); setStep(STEPS.EMAIL) }}
        className="w-full py-3 px-4 rounded-lg border border-codex-border bg-codex-surface
          hover:border-codex-gold hover:bg-codex-card text-codex-text text-sm font-medium text-left
          transition-all duration-150 group"
      >
        <span className="block font-semibold text-codex-text group-hover:text-codex-gold transition-colors">
          📧 Send me a reset link
        </span>
        <span className="text-xs text-codex-subtext">
          We'll email a link to the address on your account
        </span>
      </button>
      <button
        onClick={() => { setError(''); setStep(STEPS.QUESTIONS) }}
        className="w-full py-3 px-4 rounded-lg border border-codex-border bg-codex-surface
          hover:border-codex-gold hover:bg-codex-card text-codex-text text-sm font-medium text-left
          transition-all duration-150 group"
      >
        <span className="block font-semibold text-codex-text group-hover:text-codex-gold transition-colors">
          🔐 Answer my security questions
        </span>
        <span className="text-xs text-codex-subtext">
          Answer the two questions you set during sign-up
        </span>
      </button>
      <Link to="/" className="text-center text-xs text-codex-subtext hover:text-codex-text transition-colors mt-1">
        ← Back to sign in
      </Link>
    </div>
  )
}
