# Use official Python runtime as base image (Alpine for minimal CVE surface)
# Rebuild regularly to pick up latest Alpine security patches
FROM python:3.13-alpine3.22

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

# Install Poetry
RUN pip install --no-cache-dir poetry==1.8.3

# Copy poetry configuration files
COPY pyproject.toml ./

# Configure poetry to not create virtual environment
RUN poetry config virtualenvs.create false

# Generate lock file and install dependencies
# In production, skip dev dependencies
ARG APP_ENV=production
RUN if [ "$APP_ENV" = "development" ] || [ "$APP_ENV" = "dev" ]; then \
        poetry lock --no-interaction --no-ansi && \
        poetry install --no-interaction --no-ansi --no-root; \
    else \
        poetry lock --no-interaction --no-ansi && \
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
