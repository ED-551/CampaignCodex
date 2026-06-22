/**
 * TourManager — custom hand-rolled onboarding tour.
 *
 * Replaces react-joyride entirely. No external tour library is used.
 *
 * Architecture:
 *  - SpotlightOverlay  : portal-rendered fixed overlay using the "four-panel
 *                        donut" pattern. Four dark panels surround a transparent
 *                        spotlight cutout. A fifth transparent blocker covers
 *                        the spotlight on info/last steps so the highlighted
 *                        element is click-blocked. On interactive steps the
 *                        spotlight gap is pointer-events: none so clicks reach
 *                        the actual target element.
 *  - TourTooltip       : dark card positioned relative to the target rect.
 *                        Shows a Next/Finish button on info/last steps.
 *                        Always shows an X close button.
 *  - TourWelcomeModal  : welcome prompt shown on first /dashboard visit.
 *  - TourManager       : top-level orchestrator. Drives auto-advance logic
 *                        (widgetOpen, location.pathname). Measures target
 *                        element via rAF loop. Handles per-step scrolling.
 *
 * Step types:
 *  interactive — user must click the target element; no Next button;
 *                overlay allows clicks through the spotlight.
 *  info        — user reads then clicks Next; spotlight is click-blocked.
 *  last        — same as info but button reads "Finish Tour".
 *
 * Auto-advance (via TourContext state watchers):
 *  Step 0 → 1: widgetOpen becomes true  → 350ms delay → setStepIndex(1)
 *  Step 1 → 2: widgetOpen becomes false (after open) → 350ms → setStepIndex(2)
 *  Step 2 → 3: pathname becomes /profile/edit → 450ms → setStepIndex(3)
 *  Step 5 → 6: pathname returns to /dashboard → 450ms → setStepIndex(6)
 *  Info/last steps: Next/Finish button → setStepIndex(n+1) / stopTour()
 *
 * Skip logic:
 *  If a step's target element is not found in the DOM, the tour waits up to
 *  2 seconds before skipping to the next step. This prevents false skips when
 *  navigating to a new page that hasn't finished rendering yet.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal }  from 'react-dom'
import { useLocation }   from 'react-router-dom'
import { X }             from 'lucide-react'
import { useTour }       from '../../context/TourContext'
import { useAuth }       from '../../context/AuthContext'
import { useDM }         from '../../context/DMContext'

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        '#0a0b0f',
  surface:   '#12141a',
  card:      '#1a1d26',
  border:    '#2a2d3a',
  muted:     '#4a4f63',
  text:      '#c8ccd8',
  subtext:   '#6b7280',
  gold:      '#c9a84c',
  goldHover: '#e0bb5f',
  overlay:   'rgba(0,0,0,0.72)',
  ring:      'rgba(201,168,76,0.55)',
}

// ─── Step definitions ─────────────────────────────────────────────────────────
//
// type:            'interactive' | 'info' | 'last'
// scrollToTop:     true  → window.scrollTo(0,0) when this step starts
// scrollToElement: true  → el.scrollIntoView when this step starts
//
const STEPS = [
  // 0 — DM bubble: user must click to open widget
  {
    target:    '[data-tour="dm-bubble"]',
    title:     'Direct Messages',
    content:   'Your messages hub. Direct messages, your friends list, and friend requests are all in here. Click the bubble to open it.',
    placement: 'top-start',
    type:      'interactive',
  },
  // 1 — DM panel: user must click X to close widget
  {
    target:    '[data-tour="dm-panel"]',
    title:     'Minimize the Widget',
    content:   'Take a look at the three tabs — DMs, Friends, and Requests. Click the ✕ at the top right to tuck the panel back into its icon.',
    placement: 'left',
    type:      'interactive',
  },
  // 2 — Profile link: user must click their name to navigate to /profile/edit
  {
    target:      '[data-tour="profile-link"]',
    title:       'Your Profile',
    content:     'Click your name to edit your profile, pick a theme, and set your gaming preferences.',
    placement:   'bottom',
    type:        'interactive',
    scrollToTop: true,
  },
  // 3 — Profile display section: informational
  {
    target:    '[data-tour="profile-display"]',
    title:     'Name & Role',
    content:   "Choose whether to show just your username or include your first name. Set your preferred role — Player, GM, or both — and pick the games you're interested in.",
    placement: 'right',
    type:      'info',
  },
  // 4 — Profile theme: informational (may be below fold on small screens)
  {
    target:          '[data-tour="profile-theme"]',
    title:           'Profile Theme',
    content:         'Pick a color scheme for your profile card. Use the Preview button at the top of the page to see how it looks before saving.',
    placement:       'top',
    type:            'info',
    scrollToElement: true,
  },
  // 5 — Back button: user must click to return to /dashboard
  {
    target:    '[data-tour="profile-back"]',
    title:     'Head Back',
    content:   'All done exploring? Click ← Back at the top of the page to return to the dashboard and continue the tour.',
    placement: 'bottom',
    type:      'interactive',
  },
  // 6 — Campaigns section header
  {
    target:          '[data-tour="section-campaigns"]',
    title:           'Your Campaigns',
    content:         "Campaigns you're running as GM live here. Campaigns you've joined as a player sit just below. Use the invite code bar above to join a new one, or hit New Campaign to start your own.",
    placement:       'bottom',
    type:            'info',
    scrollToElement: true,
  },
  // 7 — Characters section header
  {
    target:          '[data-tour="section-characters"]',
    title:           'Character Sheets',
    content:         'All your character sheets live here, one for each game system you play. Create as many as your account allows — each sheet saves automatically as you play.',
    placement:       'bottom',
    type:            'info',
    scrollToElement: true,
  },
  // 8 — Bestiary section header
  {
    target:          '[data-tour="section-bestiary"]',
    title:           'The Bestiary',
    content:         'A library of monsters and creatures for each game system. GMs can create custom monsters, share them with players, and pull them up right at the table.',
    placement:       'bottom',
    type:            'info',
    scrollToElement: true,
  },
  // 9 — Nav trio: chatrooms + ravens + settings as a single spotlighted group
  {
    target:    '[data-tour="nav-trio"]',
    title:     'Community & Account',
    content:   'Chatrooms connects you to public discussions. The Raven Post handles private messages between friends. Settings is where you manage your account and preferences.',
    placement: 'bottom',
    type:      'info',
  },
  // 10 — Stat pills: final step
  {
    target:      '[data-tour="stat-pills"]',
    title:       'Your Dashboard',
    content:     "Your active character sheets and campaigns at a glance. That's the full tour — everything you need to get started. Have fun out there.",
    placement:   'bottom',
    type:        'last',
    scrollToTop: true,
  },
]

const TOTAL_STEPS     = STEPS.length   // 11
const SPOTLIGHT_PAD   = 8              // px of extra space around target rect
const NOT_FOUND_LIMIT = 2000           // ms before skipping a missing-target step

// ─── SpotlightOverlay ─────────────────────────────────────────────────────────
function SpotlightOverlay({ rect, isInteractive }) {
  if (!rect) return null

  const pad = SPOTLIGHT_PAD
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  const sTop    = Math.max(0,  rect.top    - pad)
  const sLeft   = Math.max(0,  rect.left   - pad)
  const sRight  = Math.min(vw, rect.right  + pad)
  const sBottom = Math.min(vh, rect.bottom + pad)
  const sWidth  = sRight  - sLeft
  const sHeight = sBottom - sTop

  const base = {
    position:      'fixed',
    background:    C.overlay,
    pointerEvents: 'all',
    zIndex:        9000,
  }

  return createPortal(
    <>
      {/* Top panel */}
      <div style={{ ...base, top: 0,       left: 0,      right: 0,  height: sTop    }} />
      {/* Bottom panel */}
      <div style={{ ...base, top: sBottom, left: 0,      right: 0,  bottom: 0       }} />
      {/* Left panel */}
      <div style={{ ...base, top: sTop,    left: 0,      width: sLeft,  height: sHeight }} />
      {/* Right panel */}
      <div style={{ ...base, top: sTop,    left: sRight, right: 0,  height: sHeight }} />

      {/* Gold ring around spotlight (never intercepts clicks) */}
      <div style={{
        position:      'fixed',
        top:           sTop,
        left:          sLeft,
        width:         sWidth,
        height:        sHeight,
        border:        `2px solid ${C.ring}`,
        borderRadius:  10,
        pointerEvents: 'none',
        zIndex:        9001,
      }} />

      {/* Transparent click-blocker over spotlight for info/last steps */}
      {!isInteractive && (
        <div style={{
          position:      'fixed',
          top:           sTop,
          left:          sLeft,
          width:         sWidth,
          height:        sHeight,
          pointerEvents: 'all',
          zIndex:        9002,
          background:    'transparent',
        }} />
      )}
    </>,
    document.body
  )
}

// ─── TourTooltip ──────────────────────────────────────────────────────────────
function TourTooltip({ rect, step, stepIndex, totalSteps, onNext, onClose }) {
  const TOOLTIP_W   = 300
  const TOOLTIP_GAP = 14

  const pad = SPOTLIGHT_PAD
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  const sTop     = Math.max(0,  rect.top    - pad)
  const sLeft    = Math.max(0,  rect.left   - pad)
  const sRight   = Math.min(vw, rect.right  + pad)
  const sBottom  = Math.min(vh, rect.bottom + pad)
  const sCenterX = (sLeft + sRight) / 2

  let placement = step.placement || 'bottom'

  // Estimated tooltip height (title + body + footer). Used for overflow checks.
  const TOOLTIP_H_EST = 180

  // Fallbacks when there's not enough room in the preferred direction
  if (placement === 'left'  && sLeft        < TOOLTIP_W + TOOLTIP_GAP + 14)  placement = 'bottom'
  if (placement === 'right' && (vw - sRight) < TOOLTIP_W + TOOLTIP_GAP + 14) placement = 'bottom'
  // If bottom would push the tooltip off-screen, flip to top
  if (placement === 'bottom' && (vh - sBottom) < TOOLTIP_H_EST + TOOLTIP_GAP) placement = 'top'

  let tooltipStyle = {
    position:     'fixed',
    width:        TOOLTIP_W,
    zIndex:       9010,
    background:   C.card,
    border:       `1px solid ${C.border}`,
    borderRadius: 14,
    boxShadow:    '0 8px 32px rgba(0,0,0,0.7)',
    overflow:     'hidden',
  }

  if (placement === 'top' || placement === 'top-start') {
    let leftPos = placement === 'top-start'
      ? sLeft
      : sCenterX - TOOLTIP_W / 2
    leftPos = Math.max(8, Math.min(leftPos, vw - TOOLTIP_W - 8))
    tooltipStyle.bottom = Math.max(8, vh - sTop + TOOLTIP_GAP)
    tooltipStyle.left   = leftPos

  } else if (placement === 'bottom') {
    let leftPos = sCenterX - TOOLTIP_W / 2
    leftPos = Math.max(8, Math.min(leftPos, vw - TOOLTIP_W - 8))
    tooltipStyle.top  = Math.min(sBottom + TOOLTIP_GAP, vh - 8)
    tooltipStyle.left = leftPos

  } else if (placement === 'left') {
    tooltipStyle.top  = Math.max(8, Math.min(sTop, vh - 8))
    tooltipStyle.left = Math.max(8, sLeft - TOOLTIP_W - TOOLTIP_GAP)

  } else if (placement === 'right') {
    tooltipStyle.top  = Math.max(8, Math.min(sTop, vh - 8))
    tooltipStyle.left = Math.min(sRight + TOOLTIP_GAP, vw - TOOLTIP_W - 8)
  }

  const showActionButton = step.type === 'info' || step.type === 'last'
  const buttonLabel      = step.type === 'last' ? 'Finish Tour' : 'Next →'

  return createPortal(
    <div style={tooltipStyle}>
      {/* Gold accent bar */}
      <div style={{
        height:     1,
        background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`,
      }} />

      <div style={{ padding: '16px 18px 18px' }}>
        {/* Header: title + X close */}
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            8,
          marginBottom:   8,
        }}>
          <span style={{
            fontSize:      11,
            fontWeight:    700,
            color:         C.gold,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            lineHeight:    1.3,
          }}>
            {step.title}
          </span>

          <button
            onClick={onClose}
            title="Close tour"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'transparent',
              border:         'none',
              cursor:         'pointer',
              color:          C.muted,
              padding:        '2px',
              borderRadius:   6,
              flexShrink:     0,
              transition:     'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color      = C.text
              e.currentTarget.style.background = C.surface
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color      = C.muted
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body text */}
        <p style={{
          fontSize:   13,
          color:      C.subtext,
          lineHeight: 1.65,
          margin:     0,
        }}>
          {step.content}
        </p>

        {/* Footer: progress indicator + Next/Finish button */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginTop:      14,
        }}>
          <span style={{ fontSize: 10, color: `${C.muted}99` }}>
            {stepIndex + 1} of {totalSteps}
          </span>

          {showActionButton && (
            <button
              onClick={onNext}
              style={{
                background:   C.gold,
                color:        C.bg,
                border:       'none',
                borderRadius: 20,
                padding:      '6px 16px',
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.goldHover }}
              onMouseLeave={e => { e.currentTarget.style.background = C.gold }}
            >
              {buttonLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── TourWelcomeModal ─────────────────────────────────────────────────────────
function TourWelcomeModal({ onAccept, onDecline }) {
  return createPortal(
    <>
      {/* Backdrop */}
      <div style={{
        position:      'fixed',
        inset:         0,
        background:    'rgba(0,0,0,0.55)',
        zIndex:        9020,
        pointerEvents: 'all',
      }} />

      {/* Card — centered */}
      <div style={{
        position:      'fixed',
        top:           '50%',
        left:          '50%',
        transform:     'translate(-50%, -50%)',
        width:         340,
        background:    C.card,
        border:        `1px solid ${C.border}`,
        borderRadius:  18,
        boxShadow:     '0 12px 48px rgba(0,0,0,0.8)',
        overflow:      'hidden',
        zIndex:        9021,
      }}>
        {/* Gold accent bar */}
        <div style={{
          height:     2,
          background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`,
        }} />

        <div style={{ padding: '24px 24px 22px' }}>
          {/* Icon + title */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            12,
            marginBottom:   12,
          }}>
            <div style={{
              width:          38,
              height:         38,
              borderRadius:   10,
              background:     `${C.gold}18`,
              border:         `1px solid ${C.gold}44`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       18,
              flexShrink:     0,
            }}>
              📜
            </div>
            <span style={{
              fontSize:      15,
              fontWeight:    700,
              color:         C.text,
              lineHeight:    1.3,
            }}>
              Welcome to CampaignCodex
            </span>
          </div>

          {/* Body */}
          <p style={{
            fontSize:   13,
            color:      C.subtext,
            lineHeight: 1.7,
            margin:     '0 0 20px',
          }}>
            Want a quick tour? We'll walk you through the DM widget, your profile, campaigns, characters, and more — takes about 60 seconds.
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onDecline}
              style={{
                background:   'transparent',
                border:       `1px solid ${C.border}`,
                borderRadius: 20,
                padding:      '7px 16px',
                fontSize:     12,
                fontWeight:   500,
                color:        C.subtext,
                cursor:       'pointer',
                transition:   'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.muted
                e.currentTarget.style.color       = C.text
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.color       = C.subtext
              }}
            >
              Skip for Now
            </button>

            <button
              onClick={onAccept}
              style={{
                background:   C.gold,
                border:       'none',
                borderRadius: 20,
                padding:      '7px 20px',
                fontSize:     12,
                fontWeight:   700,
                color:        C.bg,
                cursor:       'pointer',
                transition:   'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.goldHover }}
              onMouseLeave={e => { e.currentTarget.style.background = C.gold }}
            >
              Take the Tour →
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── TourManager ──────────────────────────────────────────────────────────────
export default function TourManager() {
  const location       = useLocation()
  const { user }       = useAuth()
  const { widgetOpen } = useDM()
  const {
    run, stepIndex, setStepIndex,
    startTour, stopTour,
    hasSeen, markSeen,
  } = useTour()

  const [targetRect,  setTargetRect]  = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)

  const didAutoPrompt = useRef(false)
  const widgetWasOpen = useRef(false)
  const rafRef        = useRef(null)
  const prevRectRef   = useRef(null)

  // ── Auto-prompt on first /dashboard visit ─────────────────────────────────
  useEffect(() => {
    if (!user || location.pathname !== '/dashboard' || run || showWelcome || didAutoPrompt.current) return
    if (!hasSeen(user.id)) {
      didAutoPrompt.current = true
      const t = setTimeout(() => setShowWelcome(true), 900)
      return () => clearTimeout(t)
    }
  }, [user, location.pathname, run, showWelcome, hasSeen])

  function handleAccept() {
    markSeen(user?.id)
    setShowWelcome(false)
    startTour()
  }

  function handleDecline() {
    markSeen(user?.id)
    setShowWelcome(false)
  }

  // ── Per-step scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!run) return
    const step = STEPS[stepIndex]
    if (!step) return

    if (step.scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (step.scrollToElement) {
      const t = setTimeout(() => {
        const el = document.querySelector(step.target)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 120)
      return () => clearTimeout(t)
    }
  }, [run, stepIndex])

  // ── rAF loop: continuously measure the target element ─────────────────────
  // Uses a timeout-based skip (NOT_FOUND_LIMIT) instead of an immediate skip
  // on the first missing frame. This prevents false skips when a page has just
  // navigated and the new elements haven't rendered yet.
  useEffect(() => {
    if (!run) {
      setTargetRect(null)
      prevRectRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const step = STEPS[stepIndex]
    if (!step) return

    let abandoned = false

    // Skip this step only if the target remains missing for NOT_FOUND_LIMIT ms
    const skipTimer = setTimeout(() => {
      if (!abandoned) {
        setStepIndex(prev => Math.min(prev + 1, TOTAL_STEPS - 1))
      }
    }, NOT_FOUND_LIMIT)

    function measure() {
      if (abandoned) return

      const el = document.querySelector(step.target)
      if (!el) {
        // Keep trying; skip timer handles the eventual timeout
        rafRef.current = requestAnimationFrame(measure)
        return
      }

      // Found — cancel the skip timer
      clearTimeout(skipTimer)

      const r    = el.getBoundingClientRect()
      const prev = prevRectRef.current

      if (
        !prev          ||
        prev.top    !== r.top    ||
        prev.left   !== r.left   ||
        prev.width  !== r.width  ||
        prev.height !== r.height
      ) {
        prevRectRef.current = { top: r.top, left: r.left, width: r.width, height: r.height }
        setTargetRect({
          top:    r.top,
          left:   r.left,
          right:  r.right,
          bottom: r.bottom,
          width:  r.width,
          height: r.height,
        })
      }

      rafRef.current = requestAnimationFrame(measure)
    }

    rafRef.current = requestAnimationFrame(measure)

    return () => {
      abandoned = true
      clearTimeout(skipTimer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [run, stepIndex, setStepIndex])

  // ── Step 0 → 1: widget opened ─────────────────────────────────────────────
  useEffect(() => {
    if (!run || stepIndex !== 0 || !widgetOpen) return
    const t = setTimeout(() => setStepIndex(1), 350)
    return () => clearTimeout(t)
  }, [widgetOpen, run, stepIndex, setStepIndex])

  // ── Step 1 → 2: widget closed (after being open) ──────────────────────────
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

  // ── Step 2 → 3: navigated to /profile/edit ────────────────────────────────
  useEffect(() => {
    if (!run || stepIndex !== 2) return
    if (location.pathname === '/profile/edit') {
      const t = setTimeout(() => setStepIndex(3), 450)
      return () => clearTimeout(t)
    }
  }, [location.pathname, run, stepIndex, setStepIndex])

  // ── Step 5 → 6: returned to /dashboard ────────────────────────────────────
  useEffect(() => {
    if (!run || stepIndex !== 5) return
    if (location.pathname === '/dashboard') {
      const t = setTimeout(() => setStepIndex(6), 450)
      return () => clearTimeout(t)
    }
  }, [location.pathname, run, stepIndex, setStepIndex])

  // ── Next / Finish ──────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (stepIndex >= TOTAL_STEPS - 1) {
      stopTour()
    } else {
      setStepIndex(stepIndex + 1)
    }
  }, [stepIndex, setStepIndex, stopTour])

  // ── Cancel (X button) ─────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    stopTour()
  }, [stopTour])

  // ── Render ────────────────────────────────────────────────────────────────
  const currentStep   = run ? STEPS[stepIndex] : null
  const isInteractive = currentStep?.type === 'interactive'

  return (
    <>
      {showWelcome && (
        <TourWelcomeModal onAccept={handleAccept} onDecline={handleDecline} />
      )}

      {run && currentStep && targetRect && (
        <>
          <SpotlightOverlay
            rect={targetRect}
            isInteractive={isInteractive}
          />
          <TourTooltip
            rect={targetRect}
            step={currentStep}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onNext={handleNext}
            onClose={handleClose}
          />
        </>
      )}
    </>
  )
}
