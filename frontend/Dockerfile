# Development stage
FROM node:20-alpine

# Upgrade all apk packages to latest patches (picks up OpenSSL and other
# Alpine security fixes that lag behind the base image tag). Rebuild regularly.
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host"]
