# Use official Python runtime as base image (Alpine for minimal CVE surface)
# Rebuild regularly to pick up latest Alpine security patches
FROM python:3.13-alpine3.23

# Set working directory
WORKDIR /app

# Upgrade all apk packages to latest patches, then install build dependencies
# required to compile native wheels (cryptography, bcrypt, pillow, uvloop, httptools).
# Runtime libs (libffi, openssl) are kept; only compilers are removed later.
RUN apk update && apk upgrade --no-cache && apk add --no-cache \
    curl \
    libffi \
    openssl \
    && apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    cargo

# Install Poetry (2.x: 1.8.3 and its dulwich dependency carried advisories)
RUN pip install --no-cache-dir poetry==2.5.1

# Install into the system interpreter (no virtualenv). Set as env vars rather
# than `poetry config`, which would be stored in root's home and be invisible
# to the non-root runtime user (`poetry run pytest` would then try to create a venv).
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

# Copy locked dependency manifests
COPY pyproject.toml poetry.lock README.md ./

# Generate lock file and install dependencies
# In production, skip dev dependencies
ARG APP_ENV=production
RUN if [ "$APP_ENV" = "development" ] || [ "$APP_ENV" = "dev" ]; then \
        poetry install --no-interaction --no-ansi --no-root; \
    else \
        poetry install --no-interaction --no-ansi --no-root --only main && \
        pip install --no-cache-dir gunicorn; \
    fi \
    && apk del .build-deps \
    && rm -rf /root/.cache /var/cache/apk/*

# Copy application code
COPY ./app ./app
COPY ./scripts ./scripts
COPY ./start.sh ./start.sh

# Make start script executable
RUN chmod +x ./start.sh

# Run as an unprivileged user. /app is owned by it because the test tooling
# writes there (.pytest_cache, .hypothesis, htmlcov/, coverage.xml).
# UID 1000 matches the usual first host user, so bind-mounted source stays
# writable in development on Linux too.
RUN addgroup -S -g 1000 app && adduser -S -D -u 1000 -G app -h /home/app app \
    && chown -R app:app /app
USER app

# Default environment variables
ENV APP_ENV=${APP_ENV}
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the start script (Alpine ships /bin/sh as busybox ash)
CMD ["/bin/sh", "./start.sh"]
