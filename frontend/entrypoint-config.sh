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

# ---------------------------------------------------------------------------
# Content-Security-Policy (on by default; CSP_ENABLED=false turns it off).
#
# connect-src is built from the real runtime values: the API origin from
# VITE_API_URL and, when Sentry is configured, the origin of its DSN. A
# relative or empty VITE_API_URL means the API is same-origin ('self').
#   script/style/font/worker cdn.jsdelivr.net — Monaco loads from jsDelivr
#   style-src 'unsafe-inline'                — Mermaid styles inside its SVGs
#   img-src https:                           — profile pictures (Google)
#   frame-ancestors 'none'                   — the app is never framed...
#   ...except /embed/<token> (csp-embed.conf): CSP_EMBED_FRAME_ANCESTORS,
#      default '*'; the page itself refuses links whose owner didn't opt in.
# CSP_CONNECT_SRC_EXTRA adds space-separated origins (e.g. a proxy).
# ---------------------------------------------------------------------------
dh_origin() {
    # scheme://host[:port] of a URL, empty when the value isn't absolute.
    printf '%s' "$1" | sed -n 's#^\(https\{0,1\}://\)\([^@/]*@\)\{0,1\}\([^/?#]*\).*#\1\3#p'
}

CSP_FILE=/etc/nginx/csp/csp.conf
CSP_EMBED_FILE=/etc/nginx/csp/csp-embed.conf
if [ "${CSP_ENABLED:-true}" = "false" ]; then
    : > "$CSP_FILE"
    : > "$CSP_EMBED_FILE"
else
    connect_src="'self'"
    api_origin=$(dh_origin "${VITE_API_URL:-http://localhost:5172}")
    [ -n "$api_origin" ] && connect_src="$connect_src $api_origin"
    sentry_origin=$(dh_origin "${VITE_SENTRY_DSN:-}")
    [ -n "$sentry_origin" ] && connect_src="$connect_src $sentry_origin"
    [ -n "${CSP_CONNECT_SRC_EXTRA:-}" ] && connect_src="$connect_src ${CSP_CONNECT_SRC_EXTRA}"
    # Only origin characters may reach the header (no quotes, ';' or newlines).
    connect_src=$(printf '%s' "$connect_src" | tr -cd "A-Za-z0-9:/.*' _-")

    embed_ancestors=$(printf '%s' "${CSP_EMBED_FRAME_ANCESTORS:-*}" | tr -cd "A-Za-z0-9:/.*' _-")

    dh_csp() {
        # $1: frame-ancestors value
        printf '%s\n' "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src ${connect_src}; worker-src 'self' blob: https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors $1\" always;"
    }
    dh_csp "'none'" > "$CSP_FILE"
    dh_csp "$embed_ancestors" > "$CSP_EMBED_FILE"
fi
