#!/bin/sh
# DiagramaHub runtime configuration generator.
#
# Sourced by the nginx-unprivileged image entrypoint from /docker-entrypoint.d/
# at container start (before Nginx launches), running as the unprivileged
# `nginx` user. It writes /config.js — the file the SPA loads before its
# bundle — so VITE_* values can be configured per deployment without
# rebuilding the image. The target file is chown'd to nginx in the Dockerfile.
dh_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

API_URL=$(dh_escape "${VITE_API_URL:-http://localhost:5172}")
SENTRY_DSN=$(dh_escape "${VITE_SENTRY_DSN:-}")
APP_ENV=$(dh_escape "${VITE_APP_ENV:-production}")

cat > /usr/share/nginx/html/config.js <<EOF
window.__DH_CONFIG__ = {
  API_URL: "${API_URL}",
  SENTRY_DSN: "${SENTRY_DSN}",
  APP_ENV: "${APP_ENV}",
};
EOF
