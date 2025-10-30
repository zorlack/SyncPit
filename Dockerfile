# The Well - SyncPit Docker Image
FROM node:20-alpine AS builder

# Install git for version detection
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Install ALL dependencies (including devDependencies for Vite build)
RUN npm ci

# Copy .git directory for version detection
COPY .git ./.git

# Copy version sync script
COPY app/scripts ./scripts

# Copy source files needed for Vite build
COPY app/client ./client
COPY app/vite.config.js ./

# Build client with Vite (prebuild hook will sync version)
RUN npm run build

# Production image
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S syncpit && \
    adduser -S syncpit -u 1001

WORKDIR /app

# Copy package files and install production dependencies only
COPY app/package*.json ./
RUN npm ci --only=production

# Copy application files
COPY --chown=syncpit:syncpit app/welld.js ./
COPY --chown=syncpit:syncpit app/persistence.js ./

# Copy built client from builder
COPY --from=builder --chown=syncpit:syncpit /app/dist ./dist

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
