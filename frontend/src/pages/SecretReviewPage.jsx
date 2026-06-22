import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Globe } from 'lucide-react'
import { RESTAURANTS } from '../data/edsEats'

export default function SecretReviewPage() {
  const { slug }   = useParams()
  const navigate   = useNavigate()
  const restaurant = RESTAURANTS.find((r) => r.slug === slug)

  // Unknown slug — quietly redirect back
  if (!restaurant) {
    navigate('/eds-eats', { replace: true })
    return null
  }

  const { name, address, website, quote, rating, fullReview } = restaurant

  return (
    <div className="min-h-screen bg-codex-bg text-codex-text">
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-20">

        {/* ── Back link ── */}
        <button
          onClick={() => navigate('/eds-eats')}
          className="flex items-center gap-2 text-xs text-codex-muted hover:text-codex-gold
                     transition-colors duration-150 mb-10 group"
        >
          <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
          Back to all reviews
        </button>

        {/* ── Eyebrow ── */}
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-codex-muted mb-3">
          Field Report · Ed's Eats
        </p>

        {/* ── Restaurant name ── */}
        <h1
          className="font-display text-3xl sm:text-4xl text-codex-gold mb-2"
          style={{ textShadow: '0 0 32px rgba(201,168,76,0.2)' }}
        >
          {name}
        </h1>

        {/* ── Address ── */}
        <p className="text-xs text-codex-muted mb-6">{address}</p>

        {/* ── Rating badge ── */}
        <div className="inline-flex items-center gap-2 bg-codex-card border border-codex-gold/30
                        rounded-lg px-4 py-2 mb-8">
          <span className="text-xs uppercase tracking-widest text-codex-subtext">Verdict</span>
          <span className="text-2xl font-bold text-codex-gold">{rating}</span>
        </div>

        <div className="h-px bg-gradient-to-r from-codex-gold/20 via-codex-gold/10 to-transparent mb-8" />

        {/* ── Full review or placeholder ── */}
        {fullReview ? (
          <div className="space-y-4 text-sm text-codex-text leading-relaxed">
            {fullReview.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-6">🔍</p>
            <p className="text-sm text-codex-subtext italic leading-relaxed max-w-sm mx-auto">
              The detective is still working this case. The full write-up is pending
              further field investigation. Check back soon, citizen.
            </p>
            <div className="mt-8 border border-codex-border rounded-xl bg-codex-card px-6 py-5 text-left">
              <p className="text-xs uppercase tracking-widest text-codex-muted mb-2">
                Preliminary finding
              </p>
              <p className="text-sm italic text-codex-subtext">"{quote}"</p>
            </div>
          </div>
        )}

        {/* ── Restaurant info card ── */}
        {(address || website) && (
          <>
            <div className="h-px bg-gradient-to-r from-codex-gold/20 via-codex-gold/10 to-transparent mt-10 mb-8" />
            <div className="border border-codex-border rounded-xl bg-codex-card px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-codex-muted mb-4">
                Field Intel
              </p>
              <div className="space-y-3">
                {address && (
                  <div className="flex items-start gap-3">
                    <MapPin size={13} className="text-codex-gold/60 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-codex-subtext">{address}</p>
                  </div>
                )}
                {website && (
                  <div className="flex items-start gap-3">
                    <Globe size={13} className="text-codex-gold/60 mt-0.5 flex-shrink-0" />
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-codex-gold/80 hover:text-codex-gold transition-colors duration-150"
                    >
                      {website.replace('https://', '')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
