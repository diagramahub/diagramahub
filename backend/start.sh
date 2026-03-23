#!/bin/sh
set -e

# Default port
PORT="${PORT:-8000}"

echo "============================================"
echo "  DiagramaHub Backend by Alex Dzul"
echo "  Environment: ${APP_ENV:-production}"
echo "  Port: ${PORT}"
echo "============================================"
echo "DEBUG: JWT_SECRET is set: $([ -n \"$JWT_SECRET\" ] && echo 'YES' || echo 'NO')"
echo "DEBUG: MONGO_URI is set: $([ -n \"$MONGO_URI\" ] && echo 'YES' || echo 'NO')"
echo "DEBUG: Total env vars: $(env | wc -l)"

if [ "${APP_ENV}" = "development" ] || [ "${APP_ENV}" = "dev" ]; then
    echo "Starting in DEVELOPMENT mode (with hot reload)..."
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "${PORT}" \
        --reload \
        --reload-dir /app/app \
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
        --access-logfile - \
        --error-logfile - \
        --log-level info
fi
