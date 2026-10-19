// Settings an operator can change without rebuilding the frontend.
// public/config.js defines window.CAMPAIGNCODEX_CONFIG; the container rewrites
// it at startup. When a key is absent we fall back to the build-time flag.
const runtime = window.CAMPAIGNCODEX_CONFIG || {}

export const VTT_ENABLED = typeof runtime.vtt_enabled === 'boolean'
  ? runtime.vtt_enabled
  : import.meta.env.VITE_VTT_ENABLED === 'true'
