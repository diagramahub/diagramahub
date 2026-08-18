# Development stage
FROM node:24-alpine

# Upgrade all apk packages to latest patches (picks up OpenSSL and other
# Alpine security fixes that lag behind the base image tag). Rebuild regularly.
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start development server
CMD ["pnpm", "exec", "vite", "--host"]
