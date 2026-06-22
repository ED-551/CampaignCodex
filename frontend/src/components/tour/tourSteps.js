/**
 * tourSteps.js — onboarding tour step definitions for react-joyride.
 *
 * Each step targets a `data-tour="..."` attribute on a DOM element.
 *
 * Interactive steps (0, 1, 2, 5): hideFooter + per-step styles hide the
 * footer entirely. The user must click the highlighted element; TourManager
 * auto-advances via state watchers (widgetOpen, location.pathname).
 *
 * Informational steps (3, 4, 6-9): only a Next button is shown. Back is
 * hidden globally via buttonBack: { display: 'none' } in JOYRIDE_STYLES.
 *
 * The beacon (pulsing dot) is made non-interactive globally via
 * pointerEvents: 'none' so it never intercepts clicks meant for the target.
 */

// Shared style override for steps that must not show any footer buttons.
const NO_FOOTER = {
  tooltipFooter: { display: 'none' },
}

export const TOUR_STEPS = [
  // ── Step 0: DM chat bubble ───────────────────────────────────────────────
  // No overlay (see TourManager). No footer. Beacon is invisible to clicks.
  // Tour auto-advances when widgetOpen becomes true.
  {
    target:          '[data-tour="dm-bubble"]',
    title:           'Direct Messages',
    content:         'Your messages hub. Direct messages, your friends list, and friend requests are all in here. Click the bubble to open it.',
    placement:       'top-start',
    spotlightClicks: true,
    disableBeacon:   true,
    hideFooter:      true,
    styles:          NO_FOOTER,
  },

  // ── Step 1: DM widget panel ──────────────────────────────────────────────
  // No overlay. No footer. Tooltip floats to the left of the full panel so
  // it doesn't overlap the widget tabs.
  // Tour auto-advances when widgetOpen becomes false (after being true).
  {
    target:          '[data-tour="dm-panel"]',
    title:           'Minimize the Widget',
    content:         'Take a look at the three tabs — DMs, Friends, and Requests. Click the ✕ at the top right to tuck the panel back into its icon.',
    placement:       'left',
    spotlightClicks: true,
    hideFooter:      true,
    styles:          NO_FOOTER,
  },

  // ── Step 2: Profile link ─────────────────────────────────────────────────
  // Spotlight lets the user click their name. No footer.
  // Tour auto-advances when location.pathname becomes /profile/edit.
  {
    target:          '[data-tour="profile-link"]',
    title:           'Your Profile',
    content:         'Click your name to edit your profile, pick a theme, and set your gaming preferences.',
    placement:       'bottom',
    spotlightClicks: true,
    hideFooter:      true,
    styles:          NO_FOOTER,
  },

  // ── Step 3: Display name + role + games (on /profile/edit) ──────────────
  {
    target:        '[data-tour="profile-display"]',
    title:         'Name & Role',
    content:       'Choose whether to show just your username or include your first name. Set your preferred role — Player, GM, or both — and pick the games you\'re interested in.',
    placement:     'right',
    disableBeacon: true,
  },

  // ── Step 4: Profile theme (on /profile/edit) ────────────────────────────
  {
    target:    '[data-tour="profile-theme"]',
    title:     'Profile Theme',
    content:   'Pick a color scheme for your profile card. Use the Preview button at the top of the page to see how it looks before saving.',
    placement: 'top',
  },

  // ── Step 5: Back button (on /profile/edit) ───────────────────────────────
  // Spotlight lets the user click ← Back. No footer.
  // Tour auto-advances when location.pathname returns to /dashboard.
  {
    target:          '[data-tour="profile-back"]',
    title:           'Head Back',
    content:         'All done here? Click ← Back at the top of the page to return to the dashboard and continue the tour.',
    placement:       'bottom',
    spotlightClicks: true,
    hideFooter:      true,
    styles:          NO_FOOTER,
  },

  // ── Step 6: Chatrooms nav link ───────────────────────────────────────────
  {
    target:        '[data-tour="nav-chatrooms"]',
    title:         'Chatrooms',
    content:       'Find other players and GMs, get help, ask questions, and join community discussions in the public chatrooms.',
    placement:     'bottom',
    disableBeacon: true,
  },

  // ── Step 7: Raven Post nav link ──────────────────────────────────────────
  {
    target:    '[data-tour="nav-ravens"]',
    title:     'The Raven Post',
    content:   'Send private letters and share character sheets directly with your friends.',
    placement: 'bottom',
  },

  // ── Step 8: Settings nav link ────────────────────────────────────────────
  {
    target:    '[data-tour="nav-settings"]',
    title:     'Account Settings',
    content:   'Adjust your preferences, review the Terms of Service, and manage your account.',
    placement: 'bottom',
  },

  // ── Step 9: Stat pills — final informational step ────────────────────────
  {
    target:    '[data-tour="stat-pills"]',
    title:     'Your Dashboard',
    content:   'Your active character sheets and campaigns at a glance. Scroll down to create characters, manage campaigns, and explore the Bestiary for each game system. That\'s the tour — have fun out there.',
    placement: 'bottom',
  },
]

// ─── Joyride style tokens ─────────────────────────────────────────────────────
// Matches the app's dark codex theme. backgroundColor is set both in options
// (for Joyride's internal logic) and directly on tooltip (as a hard override
// so no CSS reset or Tailwind class can make it white).
export const JOYRIDE_STYLES = {
  options: {
    arrowColor:      '#1a1d26',
    backgroundColor: '#1a1d26',
    overlayColor:    'rgba(0, 0, 0, 0.55)',
    primaryColor:    '#c9a84c',
    spotlightShadow: '0 0 0 2px rgba(201,168,76,0.25)',
    textColor:       '#c8ccd8',
    width:           320,
    zIndex:          2000,
  },
  tooltip: {
    backgroundColor: '#1a1d26',   // hard override — prevents white flash
    padding:         '20px 24px',
    borderRadius:    '14px',
    border:          '1px solid #2a2d3a',
    boxShadow:       '0 4px 24px rgba(0,0,0,0.6)',
  },
  tooltipTitle: {
    fontSize:      '11px',
    fontWeight:    '700',
    color:         '#c9a84c',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom:  '8px',
  },
  tooltipContent: {
    fontSize:   '13px',
    lineHeight: '1.65',
    padding:    '0',
    color:      '#6b7280',
  },
  tooltipFooter: {
    marginTop:      '16px',
    gap:            '8px',
    justifyContent: 'flex-end',
  },
  buttonNext: {
    backgroundColor: '#c9a84c',
    color:           '#0a0b0f',
    borderRadius:    '8px',
    fontSize:        '12px',
    fontWeight:      '600',
    padding:         '7px 16px',
    border:          'none',
    cursor:          'pointer',
  },
  // Back button hidden globally — tour is always forward-only.
  buttonBack: {
    display: 'none',
  },
  buttonSkip: {
    color:      '#4a4f63',
    fontSize:   '11px',
    background: 'transparent',
    border:     'none',
    cursor:     'pointer',
  },
  buttonClose: {
    color:   '#4a4f63',
    padding: '8px',
  },
  spotlight: {
    borderRadius: '10px',
  },
  // Beacon is made non-interactive: it appears as a visual indicator only.
  // Clicks on it pass through to the actual target element underneath.
  beaconInner: {
    backgroundColor: '#c9a84c',
    pointerEvents:   'none',
  },
  beaconOuter: {
    borderColor:      '#c9a84c',
    backgroundColor:  'rgba(201,168,76,0.2)',
    pointerEvents:    'none',
  },
}
