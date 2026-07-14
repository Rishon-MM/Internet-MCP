# ── Build stage ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ── Runtime stage ────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=mcp:mcp /app/dist/ ./dist/
COPY --from=builder --chown=mcp:mcp /app/node_modules/ ./node_modules/
COPY --from=builder --chown=mcp:mcp /app/package.json ./

USER mcp

# Default to HTTP transport in Docker
ENV TRANSPORT=http
ENV HTTP_PORT=3000
ENV LOG_LEVEL=info
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
