/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel Decorative"', 'serif'],
        body:    ['"Inter"', 'sans-serif'],
        nimble:  ['"Raleway"', 'sans-serif'],
      },
      colors: {
        codex: {
          bg:        '#0a0b0f',
          surface:   '#12141a',
          card:      '#1a1d26',
          border:    '#2a2d3a',
          muted:     '#4a4f63',
          text:      '#c8ccd8',
          subtext:   '#6b7280',
          gold:      '#c9a84c',
          goldHover: '#e0bb5f',
          crimson:   '#8b1a1a',
          glow:      'rgba(201,168,76,0.15)',
        },
        // ─── Shadowdark sheet theme — black & white dungeon ─────────────────
        // High-contrast monochrome. White as the accent (no gold).
        // codex-subtext maps to sd-subtext; codex-gold maps to sd-gold (white).
        sd: {
          bg:      '#080808',  // near-true black
          surface: '#111111',  // input/inner surfaces
          card:    '#1a1a1a',  // section card background
          border:  '#303030',  // subtle dark borders
          muted:   '#555555',  // muted icons and labels
          text:    '#d8d8d8',  // off-white body text (easier on eyes than pure white)
          subtext: '#777777',  // secondary / placeholder text
          gold:    '#ffffff',  // primary accent — pure white (no gold)
        },
        // ─── Nimble RPG sheet theme — forest verdant ─────────────────────────
        // Backgrounds are genuinely dark forest green (not near-black).
        // Raleway font via font-nimble. Numbers in bright lime.
        ni: {
          bg:      '#0a0b0f',  // site standard dark — green cards float on near-black
          surface: '#0f1d14',  // deep forest — dark input fields inside cards
          card:    '#1d3d2a',  // forest interior — unmistakably green card
          border:  '#2d6b3f',  // vivid bark border — clearly visible green
          muted:   '#3a8550',  // canopy mid-tone
          text:    '#d4f0dd',  // light green-white — clearly not neutral white
          sub:     '#7dcf99',  // bright sage — totally unlike warm amber
          gold:    '#4ade80',  // lime-400 — bright, vivid, unmistakably forest
        },
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        glow: '0 0 32px rgba(201,168,76,0.18)',
      },
    },
  },
  plugins: [],
}
