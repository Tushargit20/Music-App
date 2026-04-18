# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching optimization)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# ── Stage 2: Runtime ──────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create a non-root user for security
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Copy node_modules from builder
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Set environment
ENV NODE_ENV=production
ENV PORT=80

# Expose port 80 (as required by deployment rules)
EXPOSE 80

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:80/api/health || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "backend/server.js"]
