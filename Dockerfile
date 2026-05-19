# Multi-stage build for optimal image size and security
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (like sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

# SQLite requires runtime system libraries sometimes, keep it lean
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Environment variables defaults
ENV PORT=3000
ENV DATABASE_PATH=/app/data/solpilot.db
ENV NODE_ENV=production

# Create volume target for SQLite database persistence
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
