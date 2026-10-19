// Runtime settings for this instance. The Docker image overwrites this file
// at container start from environment variables (see docker-entrypoint.d/),
// so one prebuilt image works for every self-hoster. Values left undefined
// fall back to the VITE_* build-time variables — see src/utils/runtimeConfig.js.
window.CAMPAIGNCODEX_CONFIG = {}
