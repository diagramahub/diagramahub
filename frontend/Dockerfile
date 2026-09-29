# Multi-stage Dockerfile for the DiagramaHub frontend.
#
# Two runnable targets:
#   development — Vite dev server with HMR; docker-compose mounts the source
#                 code over /app/src for hot reload (local development).
#   production  — static build served by Nginx as a non-root user. No source
#                 code, no dev dependencies, no HMR.
#
# Build one target explicitly:
#   docker build --target development -t diagramahub-frontend ./frontend
#   docker build --target production  -t diagramahub-frontend ./frontend
#
# docker-compose selects the target per deployment mode (see deploy/).

# ---------- Shared base: Node + pnpm, always patched ----------
FROM node:24-alpine AS base

# Upgrade all apk packages to latest patches (picks up OpenSSL and other
# Alpine security fixes that lag behind the base image tag). Rebuild regularly.
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# ---------- Dependencies (shared by development and build) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- Development: Vite dev server + HMR ----------
FROM deps AS development
COPY . .
EXPOSE 5173
CMD ["pnpm", "exec", "vite", "--host"]

# ---------- Build: static production bundle ----------
FROM deps AS build

# Vite bakes VITE_* values into the bundle at build time. The application
# code falls back to http://localhost:5172 when VITE_API_URL is unset, so
# the defaults below preserve the previous behaviour.
ARG VITE_API_URL=http://localhost:5172
ARG VITE_SENTRY_DSN=
ARG VITE_APP_ENV=production
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_APP_ENV=${VITE_APP_ENV}

COPY . .
RUN pnpm run build

# ---------- Production: static assets served by Nginx (non-root) ----------
# nginxinc/nginx-unprivileged runs as the unprivileged `nginx` user by
# default. We switch back to root only to patch the OS and copy the
# configuration, then drop privileges again. Nginx listens on 5173 (a high
# port, allowed for non-root) so host port mappings and managed platforms
# configured for the previous image keep working unchanged.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

USER root
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY headers.conf /etc/nginx/conf.d/headers.conf
# Runtime configuration generator. The base image entrypoint sources
# /docker-entrypoint.d/*.sh before starting Nginx; it runs as the nginx
# user, so the config.js file it rewrites is chown'd below.
COPY entrypoint-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown nginx:nginx /usr/share/nginx/html/config.js
USER nginx

EXPOSE 5173

# 127.0.0.1 instead of localhost: busybox wget resolves localhost to ::1
# first and fails hard when the listener is IPv4-only.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5173/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
