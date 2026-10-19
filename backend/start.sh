#!/bin/sh
set -e

# Default port
PORT="${PORT:-8000}"

# Proxies allowed to set X-Forwarded-For / X-Forwarded-Proto (comma-separated
# IPs or CIDR networks). Only these peers can change the client IP the backend
# sees; "*" trusts anyone and is only safe when the backend port is reachable
# exclusively from the proxy.
FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-127.0.0.1,::1}"

echo "============================================"
echo "  DiagramaHub Backend by Alex Dzul"
echo "  Environment: ${APP_ENV:-production}"
echo "  Port: ${PORT}"
echo "============================================"

if [ "${APP_ENV}" = "development" ] || [ "${APP_ENV}" = "dev" ]; then
    echo "Starting in DEVELOPMENT mode (with hot reload)..."
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "${PORT}" \
        --reload \
        --reload-dir /app/app \
        --proxy-headers \
        --forwarded-allow-ips "${FORWARDED_ALLOW_IPS}" \
        --log-level info
else
    echo "Starting in PRODUCTION mode..."
    WORKERS="${WORKERS:-2}"
    echo "Workers: ${WORKERS}"
    exec gunicorn app.main:app \
        --worker-class uvicorn.workers.UvicornWorker \
        --workers "${WORKERS}" \
        --bind "0.0.0.0:${PORT}" \
        --timeout 120 \
        --keep-alive 5 \
        --forwarded-allow-ips "${FORWARDED_ALLOW_IPS}" \
        --access-logfile - \
        --error-logfile - \
        --log-level info
fi
