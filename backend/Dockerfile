# Use official Python runtime as base image
FROM python:3.11-slim-bookworm

# Set working directory
WORKDIR /app

# Install system dependencies and apply security patches
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

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
    fi

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

# Run the start script
CMD ["sh", "./start.sh"]
