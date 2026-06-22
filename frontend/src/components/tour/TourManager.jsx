/**
 * TourManager — renders the opt-in welcome modal and drives the Joyride tour.
 *
 * Flow:
 *  1. On first ever visit to /dashboard, a welcome modal appears asking the
 *     user whether they want a tour. Yes → start tour. No → dismiss forever.
 *  2. Joyride runs in controlled mode (stepIndex managed here).
 *  3. Steps 0 & 1 (DM widget) have the overlay disabled so the user can
 *     click those elements freely. Auto-advances via widgetOpen state.
 *  4. Step 2 (profile link) auto-advances when location changes to /profile/edit.
 *  5. Step 5 (back button) auto-advances when location returns to /dashboard.
 *  6. All remaining steps use Joyride Next to advance (no navigation needed).
 *  7. If any target element is missing the step is skipped gracefully.
 *
 * Must render INSIDE <BrowserRouter> (needs useLocation) and
 * OUTSIDE <Routes> so it persists across page changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation }                              from 'react-router-dom'
import { Joyride, ACTIONS, EVENTS, STATUS }         from 'react-joyride'
import { useTour }   from '../../context/TourContext'
import { useAuth }   from '../../context/AuthContext'
import { useDM }     from '../../context/DMContext'
import { TOUR_STEPS, JOYRIDE_STYLES } from './tourSteps'

// Steps where the overlay is disabled so the user can click freely.
// Interactive steps: 0 (DM bubble) and 1 (DM panel close).
const NO_OVERLAY_STEPS = new Set([0, 1])

export default function TourManager() {
  const location       = useLocation()
  const { user }       = useAuth()
  const { widgetOpen } = useDM()
  const {
    run, stepIndex, setStepIndex,
    startTour, stopTour,
    hasSeen, markSeen,
  } = useTour()

  const [showWelcome, setShowWelcome] = useState(false)
  const didAutoPrompt  = useRef(false)
  const widgetWasOpen  = useRef(false)

  // ── Auto-prompt: first ever visit to /dashboard ─────────────────────────
  useEffect(() => {
    if (!user || location.pathname !== '/dashboard' || run || showWelcome || didAutoPrompt.current) return
    if (!hasSeen(user.id)) {
      didAutoPrompt.current = true
      const t = setTimeout(() => setShowWelcome(true), 900)
      return () => clearTimeout(t)
    }
  }, [user, location.pathname, run, showWelcome, hasSeen])

  function handleAccept() {
    markSeen(user?.id)   // prevent future auto-prompts
    setShowWelcome(false)
    startTour()
  }

  function handleDecline() {
    markSeen(user?.id)
    setShowWelcome(false)
  }

  // ── Step 0 → 1: auto-advance when DM widget opens ───────────────────────
  useEffect(() => {
    if (!run || stepIndex !== 0 || !widgetOpen) return
    const t = setTimeout(() => setStepIndex(1), 350)
    return () => clearTimeout(t)
  }, [widgetOpen, run, stepIndex, setStepIndex])

  // ── Step 1 → 2: auto-advance when DM widget closes ──────────────────────
  useEffect(() => {
    if (!run || stepIndex !== 1) {
      widgetWasOpen.current = false
      return
    }
    if (widgetOpen) { widgetWasOpen.current = true; return }
    if (!widgetOpen && widgetWasOpen.current) {
      widgetWasOpen.current = false
      const t = setTimeout(() => setStepIndex(2), 350)
      return () => clearTimeout(t)
    }
  }, [widgetOpen, run, stepIndex, setStepIndex])

  // ── Step 2 → 3: auto-advance when user clicks their name and navigates ───
  useEffect(() => {
    if (!run || stepIndex !== 2) return
    if (location.pathname === '/profile/edit') {
      const t = setTimeout(() => setStepIndex(3), 450)
      return () => clearTimeout(t)
    }
  }, [location.pathname, run, stepIndex, setStepIndex])

  // ── Step 5 → 6: auto-advance when user clicks Back and returns home ───────
  useEffect(() => {
    if (!run || stepIndex !== 5) return
    if (location.pathname === '/dashboard') {
      const t = setTimeout(() => setStepIndex(6), 450)
      return () => clearTimeout(t)
    }
  }, [location.pathname, run, stepIndex, setStepIndex])

  // ── Joyride callback ─────────────────────────────────────────────────────
  const handleCallback = useCallback((data) => {
    const { action, index, status, type } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      stopTour()
      return
    }

    if (type === EVENTS.STEP_AFTER) {
      // Only informational steps have a Next button; steps with hideFooter
      // never reach here via NEXT (they auto-advance via state watchers above).
      if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
        const delta = action === ACTIONS.PREV ? -1 : 1
        setStepIndex(index + delta)
      }
      return
    }

    // Target not found — skip gracefully
    if (type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + 1)
    }
  }, [setStepIndex, stopTour])

  return (
    <>
      {showWelcome && (
        <TourWelcomeModal onAccept={handleAccept} onDecline={handleDecline} />
      )}

      <Joyride
        steps={TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        callback={handleCallback}
        continuous
        showProgress
        scrollToFirstStep
        disableCloseOnEsc={false}
        disableScrolling={false}
        disableOverlay={NO_OVERLAY_STEPS.has(stepIndex)}
        styles={JOYRIDE_STYLES}
        locale={{
          back:  '← Back',
          close: 'Close',
          last:  'Finish Tour',
          next:  'Next →',
          skip:  'Skip tour',
        }}
      />
    </>
  )
}

// ─── Welcome modal ────────────────────────────────────────────────────────────
function TourWelcomeModal({ onAccept, onDecline }) {
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-codex-card border border-codex-border rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center">

        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-codex-gold/10 border border-codex-gold/30
          flex items-center justify-center text-2xl mb-5">
          🗺️
        </div>

        {/* Heading */}
        <h2 className="font-display text-lg text-codex-gold mb-2 tracking-wide">
          Welcome to CampaignCodex
        </h2>

        {/* Body */}
        <p className="text-sm text-codex-subtext leading-relaxed mb-8">
          Would you like a quick tour? We'll walk you through the main features
          so you can hit the ground running.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onAccept}
            className="w-full py-2.5 rounded-lg bg-codex-gold text-codex-bg
              text-sm font-semibold hover:bg-codex-goldHover transition-colors"
          >
            Show me around →
          </button>
          <button
            onClick={onDecline}
            className="w-full py-2 rounded-lg border border-codex-border
              text-sm text-codex-subtext hover:text-codex-text hover:border-codex-muted
              transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  )
}
