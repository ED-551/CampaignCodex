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
 *  - TourWelcomeModal  : unchanged welcome prompt shown on first /dashboard visit.
 *  - TourManager       : top-level orchestrator. Drives auto-advance logic
 *                        (widgetOpen, location.pathname). Measures target
 *                        element via rAF loop.
 *
 * Step types:
 *  interactive — user must click the target element; no Next button;
 *                overlay allows clicks through the spotlight.
 *  info        — user reads then clicks Next; spotlight is click-blocked.
 *  last        — same as info but button reads "Finish Tour".
 *
 * Auto-advance (via TourContext state watchers, same as before):
 *  Step 0 → 1: widgetOpen becomes true  → 350ms delay → setStepIndex(1)
 *  Step 1 → 2: widgetOpen becomes false (after open) → 350ms → setStepIndex(2)
 *  Step 2 → 3: pathname becomes /profile/edit → 450ms → setStepIndex(3)
 *  Step 5 → 6: pathname returns to /dashboard → 450ms → setStepIndex(6)
 *  Steps 3,4,6,7,8: Next button → setStepIndex(n+1)
 *  Step 9: Finish button → stopTour()
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
// type: 'interactive' | 'info' | 'last'
const STEPS = [
  // 0
  {
    target:    '[data-tour="dm-bubble"]',
    title:     'Direct Messages',
    content:   'Your messages hub. Direct messages, your friends list, and friend requests are all in here. Click the bubble to open it.',
    placement: 'top-start',
    type:      'interactive',
  },
  // 1
  {
    target:    '[data-tour="dm-panel"]',
    title:     'Minimize the Widget',
    content:   'Take a look at the three tabs — DMs, Friends, and Requests. Click the ✕ at the top right to tuck the panel back into its icon.',
    placement: 'left',
    type:      'interactive',
  },
  // 2
  {
    target:    '[data-tour="profile-link"]',
    title:     'Your Profile',
    content:   'Click your name to edit your profile, pick a theme, and set your gaming preferences.',
    placement: 'bottom',
    type:      'interactive',
  },
  // 3
  {
    target:    '[data-tour="profile-display"]',
    title:     'Name & Role',
    content:   "Choose whether to show just your username or include your first name. Set your preferred role — Player, GM, or both — and pick the games you're interested in.",
    placement: 'right',
    type:      'info',
  },
  // 4
  {
    target:    '[data-tour="profile-theme"]',
    title:     'Profile Theme',
    content:   'Pick a color scheme for your profile card. Use the Preview button at the top of the page to see how it looks before saving.',
    placement: 'top',
    type:      'info',
  },
  // 5
  {
    target:    '[data-tour="profile-back"]',
    title:     'Head Back',
    content:   'All done here? Click ← Back at the top of the page to return to the dashboard and continue the tour.',
    placement: 'bottom',
    type:      'interactive',
  },
  // 6
  {
    target:    '[data-tour="nav-chatrooms"]',
    title:     'Chatrooms',
    content:   'Find other players and GMs, get help, ask questions, and join community discussions in the public chatrooms.',
    placement: 'bottom',
    type:      'info',
  },
  // 7
  {
    target:    '[data-tour="nav-ravens"]',
    title:     'The Raven Post',
    content:   'Send private letters and share character sheets directly with your friends.',
    placement: 'bottom',
    type:      'info',
  },
  // 8
  {
    target:    '[data-tour="nav-settings"]',
    title:     'Account Settings',
    content:   'Adjust your preferences, review the Terms of Service, and manage your account.',
    placement: 'bottom',
    type:      'info',
  },
  // 9
  {
    target:    '[data-tour="stat-pills"]',
    title:     'Your Dashboard',
    content:   "Your active character sheets and campaigns at a glance. Scroll down to create characters, manage campaigns, and explore the Bestiary for each game system. That's the tour — have fun out there.",
    placement: 'bottom',
    type:      'last',
  },
]

const TOTAL_STEPS = STEPS.length

// ─── Padding added around the target rect for the spotlight cutout ─────────────
const SPOTLIGHT_PADDING = 8

// ─── SpotlightOverlay ─────────────────────────────────────────────────────────
/**
 * Renders the four-panel donut overlay + optional spotlight blocker + gold ring.
 * Mounts into document.body via createPortal so it always covers the full viewport.
 *
 * Props:
 *  rect          {DOMRect | null} — current bounding box of the target element.
 *                                   If null, covers the entire screen (no cutout).
 *  isInteractive {boolean}        — if true, clicks pass through the spotlight gap;
 *                                   if false, a transparent blocker covers the gap.
 */
function SpotlightOverlay({ rect, isInteractive }) {
  if (!rect) return null

  const pad = SPOTLIGHT_PADDING
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  // Spotlight bounds (clamped to viewport)
  const sTop    = Math.max(0, rect.top    - pad)
  const sLeft   = Math.max(0, rect.left   - pad)
  const sRight  = Math.min(vw, rect.right  + pad)
  const sBottom = Math.min(vh, rect.bottom + pad)
  const sWidth  = sRight - sLeft
  const sHeight = sBottom - sTop

  const panelStyle = {
    position:      'fixed',
    background:    C.overlay,
    pointerEvents: 'all',
    zIndex:        9000,
  }

  return createPortal(
    <>
      {/* ── Four dark panels surrounding the spotlight ── */}

      {/* Top panel */}
      <div style={{ ...panelStyle, top: 0, left: 0, right: 0, height: sTop }} />

      {/* Bottom panel */}
      <div style={{ ...panelStyle, top: sBottom, left: 0, right: 0, bottom: 0 }} />

      {/* Left panel (between top and bottom panels) */}
      <div style={{ ...panelStyle, top: sTop, left: 0, width: sLeft, height: sHeight }} />

      {/* Right panel (between top and bottom panels) */}
      <div style={{ ...panelStyle, top: sTop, left: sRight, right: 0, height: sHeight }} />

      {/* ── Gold ring around spotlight (pointer-events: none so it never blocks clicks) ── */}
      <div
        style={{
          position:      'fixed',
          top:           sTop,
          left:          sLeft,
          width:         sWidth,
          height:        sHeight,
          border:        `2px solid ${C.ring}`,
          borderRadius:  10,
          pointerEvents: 'none',
          zIndex:        9001,
        }}
      />

      {/* ── Transparent blocker over the spotlight for info/last steps ── */}
      {/* Prevents the user from clicking the highlighted element. */}
      {!isInteractive && (
        <div
          style={{
            position:      'fixed',
            top:           sTop,
            left:          sLeft,
            width:         sWidth,
            height:        sHeight,
            pointerEvents: 'all',
            zIndex:        9002,
            background:    'transparent',
          }}
        />
      )}
    </>,
    document.body
  )
}

// ─── TourTooltip ──────────────────────────────────────────────────────────────
/**
 * Dark card tooltip positioned relative to the spotlight.
 *
 * Placement logic:
 *  top / top-start → tooltip sits 14px above the spotlight top edge.
 *  bottom          → tooltip sits 14px below the spotlight bottom edge.
 *  left            → tooltip right edge sits 14px left of the spotlight.
 *                    Falls back to bottom if horizontal space < (TOOLTIP_W + gap + 14).
 *  right           → tooltip left edge sits 14px right of the spotlight.
 *
 * All positions are clamped to stay within the viewport with 8px margin.
 */
function TourTooltip({ rect, step, stepIndex, totalSteps, onNext, onClose }) {
  const TOOLTIP_W   = 300
  const TOOLTIP_GAP = 14

  const pad = SPOTLIGHT_PADDING
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  // Spotlight edges (same computation as SpotlightOverlay)
  const sTop     = Math.max(0, rect.top    - pad)
  const sLeft    = Math.max(0, rect.left   - pad)
  const sRight   = Math.min(vw, rect.right  + pad)
  const sBottom  = Math.min(vh, rect.bottom + pad)
  const sCenterX = (sLeft + sRight) / 2

  let placement = step.placement || 'bottom'

  // Resolve left → bottom fallback if there's not enough horizontal space
  if (placement === 'left' && sLeft < TOOLTIP_W + TOOLTIP_GAP + 14) {
    placement = 'bottom'
  }

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
    // Anchor the bottom edge of the tooltip to (sTop - gap).
    // Using CSS `bottom` (distance from viewport bottom) avoids needing to
    // know tooltip height upfront.
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
        {/* Header row: title + X */}
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

          {/* X close button */}
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

        {/* Footer: progress + action button */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginTop:      14,
        }}>
          {/* Progress indicator */}
          <span style={{ fontSize: 10, color: `${C.muted}99` }}>
            {stepIndex + 1} of {totalSteps}
          </span>

          {/* Next / Finish button — only on info and last steps */}
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
/**
 * Welcome prompt shown once on first /dashboard visit.
 * Dark card with gold title, two action buttons.
 */
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

// ─── TourManager ──────────────────────────────────────────────────────────────
/**
 * Top-level orchestrator. Mounts outside <Routes> so it persists across
 * page navigations. Must render inside <BrowserRouter> (needs useLocation).
 */
export default function TourManager() {
  const location       = useLocation()
  const { user }       = useAuth()
  const { widgetOpen } = useDM()
  const {
    run, stepIndex, setStepIndex,
    startTour, stopTour,
    hasSeen, markSeen,
  } = useTour()

  // Bounding rect of the current step's target element.
  // Updated continuously via rAF while the tour is running.
  const [targetRect, setTargetRect] = useState(null)

  // Whether to show the welcome modal
  const [showWelcome, setShowWelcome] = useState(false)

  const didAutoPrompt  = useRef(false)
  const widgetWasOpen  = useRef(false)
  const rafRef         = useRef(null)
  // Cached previous rect values for change-detection — avoids thrashing React
  // with setState on every animation frame when the element hasn't moved.
  const prevRectRef    = useRef(null)

  // ── Auto-prompt: first ever visit to /dashboard ────────────────────────────
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

  // ── rAF loop: continuously measure the target element ─────────────────────
  useEffect(() => {
    if (!run) {
      setTargetRect(null)
      prevRectRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const step = STEPS[stepIndex]
    if (!step) return

    function measure() {
      const el = document.querySelector(step.target)
      if (!el) {
        // Target not in DOM — skip to next step gracefully
        setStepIndex(prev => prev + 1)
        return
      }

      const r    = el.getBoundingClientRect()
      const prev = prevRectRef.current

      // Only update state if the rect has actually changed
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [run, stepIndex, setStepIndex])

  // ── Step 0 → 1: auto-advance when DM widget opens ─────────────────────────
  useEffect(() => {
    if (!run || stepIndex !== 0 || !widgetOpen) return
    const t = setTimeout(() => setStepIndex(1), 350)
    return () => clearTimeout(t)
  }, [widgetOpen, run, stepIndex, setStepIndex])

  // ── Step 1 → 2: auto-advance when DM widget closes ────────────────────────
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

  // ── Step 2 → 3: auto-advance when user navigates to /profile/edit ─────────
  useEffect(() => {
    if (!run || stepIndex !== 2) return
    if (location.pathname === '/profile/edit') {
      const t = setTimeout(() => setStepIndex(3), 450)
      return () => clearTimeout(t)
    }
  }, [location.pathname, run, stepIndex, setStepIndex])

  // ── Step 5 → 6: auto-advance when user returns to /dashboard ──────────────
  useEffect(() => {
    if (!run || stepIndex !== 5) return
    if (location.pathname === '/dashboard') {
      const t = setTimeout(() => setStepIndex(6), 450)
      return () => clearTimeout(t)
    }
  }, [location.pathname, run, stepIndex, setStepIndex])

  // ── Next / Finish handler (info + last steps) ──────────────────────────────
  const handleNext = useCallback(() => {
    if (stepIndex >= TOTAL_STEPS - 1) {
      stopTour()
    } else {
      setStepIndex(stepIndex + 1)
    }
  }, [stepIndex, setStepIndex, stopTour])

  // ── Close (X) handler ─────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    stopTour()
  }, [stopTour])

  // ── Render ─────────────────────────────────────────────────────────────────
  const currentStep   = run ? STEPS[stepIndex] : null
  const isInteractive = currentStep?.type === 'interactive'

  return (
    <>
      {/* Welcome modal — shown before the tour starts */}
      {showWelcome && (
        <TourWelcomeModal onAccept={handleAccept} onDecline={handleDecline} />
      )}

      {/* Tour overlay + tooltip — only while run is true and rect is known */}
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
