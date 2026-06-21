/**
 * ProfileEditPage — edit own profile, with a live preview toggle.
 *
 * Route: /profile/edit
 * Fetches own profile via GET /api/profile/me, previews using the same
 * theme token map as ProfilePage so the preview is pixel-accurate.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate }   from 'react-router-dom'
import {
  BookOpen, ArrowLeft, Eye, EyeOff, Check, Swords, Shield, Users, Scroll,
} from 'lucide-react'
import { api } from '../utils/api'

// ── Identical to ProfilePage's THEMES map ──────────────────────────────────
const THEMES = {
  default: {
    topBar:       'via-codex-gold',
    cardBorder:   'border-codex-border',
    accent:       'text-codex-gold',
    accentBg:     'bg-codex-gold/10',
    accentBorder: 'border-codex-gold/30',
    coinRing:     'border-codex-gold/60 bg-codex-gold/15 text-codex-gold',
    chip:         'bg-codex-gold/10 text-codex-gold border border-codex-gold/30',
    statVal:      'text-codex-gold',
    label:        null,
  },
  shadowdark: {
    topBar:       'via-amber-500',
    cardBorder:   'border-amber-600/50',
    accent:       'text-amber-500',
    accentBg:     'bg-amber-500/10',
    accentBorder: 'border-amber-500/30',
    coinRing:     'border-amber-500/60 bg-amber-500/15 text-amber-400',
    chip:         'bg-amber-500/10 text-amber-500 border border-amber-500/30',
    statVal:      'text-amber-500',
    label:        'Shadowdark',
  },
  morkborg: {
    topBar:       'via-yellow-300',
    cardBorder:   'border-yellow-300/50',
    accent:       'text-yellow-300',
    accentBg:     'bg-yellow-300/10',
    accentBorder: 'border-yellow-300/30',
    coinRing:     'border-yellow-300/60 bg-yellow-300/15 text-yellow-300',
    chip:         'bg-yellow-300/10 text-yellow-300 border border-yellow-300/30',
    statVal:      'text-yellow-300',
    label:        'Mörk Borg',
  },
  nimble: {
    topBar:       'via-emerald-400',
    cardBorder:   'border-emerald-400/50',
    accent:       'text-emerald-400',
    accentBg:     'bg-emerald-400/10',
    accentBorder: 'border-emerald-400/30',
    coinRing:     'border-emerald-400/60 bg-emerald-400/15 text-emerald-400',
    chip:         'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30',
    statVal:      'text-emerald-400',
    label:        'Nimble RPG',
  },
}

const THEME_OPTIONS = [
  { value: 'default',    label: 'Default',    sub: 'Classic gold',    ring: 'border-codex-gold/50 bg-codex-gold/10 text-codex-gold' },
  { value: 'shadowdark', label: 'Shadowdark', sub: 'Torchlit amber',  ring: 'border-amber-500/50 bg-amber-500/10 text-amber-400' },
  { value: 'morkborg',   label: 'Mörk Borg',  sub: 'Acid yellow',     ring: 'border-yellow-300/50 bg-yellow-300/10 text-yellow-300' },
  { value: 'nimble',     label: 'Nimble RPG', sub: 'Emerald forest',  ring: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400' },
]

const GAME_OPTIONS = [
  { value: 'shadowdark', label: 'Shadowdark' },
  { value: 'morkborg',   label: 'Mörk Borg'  },
  { value: 'nimble',     label: 'Nimble RPG'  },
]

const ROLE_OPTIONS = [
  { value: 'player', label: 'Player only'     },
  { value: 'dm',     label: 'Game Master only' },
  { value: 'both',   label: 'Player & GM'      },
]

const DISPLAY_PREF_OPTIONS = [
  { value: 'username',          label: 'Username only' },
  { value: 'first_and_username', label: 'First name + username' },
]

const GAME_LABELS = {
  shadowdark: 'Shadowdark',
  morkborg:   'Mörk Borg',
  nimble:     'Nimble RPG',
}

const ROLE_LABELS = {
  player: 'Player',
  dm:     'Game Master',
  both:   'Player & GM',
}

const MAX_ABOUT = 1200

export default function ProfileEditPage() {
  const navigate = useNavigate()

  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')
  const [preview,    setPreview]    = useState(false)

  // source of truth for the loaded profile (for stats, joinedAt)
  const [sourceProfile, setSourceProfile] = useState(null)

  // editable form state
  const [form, setForm] = useState({
    displayNamePref: 'username',
    aboutText:       '',
    rolePref:        'both',
    gameInterests:   [],
    profileTheme:    'default',
  })

  useEffect(() => {
    api.get('/profile/me')
      .then(({ profile }) => {
        setSourceProfile(profile)
        setForm({
          displayNamePref: profile.displayNamePref ?? 'username',
          aboutText:       profile.aboutText       ?? '',
          rolePref:        profile.rolePref        ?? 'both',
          gameInterests:   profile.gameInterests   ?? [],
          profileTheme:    profile.profileTheme    ?? 'default',
        })
      })
      .catch(err => setError(err.message || 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) {
    setSaved(false)
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleGame(g) {
    setForm(f => {
      const next = f.gameInterests.includes(g)
        ? f.gameInterests.filter(x => x !== g)
        : f.gameInterests.length < 3 ? [...f.gameInterests, g] : f.gameInterests
      return { ...f, gameInterests: next }
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await api.patch('/profile', form)
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <Shell>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-codex-muted animate-pulse">Loading…</p>
      </div>
    </Shell>
  )

  const theme = THEMES[form.profileTheme] ?? THEMES.default

  return (
    <Shell>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">

        {/* ── Page title + preview toggle ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-codex-text">Edit Profile</h1>
            <p className="text-xs text-codex-muted mt-0.5">Customize how you appear to other players.</p>
          </div>
          <button
            onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg
              border border-codex-border bg-codex-surface text-codex-subtext
              hover:text-codex-text hover:border-codex-text/30 transition-colors"
          >
            {preview ? <EyeOff size={12} /> : <Eye size={12} />}
            {preview ? 'Back to edit' : 'Preview'}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {preview ? (
          /* ── PREVIEW MODE ── */
          <PreviewCard form={form} profile={sourceProfile} theme={theme} />
        ) : (
          /* ── EDIT MODE ── */
          <div className="space-y-6">

            {/* Display name preference */}
            <FormSection label="Display Name" hint="How your name appears on your profile card.">
              <div className="flex flex-col gap-2">
                {DISPLAY_PREF_OPTIONS.map(opt => (
                  <label key={opt.value}
                    className="flex items-center gap-3 cursor-pointer group">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                      transition-colors flex-shrink-0 ${
                      form.displayNamePref === opt.value
                        ? 'border-codex-gold bg-codex-gold/20'
                        : 'border-codex-border group-hover:border-codex-muted'
                    }`}>
                      {form.displayNamePref === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-codex-gold" />
                      )}
                    </span>
                    <input
                      type="radio"
                      name="displayNamePref"
                      value={opt.value}
                      checked={form.displayNamePref === opt.value}
                      onChange={e => set('displayNamePref', e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-sm text-codex-subtext group-hover:text-codex-text transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </FormSection>

            <div className="h-px bg-codex-border/40" />

            {/* About text */}
            <FormSection label="About" hint={`${form.aboutText.length} / ${MAX_ABOUT} characters`}>
              <textarea
                rows={4}
                value={form.aboutText}
                onChange={e => set('aboutText', e.target.value.slice(0, MAX_ABOUT))}
                placeholder="Tell the table who you are — favorite genres, playstyle, anything goes."
                className="w-full bg-codex-surface border border-codex-border rounded-lg
                  px-3 py-2.5 text-sm text-codex-text placeholder-codex-muted resize-none
                  focus:outline-none focus:border-codex-gold/50 focus:ring-1 focus:ring-codex-gold/20
                  transition-colors leading-relaxed"
              />
            </FormSection>

            <div className="h-px bg-codex-border/40" />

            {/* Role preference */}
            <FormSection label="Role Preference" hint="Are you usually a player, a GM, or both?">
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('rolePref', opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      form.rolePref === opt.value
                        ? 'border-codex-gold/60 bg-codex-gold/10 text-codex-gold'
                        : 'border-codex-border text-codex-subtext hover:border-codex-muted hover:text-codex-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormSection>

            <div className="h-px bg-codex-border/40" />

            {/* Game interests */}
            <FormSection label="Game Interests" hint="Select up to 3 games you play or want to play.">
              <div className="flex flex-wrap gap-2">
                {GAME_OPTIONS.map(opt => {
                  const selected = form.gameInterests.includes(opt.value)
                  const maxed    = !selected && form.gameInterests.length >= 3
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleGame(opt.value)}
                      disabled={maxed}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed ${
                        selected
                          ? 'border-codex-gold/60 bg-codex-gold/10 text-codex-gold'
                          : 'border-codex-border text-codex-subtext hover:border-codex-muted hover:text-codex-text'
                      }`}
                    >
                      {selected && <span className="mr-1 text-[10px]">✓</span>}
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </FormSection>

            <div className="h-px bg-codex-border/40" />

            {/* Profile theme */}
            <FormSection label="Profile Theme" hint="Applies a color scheme to your public profile card.">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('profileTheme', opt.value)}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      form.profileTheme === opt.value
                        ? 'border-codex-gold/60 bg-codex-gold/5 ring-1 ring-codex-gold/30'
                        : 'border-codex-border hover:border-codex-muted'
                    }`}
                  >
                    {/* Mini coin avatar swatch */}
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center
                      text-xs font-bold ${opt.ring}`}>
                      A
                    </div>
                    <span className="text-xs font-medium text-codex-text">{opt.label}</span>
                    <span className="text-[10px] text-codex-muted">{opt.sub}</span>
                    {form.profileTheme === opt.value && (
                      <span className="absolute top-1.5 right-1.5 text-codex-gold">
                        <Check size={10} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </FormSection>

            <div className="h-px bg-codex-border/40" />

            {/* Save */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-codex-gold text-codex-bg font-semibold
                  text-sm hover:bg-codex-goldHover transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-emerald-400">
                  <Check size={13} /> Saved
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </Shell>
  )
}

// ─── Preview card — mirrors ProfilePage's card exactly ────────────────────────
function PreviewCard({ form, profile, theme }) {
  if (!profile) return null

  const displayName = (form.displayNamePref === 'first_and_username') ? profile.firstName : null

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs text-codex-muted text-center mb-4 italic">
        This is how your profile looks to other players.
      </p>
      <div className={`bg-codex-card border ${theme.cardBorder} rounded-2xl overflow-hidden shadow-xl`}>
        <div className={`h-px w-full bg-gradient-to-r from-transparent ${theme.topBar} to-transparent opacity-70`} />

        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 ${theme.coinRing}
              flex items-center justify-center text-xl font-bold font-display select-none`}>
              {profile.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className={`text-xl font-semibold truncate ${theme.accent}`}>
                    {profile.username}
                  </h2>
                  {displayName && (
                    <p className="text-sm text-codex-subtext mt-0.5">{displayName}</p>
                  )}
                </div>
                {theme.label && (
                  <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider
                    px-2 py-0.5 rounded-full border ${theme.chip}`}>
                    {theme.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-codex-border/60 mx-6" />

        <div className="px-6 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <StatItem icon={<Scroll size={13} />}   label="Campaigns" value={profile.stats?.campaigns ?? 0} theme={theme} />
            <StatItem icon={<Shield size={13} />}   label="GM"        value={profile.stats?.dm        ?? 0} theme={theme} />
            <StatItem icon={<Swords size={13} />}   label="Player"    value={profile.stats?.player    ?? 0} theme={theme} />
            <StatItem icon={<Users  size={13} />}   label="Friends"   value={profile.stats?.friends   ?? 0} theme={theme} />
          </div>

          {form.rolePref && (
            <div className="flex items-center gap-2 mt-1">
              <Shield size={12} className="text-codex-muted" />
              <span className="text-xs text-codex-subtext">
                Role: <span className={`font-medium ${theme.accent}`}>{ROLE_LABELS[form.rolePref]}</span>
              </span>
            </div>
          )}

          {form.gameInterests?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-xs text-codex-muted flex-shrink-0">Interested in:</span>
              {form.gameInterests.map(g => (
                <span key={g} className={`text-[11px] px-2 py-0.5 rounded-full ${theme.chip}`}>
                  {GAME_LABELS[g] ?? g}
                </span>
              ))}
            </div>
          )}
        </div>

        {form.aboutText && (
          <>
            <div className="h-px bg-codex-border/60 mx-6" />
            <div className="px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-codex-muted mb-2">About</p>
              <p className="text-sm text-codex-subtext leading-relaxed whitespace-pre-wrap">
                {form.aboutText}
              </p>
            </div>
          </>
        )}

        <div className={`h-px w-full bg-gradient-to-r from-transparent ${theme.topBar} to-transparent opacity-30`} />
      </div>
      <p className="text-center text-xs text-codex-muted mt-4">
        Member since {new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

function StatItem({ icon, label, value, theme }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-codex-muted">{icon}</span>
      <span className={`text-sm font-bold ${theme.statVal}`}>{value}</span>
      <span className="text-xs text-codex-muted">{label}</span>
    </div>
  )
}

function FormSection({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium text-codex-text">{label}</p>
        {hint && <p className="text-xs text-codex-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Shell({ children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-codex-bg flex flex-col">
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
          <span className="text-codex-border">/</span>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-codex-subtext hover:text-codex-text transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <span className="text-codex-border">/</span>
          <span className="text-xs text-codex-subtext">Edit Profile</span>
        </div>
      </header>
      {children}
    </div>
  )
}
