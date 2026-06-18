import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input from '../ui/Input'
import PasswordInput from '../ui/PasswordInput'
import { ExternalLink } from 'lucide-react'

const INPUT_CLASS = `w-full bg-codex-surface border border-codex-border rounded-lg px-4 py-2.5 text-codex-text placeholder-codex-muted text-sm focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30 transition-colors duration-150`

export default function SignupForm() {
  const { signup }  = useAuth()
  const navigate    = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', firstName: '', lastName: '', middleInitial: '',
    password: '', confirmPassword: '',
    agreedToTerms:  false,
    newsletterOptIn: false,
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.agreedToTerms)                   { setError('You must read and accept the Terms & Conditions to create an account.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      await signup({
        username:        form.username.trim(),
        email:           form.email.trim(),
        firstName:       form.firstName.trim(),
        lastName:        form.lastName.trim(),
        middleInitial:   form.middleInitial.trim() || undefined,
        password:        form.password,
        confirmPassword: form.confirmPassword,
        agreedToTerms:   form.agreedToTerms,
        newsletterOptIn: form.newsletterOptIn,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Name row */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">First Name</label>
          <input type="text" value={form.firstName} onChange={set('firstName')}
            placeholder="First" autoComplete="given-name" required className={INPUT_CLASS} />
        </div>
        <div className="w-16 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">M.I.</label>
          <input type="text" value={form.middleInitial} onChange={set('middleInitial')}
            placeholder="M" maxLength={1} className={INPUT_CLASS} />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-codex-text">Last Name</label>
          <input type="text" value={form.lastName} onChange={set('lastName')}
            placeholder="Last" autoComplete="family-name" required className={INPUT_CLASS} />
        </div>
      </div>

      <Input id="su-username" label="Username" value={form.username} onChange={set('username')}
        placeholder="Choose a username (3–20 chars)" autoComplete="username" required />
      <Input id="su-email" label="Email Address" type="email" value={form.email} onChange={set('email')}
        placeholder="you@example.com" autoComplete="email" required />
      <PasswordInput id="su-pass" label="Password" value={form.password} onChange={set('password')}
        placeholder="Min. 8 chars, 1 number, 1 symbol" autoComplete="new-password" />
      <PasswordInput id="su-confirm" label="Confirm Password" value={form.confirmPassword} onChange={set('confirmPassword')}
        placeholder="Re-enter your password" autoComplete="new-password" />

      {/* Legal & newsletter */}
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

      <button type="submit" disabled={loading || !form.agreedToTerms}
        className="w-full py-2.5 px-4 rounded-lg mt-1 bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow">
        {loading ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-xs text-codex-subtext">
        Already have an account?{' '}
        <Link to="/" className="text-codex-gold hover:text-codex-goldHover transition-colors">Sign in</Link>
      </p>
    </form>
  )
}
