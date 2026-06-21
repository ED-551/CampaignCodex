/**
 * SecretPage — /eds-eats
 *
 * Eddie's restaurant review easter egg. This page displays Ed's personal ratings
 * for a handful of San Gabriel Valley restaurants, written in a noir detective
 * voice. It is entirely cosmetic and has no connection to campaign or bestiary data.
 *
 * HOW IT'S TRIGGERED
 * The entry point is buried in the Account Settings "Danger Zone" section. The
 * phrase "be sure" is rendered so that clicking the word "be" (a styled <span>
 * with an onClick) navigates here. Nothing in the UI labels or hints at its
 * existence — it is found by accident or word of mouth.
 *
 * AUTHENTICATION
 * The route is wrapped in <ProtectedRoute>, so only logged-in users can reach it.
 * Unauthenticated visitors are redirected to the login page, keeping the page off
 * the public internet entirely.
 *
 * EXCLUDED FROM NAVIGATION & SITEMAP
 * The route is not linked from any nav bar, footer, or sitemap.xml. It does not
 * appear in the dashboard or any user-facing menu. Search engines won't index it
 * because ProtectedRoute redirects unauthenticated crawlers before they see content.
 * The restaurant data lives in src/data/edsEats.js (a plain JS array) so it doesn't
 * create any API surface or DB entries.
 */

import { useNavigate } from 'react-router-dom'
import { RESTAURANTS } from '../data/edsEats'

export default function SecretPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-codex-bg text-codex-text">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-codex-muted mb-4">
          Classified Dossier · Eyes Only
        </p>

        <h1
          className="font-display text-3xl sm:text-4xl text-codex-gold mb-6"
          style={{ textShadow: '0 0 40px rgba(201,168,76,0.25)' }}
        >
          Ed's Secret Restaurant Reviews
        </h1>

        <p className="text-sm text-codex-subtext leading-relaxed max-w-2xl mx-auto">
          The man needs no introduction in the world of dice, dragon maps, and dungeon
          catastrophes. But there exists a side to this chronicler that few have dared to
          document — a relentless, square-jawed dedication to the pursuit of
          extraordinary food. No clue goes unfollowed. No dumpling goes uneaten. These
          are the field notes of a man who has rolled initiative <em>and</em> ordered the
          soup of the day, often on the same evening. Study them carefully, citizen.
          Trust them implicitly.
        </p>

        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-codex-gold/30 to-transparent" />
      </div>

      {/* ── Card Grid ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {RESTAURANTS.map((r) => (
            <RestaurantCard
              key={r.slug}
              restaurant={r}
              onClick={() => navigate(`/eds-eats/${r.slug}`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function RestaurantCard({ restaurant, onClick }) {
  const { name, address, quote, rating } = restaurant

  return (
    <button
      onClick={onClick}
      className="
        group w-full text-left
        bg-codex-card border border-codex-border rounded-xl
        px-6 py-5
        hover:border-codex-gold/40 hover:bg-codex-surface
        transition-all duration-200
        shadow-card
      "
    >
      {/* ── Name ── */}
      <h2 className="
        text-center text-lg font-semibold text-codex-text
        group-hover:text-codex-gold transition-colors duration-200
        mb-4 tracking-wide
      ">
        {name}
      </h2>

      {/* ── Footer row: address · quote · rating ── */}
      <div className="flex items-start gap-4">

        {/* Address */}
        <div className="flex-shrink-0 w-[34%]">
          <p className="text-[11px] leading-snug text-codex-muted">
            {address}
          </p>
        </div>

        {/* Divider */}
        <div className="self-stretch w-px bg-codex-border flex-shrink-0" />

        {/* Quote */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] italic leading-snug text-codex-subtext line-clamp-3">
            "{quote}"
          </p>
        </div>

        {/* Divider */}
        <div className="self-stretch w-px bg-codex-border flex-shrink-0" />

        {/* Rating */}
        <div className="flex-shrink-0 text-right">
          <span className="text-xl font-bold text-codex-gold leading-none">
            {rating}
          </span>
        </div>

      </div>
    </button>
  )
}
