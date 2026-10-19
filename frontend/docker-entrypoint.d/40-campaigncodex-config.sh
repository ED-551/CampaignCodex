#!/bin/sh
# Writes /config.js from environment variables so the prebuilt image can be
# configured per instance. The nginx image runs every script in
# /docker-entrypoint.d/ before starting nginx.
set -e

# Same rule as the backend: only the exact string "true" turns the VTT on.
vtt=false
[ "$VTT_ENABLED" = "true" ] && vtt=true

cat > /usr/share/nginx/html/config.js <<CONFIG
window.CAMPAIGNCODEX_CONFIG = { vtt_enabled: ${vtt} }
CONFIG

echo "campaigncodex: wrote config.js (vtt_enabled=${vtt})"
