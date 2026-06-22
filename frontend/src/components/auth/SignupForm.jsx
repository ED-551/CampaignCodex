import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input from '../ui/Input'
import PasswordInput from '../ui/PasswordInput'
import { ExternalLink } from 'lucide-react'

// Base input classes reused for the inline name-row inputs
const INPUT_BASE = `w-full bg-codex-surface border rounded-lg px-4 py-2.5 text-codex-text placeholder-codex-muted text-sm focus:outline-none focus:ring-1 transition-colors duration-150`
const INPUT_OK   = `${INPUT_BASE} border-codex-border focus:border-codex-gold focus:ring-codex-gold/30`
const INPUT_ERR  = `${INPUT_BASE} border-red-500/70 focus:border-red-500 focus:ring-red-500/30`

// ─── Per-field validation (mirrors backend rules exactly) ─────────────────────
function validateField(name, value, allValues) {
  switch (name) {
    case 'firstName':
      return value.trim() ? '' : 'First name is required.'
    case 'lastName':
      return value.trim() ? '' : 'Last name is required.'
    case 'username':
      if (!value.trim()) return 'Username is required.'
      if (value.length < 3 || value.length > 20) return 'Must be 3–20 characters.'
      if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Letters, numbers, and underscores only.'
      return ''
    case 'email':
      if (!value.trim()) return 'Email address is required.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.'
      return ''
    case 'password':
      if (!value) return 'Password is required.'
      if (value.length < 8) return 'Must be at least 8 characters.'
      if (!/\d/.test(value)) return 'Must contain at least one number.'
      if (!/[^a-zA-Z0-9]/.test(value)) return 'Must contain at least one special character.'
      return ''
    case 'confirmPassword':
      if (!value) return 'Please confirm your password.'
      if (value !== (allValues?.password ?? '')) return 'Passwords do not match.'
      return ''
    default:
      return ''
  }
}

const VALIDATED_FIELDS = ['firstName', 'lastName', 'username', 'email', 'password', 'confirmPassword']

export default function SignupForm() {
  const { signup }  = useAuth()
  const navigate    = useNavigate()

  const [form, setForm] = useState({
    username: '', email: '', firstName: '', lastName: '', middleInitial: '',
    password: '', confirmPassword: '',
    agreedToTerms:   false,
    newsletterOptIn: false,
    _hp: '',   // honeypot — real users never fill this; bots usually do
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  // Generic field setter — clears the field's inline error as soon as the user
  // starts correcting, and re-validates confirmPassword live when password changes.
  function set(field) {
    return e => {
      const val = e.target.value
      setForm(prev => {
        const next = { ...prev, [field]: val }
        // Keep confirmPassword error in sync if user is editing password
        if (field === 'password' && fieldErrors.confirmPassword) {
          const err = validateField('confirmPassword', next.confirmPassword, next)
          setFieldErrors(fe => ({ ...fe, confirmPassword: err }))
        }
        return next
      })
      if (fieldErrors[field]) {
        setFieldErrors(fe => ({ ...fe, [field]: '' }))
      }
    }
  }

  // Validate on blur — fires when the user tabs or clicks away from a field
  function handleBlur(field) {
    return () => {
      const err = validateField(field, form[field], form)
      setFieldErrors(fe => ({ ...fe, [field]: err }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Run all field validations up front so every error is visible at once
    const errors = {}
    VALIDATED_FIELDS.forEach(f => {
      const err = validateField(f, form[f], form)
      if (err) errors[f] = err
    })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    if (!form.agreedToTerms) {
      setError('You must read and accept the Terms & Conditions to create an account.')
      return
    }

    setLoading(true)
    try {
      const result = await signup({
        username:        form.username.trim(),
        email:           form.email.trim(),
        firstName:       form.firstName.trim(),
        lastName:        form.lastName.trim(),
        middleInitial:   form.middleInitial.trim() || undefined,
        password:        form.password,
        confirmPassword: form.confirmPassword,
        agreedToTerms:   form.agreedToTerms,
        newsletterOptIn: form.newsletterOptIn,
        _hp:             form._hp,
      })
      if (result.pending) {
        navigate('/verify-pending', {
          replace: true,
          state: { email: result.email, username: form.username.trim() },
        })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      if (err.status === 429) {
        setError('Too many sign-up attempts from this connection. Please wait a few minutes and try again.')
      } else {
        setError(err.message || 'Sign up failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

      {/*
        Honeypot trap — visually hidden, off-screen, never autofilled.
        Real users: never see it, never fill it.
        Most form-filling bots: fill every visible text input, trip this, get silently rejected.
        aria-hidden keeps screen readers from announcing it.
      */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
      >
        <label htmlFor="hp-field">Leave this blank</label>
        <input
          id="hp-field"
          type="text"
          name="_hp"
          value={form._hp}
          onChange={e => setForm(f => ({ ...f, _hp: e.target.value }))}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      {/* ── Name row ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">First Name</label>
          <input
            type="text" value={form.firstName}
            onChange={set('firstName')} onBlur={handleBlur('firstName')}
            placeholder="First" autoComplete="given-name"
            className={fieldErrors.firstName ? INPUT_ERR : INPUT_OK}
          />
          {fieldErrors.firstName && (
            <p className="text-xs text-red-400 mt-0.5">{fieldErrors.firstName}</p>
          )}
        </div>
        <div className="w-16 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">M.I.</label>
          <input
            type="text" value={form.middleInitial} onChange={set('middleInitial')}
            placeholder="M" maxLength={1} className={INPUT_OK}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">Last Name</label>
          <input
            type="text" value={form.lastName}
            onChange={set('lastName')} onBlur={handleBlur('lastName')}
            placeholder="Last" autoComplete="family-name"
            className={fieldErrors.lastName ? INPUT_ERR : INPUT_OK}
          />
          {fieldErrors.lastName && (
            <p className="text-xs text-red-400 mt-0.5">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      {/* ── Remaining fields — use shared Input/PasswordInput with error prop ── */}
      <Input
        id="su-username" label="Username"
        value={form.username} onChange={set('username')} onBlur={handleBlur('username')}
        placeholder="Choose a username (3–20 chars)" autoComplete="username"
        error={fieldErrors.username}
      />
      <Input
        id="su-email" label="Email Address" type="email"
        value={form.email} onChange={set('email')} onBlur={handleBlur('email')}
        placeholder="you@example.com" autoComplete="email"
        error={fieldErrors.email}
      />
      <PasswordInput
        id="su-pass" label="Password"
        value={form.password} onChange={set('password')} onBlur={handleBlur('password')}
        placeholder="Min. 8 chars, 1 number, 1 symbol" autoComplete="new-password"
        error={fieldErrors.password}
      />
      <PasswordInput
        id="su-confirm" label="Confirm Password"
        value={form.confirmPassword} onChange={set('confirmPassword')} onBlur={handleBlur('confirmPassword')}
        placeholder="Re-enter your password" autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />

      {/* ── Legal & newsletter ────────────────────────────────────────────────── */}
      <div className="border-t border-codex-border pt-4 flex flex-col gap-3">

        {/* Required: Terms & Conditions */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={form.agreedToTerms}
              onChange={e => setForm(f => ({ ...f, agreedToTerms: e.target.checked }))}
              className="sr-only"
            />
            <div className={`
              w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
              ${form.agreedToTerms
                ? 'bg-codex-gold border-codex-gold'
                : 'bg-codex-surface border-codex-border group-hover:border-codex-gold/50'}
            `}>
              {form.agreedToTerms && (
                <svg className="w-2.5 h-2.5 text-codex-bg" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-codex-subtext leading-relaxed">
            I have read and agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-codex-gold hover:text-codex-goldHover transition-colors font-medium"
              onClick={e => e.stopPropagation()}
            >
              Terms & Conditions
              <ExternalLink size={10} className="mb-0.5" />
            </Link>
            , including the rulebook ownership requirement and community standards.{' '}
            <span className="text-red-400 font-semibold">Required.</span>
          </span>
        </label>

        {/* Optional: Newsletter */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={form.newsletterOptIn}
              onChange={e => setForm(f => ({ ...f, newsletterOptIn: e.target.checked }))}
              className="sr-only"
            />
            <div className={`
              w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
              ${form.newsletterOptIn
                ? 'bg-codex-gold border-codex-gold'
                : 'bg-codex-surface border-codex-border group-hover:border-codex-gold/50'}
            `}>
              {form.newsletterOptIn && (
                <svg className="w-2.5 h-2.5 text-codex-bg" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-codex-subtext leading-relaxed">
            Sign me up for the CampaignCodex newsletter — occasional updates on new features and supported
            game systems. No spam, unsubscribe anytime.{' '}
            <span className="text-codex-muted">Optional.</span>
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !form.agreedToTerms}
        className="w-full py-2.5 px-4 rounded-lg mt-1 bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-xs text-codex-subtext">
        Already have an account?{' '}
        <Link to="/" className="text-codex-gold hover:text-codex-goldHover transition-colors">Sign in</Link>
      </p>
    </form>
  )
}
