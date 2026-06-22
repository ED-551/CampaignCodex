import { useLocation, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import LoginForm from '../components/auth/LoginForm'
import SignupForm from '../components/auth/SignupForm'
import ForgotPassword from '../components/auth/ForgotPassword'
import ResetPassword from '../components/auth/ResetPassword'

const VIEWS = {
  '/':                { title: 'Welcome Back',       subtitle: 'Sign in to your account', form: LoginForm },
  '/signup':          { title: 'Join the Codex',     subtitle: 'Create your account',     form: SignupForm },
  '/forgot-password': { title: 'Recover Access',     subtitle: 'Reset your password',     form: ForgotPassword },
  '/reset-password':  { title: 'Set New Password',   subtitle: 'Create a new password',   form: ResetPassword },
}

export default function LandingPage() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()

  // Wait for auth to resolve before deciding — avoids a flash of the login form
  if (loading) return null

  // Already authenticated — send straight to the dashboard
  if (user) return <Navigate to="/dashboard" replace />

  const view = VIEWS[pathname] ?? VIEWS['/']
  const Form = view.form

  return (
    <div className="relative min-h-screen w-full flex items-start sm:items-center justify-center overflow-x-hidden py-6 sm:py-8 bg-codex-bg">
      <Helmet><title>CampaignCodex — Digital Companion for Tabletop RPGs</title></Helmet>

      {/* Background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,168,76,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 80% 80%, rgba(139,26,26,0.06) 0%, transparent 60%)
          `,
        }}
      />

      {/* Subtle grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.8) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Card */}
      <div
        className="
          relative z-10 w-full max-w-md mx-4
          bg-codex-card border border-codex-border rounded-2xl
          shadow-card
          overflow-hidden
        "
      >
        {/* Gold top bar */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

        {/* Header */}
        <div className="px-6 sm:px-8 pt-8 sm:pt-12 pb-6 text-center">
          {/* Logo */}
          <div className="mb-5 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-codex-gold/10 border border-codex-gold/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-codex-gold" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h1 className="font-display text-lg text-codex-gold tracking-wide leading-tight">
              CampaignCodex
            </h1>
          </div>

          {/* Dynamic title */}
          <div>
            <h2 className="text-xl font-semibold text-codex-text mb-1">{view.title}</h2>
            <p className="text-sm text-codex-subtext">{view.subtitle}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-8 h-px bg-codex-border" />

        {/* Form area */}
        <div className="px-8 py-6">
          <Form />
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-1 text-center flex flex-col gap-1">
          <p className="text-xs text-codex-muted">
            Your TTRPG campaign hub · Shadowdark · Mörk Borg · Nimble RPG
          </p>
          <p className="text-xs text-codex-muted/50">
            © {new Date().getFullYear()} CampaignCodex · All rights reserved
          </p>
        </div>

        {/* Gold bottom bar */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-30" />
      </div>
    </div>
  )
}
