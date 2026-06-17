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
        body: ['"Inter"', 'sans-serif'],
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
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        glow: '0 0 32px rgba(201,168,76,0.18)',
      },
    },
  },
  plugins: [],
}
