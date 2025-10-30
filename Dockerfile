# The Well - SyncPit Docker Image
FROM node:20-alpine AS builder

# Accept version as build arg
ARG VERSION=0.0.0-dev

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Update package.json version
RUN sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

# Install ALL dependencies (including devDependencies for Vite build)
RUN npm ci

# Copy source files needed for Vite build
COPY app/client ./client
COPY app/vite.config.js ./

# Build client with Vite (skip prebuild hook since version is already set)
RUN npx vite build

# Production image
FROM node:20-alpine

# Accept version as build arg
ARG VERSION=0.0.0-dev

# Create non-root user
RUN addgroup -g 1001 -S syncpit && \
    adduser -S syncpit -u 1001

WORKDIR /app

# Copy package files and install production dependencies only
COPY app/package*.json ./

# Update package.json version
RUN sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

RUN npm ci --only=production

# Copy application files
COPY --chown=syncpit:syncpit app/welld.js ./
COPY --chown=syncpit:syncpit app/persistence.js ./

# Copy built client from builder
COPY --from=builder --chown=syncpit:syncpit /app/dist ./dist

# Copy static assets (audio, etc.)
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
