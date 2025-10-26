# The Well - SyncPit Docker Image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production image
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S syncpit && \
    adduser -S syncpit -u 1001

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=syncpit:syncpit /app/node_modules ./node_modules

# Copy application files
COPY --chown=syncpit:syncpit app/package*.json ./
COPY --chown=syncpit:syncpit app/welld.js ./
COPY --chown=syncpit:syncpit app/persistence.js ./
COPY --chown=syncpit:syncpit app/static ./static

# Create pits directory
RUN mkdir -p pits && chown syncpit:syncpit pits

# Switch to non-root user
USER syncpit

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    PITS_DIR=/app/pits \
    PIT_TTL_MINUTES=30 \
    CLEANUP_INTERVAL_MINUTES=5

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
CMD ["node", "welld.js"]
