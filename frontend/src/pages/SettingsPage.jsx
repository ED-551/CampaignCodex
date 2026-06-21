import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BookOpen, User, Mail, Lock, Bell, CheckCircle, AlertCircle, ArrowLeft, LogOut, Trash2, X, Heart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const INPUT_CLASS = `
  w-full bg-codex-surface border border-codex-border rounded-lg px-4 py-2.5
  text-codex-text placeholder-codex-muted text-sm
  focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
  transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed
`
const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wider text-codex-subtext mb-1.5'

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="bg-codex-card border border-codex-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-codex-border bg-codex-surface/50">
        {Icon && <Icon size={15} className="text-codex-gold" />}
        <h2 className="text-xs font-bold uppercase tracking-widest text-codex-gold">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Alert({ type, message }) {
  if (!message) return null
  const isSuccess = type === 'success'
  return (
    <div className={`flex items-start gap-2.5 text-sm rounded-lg px-4 py-3 border ${
      isSuccess
        ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400'
        : 'bg-red-900/20 border-red-700/40 text-red-400'
    }`}>
      {isSuccess
        ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />
        : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
      {message}
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout, updateSettings, changePassword, deleteAccount } = useAuth()
  const navigate = useNavigate()

  // ── Profile form ──────────────────────────────────────────────
  const [profile, setProfile] = useState({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    email:     user?.email     ?? '',
  })
  const [profileStatus, setProfileStatus] = useState({ type: '', msg: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  // ── Newsletter ────────────────────────────────────────────────
  const [newsletter, setNewsletter] = useState(user?.newsletterOptIn ?? false)
  const [nlStatus, setNlStatus]     = useState({ type: '', msg: '' })
  const [nlLoading, setNlLoading]   = useState(false)

  // ── Password form ─────────────────────────────────────────────
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' })
  const [pwStatus, setPwStatus] = useState({ type: '', msg: '' })
  const [pwLoading, setPwLoading] = useState(false)

  // ── Account deletion ──────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const setP   = k => e => setProfile(p => ({ ...p, [k]: e.target.value }))
  const setPwF = k => e => setPw(p => ({ ...p, [k]: e.target.value }))

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileStatus({ type: '', msg: '' })
    const trimmed = {
      firstName: profile.firstName.trim(),
      lastName:  profile.lastName.trim(),
      email:     profile.email.trim(),
    }
    if (!trimmed.firstName || !trimmed.lastName || !trimmed.email) {
      setProfileStatus({ type: 'error', msg: 'All fields are required.' })
      return
    }
    setProfileLoading(true)
    try {
      await updateSettings(trimmed)
      setProfileStatus({ type: 'success', msg: 'Profile updated successfully.' })
    } catch (err) {
      setProfileStatus({ type: 'error', msg: err.message || 'Update failed. Please try again.' })
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleNewsletterToggle(val) {
    setNewsletter(val)
    setNlStatus({ type: '', msg: '' })
    setNlLoading(true)
    try {
      await updateSettings({ newsletterOptIn: val })
      setNlStatus({ type: 'success', msg: val ? 'You\'re subscribed to the newsletter.' : 'Unsubscribed from the newsletter.' })
    } catch (err) {
      setNewsletter(!val) // revert
      setNlStatus({ type: 'error', msg: err.message || 'Update failed.' })
    } finally {
      setNlLoading(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwStatus({ type: '', msg: '' })
    if (!pw.current || !pw.newPw || !pw.confirm) {
      setPwStatus({ type: 'error', msg: 'All password fields are required.' })
      return
    }
    if (pw.newPw !== pw.confirm) {
      setPwStatus({ type: 'error', msg: 'New passwords do not match.' })
      return
    }
    setPwLoading(true)
    try {
      await changePassword(pw.current, pw.newPw, pw.confirm)
      setPwStatus({ type: 'success', msg: 'Password changed successfully.' })
      setPw({ current: '', newPw: '', confirm: '' })
    } catch (err) {
      setPwStatus({ type: 'error', msg: err.message || 'Password change failed. Please try again.' })
    } finally {
      setPwLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  async function handleDeleteAccount(password) {
    setDeleting(true)
    try {
      await deleteAccount(password)
      navigate('/', { replace: true })
    } catch (err) {
      setDeleting(false)
      throw err  // bubble up to modal
    }
  }

  return (
    <div className="min-h-screen bg-codex-bg">
      {/* Header */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={17} className="text-codex-gold" />
            <span className="font-display text-sm text-codex-gold tracking-wide">CampaignCodex</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-xs text-codex-subtext hover:text-codex-text transition-colors"
            >
              <ArrowLeft size={13} /> Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-codex-subtext hover:text-codex-text transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-semibold text-codex-text">Account Settings</h1>
          <p className="text-sm text-codex-subtext mt-1">
            Manage your profile, email, password, and preferences.
          </p>
        </div>

        {/* Read-only identity */}
        <SectionCard icon={User} title="Account Identity">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-codex-gold/15 border border-codex-gold/30 flex items-center justify-center">
              <span className="text-codex-gold text-sm font-bold">
                {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-codex-text">@{user?.username}</div>
              <div className="text-xs text-codex-muted capitalize">{user?.supporterTier ?? 'free'} member</div>
            </div>
          </div>
          <p className="text-xs text-codex-muted">
            Username cannot be changed. Member since{' '}
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}.
          </p>
        </SectionCard>

        {/* Profile */}
        <SectionCard icon={User} title="Profile Information">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>First Name</label>
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={setP('firstName')}
                  className={INPUT_CLASS}
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Last Name</label>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={setP('lastName')}
                  className={INPUT_CLASS}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>
                <Mail size={11} className="inline mr-1 mb-0.5" />Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={setP('email')}
                className={INPUT_CLASS}
                placeholder="you@example.com"
                required
              />
            </div>
            <Alert type={profileStatus.type} message={profileStatus.msg} />
            <button
              type="submit"
              disabled={profileLoading}
              className="px-5 py-2 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </SectionCard>

        {/* Newsletter */}
        <SectionCard icon={Bell} title="Newsletter Preferences">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-codex-text font-medium">CampaignCodex Newsletter</p>
              <p className="text-xs text-codex-subtext mt-1 leading-relaxed">
                Receive occasional updates about new features, supported game systems, and CampaignCodex news.
                We send infrequently and will never share your email with third parties.
              </p>
            </div>
            <button
              type="button"
              disabled={nlLoading}
              onClick={() => handleNewsletterToggle(!newsletter)}
              className={`
                relative flex-shrink-0 w-11 h-6 rounded-full border-2 transition-all duration-200
                ${newsletter
                  ? 'bg-codex-gold border-codex-gold'
                  : 'bg-codex-surface border-codex-border'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-checked={newsletter}
              role="switch"
            >
              <span className={`
                absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${newsletter ? 'translate-x-5' : 'translate-x-0'}
              `} />
            </button>
          </div>
          <Alert type={nlStatus.type} message={nlStatus.msg} />
        </SectionCard>

        {/* Change Password */}
        <SectionCard icon={Lock} title="Change Password">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>Current Password</label>
              <input
                type="password"
                value={pw.current}
                onChange={setPwF('current')}
                className={INPUT_CLASS}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>New Password</label>
              <input
                type="password"
                value={pw.newPw}
                onChange={setPwF('newPw')}
                className={INPUT_CLASS}
                placeholder="Min. 8 chars, 1 number, 1 symbol"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Confirm New Password</label>
              <input
                type="password"
                value={pw.confirm}
                onChange={setPwF('confirm')}
                className={INPUT_CLASS}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
            <Alert type={pwStatus.type} message={pwStatus.msg} />
            <button
              type="submit"
              disabled={pwLoading}
              className="px-5 py-2 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </SectionCard>

        {/* Danger Zone */}
        <div className="border-t border-red-500/20 pt-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-codex-muted mb-1">
                Danger Zone
              </p>
              <p className="text-sm text-codex-subtext">
                Permanently delete your account and all associated data. This cannot{' '}
                <span
                  onClick={(e) => { e.stopPropagation(); navigate('/eds-eats') }}
                  style={{ cursor: 'text', pointerEvents: 'auto', display: 'inline' }}
                >be</span>
                {' '}undone.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-lg
                border border-codex-border bg-codex-surface
                text-sm text-codex-muted hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5
                transition-all duration-150"
            >
              <Trash2 size={14} />
              Delete account
            </button>
          </div>
        </div>

        {/* Support / Donate */}
        <div className="flex flex-col items-center gap-2 pt-2 pb-2">
          <Link
            to="/donate"
            className="inline-flex items-center gap-1.5 text-xs text-codex-muted hover:text-codex-gold
              transition-colors border border-codex-border/50 hover:border-codex-gold/30
              rounded-full px-3 py-1.5"
          >
            <Heart size={11} />
            Support this project
          </Link>
        </div>

        {/* Legal links */}
        <div className="text-center pb-4">
          <Link to="/terms" className="text-xs text-codex-muted hover:text-codex-gold transition-colors">
            Terms & Conditions
          </Link>
        </div>

      </main>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          username={user?.username ?? ''}
          deleting={deleting}
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteAccountModal({ username, deleting, onConfirm, onCancel }) {
  const [typed,    setTyped]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const confirmed = typed === username

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !deleting) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleting, onCancel])

  async function handleSubmit() {
    if (!confirmed || !password) return
    setError('')
    try {
      await onConfirm(password)
    } catch (err) {
      setError(err.message || 'Deletion failed. Please try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onCancel() }}
    >
      <div className="relative w-full max-w-md bg-codex-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
        {/* Red top stripe */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <Trash2 size={16} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-codex-text">Delete your account?</h2>
              <p className="text-xs text-codex-subtext mt-0.5">This action is permanent and irreversible.</p>
            </div>
          </div>
          {!deleting && (
            <button onClick={onCancel}
              className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface ml-2">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <p className="text-sm text-codex-subtext leading-relaxed">
            This will permanently delete your account{' '}
            <span className="font-semibold text-codex-text">@{username}</span>{' '}
            and all associated data — campaigns, characters, and sheets. There is no recovery.
          </p>

          {/* Username confirmation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-codex-subtext">
              Type{' '}
              <span className="font-mono text-codex-text bg-codex-surface rounded px-1.5 py-0.5">{username}</span>{' '}
              to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              disabled={deleting}
              placeholder={username}
              autoFocus
              className="w-full bg-codex-surface border border-codex-border rounded-lg
                px-4 py-2.5 text-sm text-codex-text placeholder-codex-muted
                focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20
                transition-colors disabled:opacity-50"
            />
          </div>

          {/* Password confirmation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-codex-subtext">Enter your password to authorize deletion</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={deleting}
              placeholder="Your current password"
              className="w-full bg-codex-surface border border-codex-border rounded-lg
                px-4 py-2.5 text-sm text-codex-text placeholder-codex-muted
                focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20
                transition-colors disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm
                hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!confirmed || !password || deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm
                transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  Delete forever
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
