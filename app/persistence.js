/**
 * Persistence layer for The Well
 *
 * Handles saving/loading Pit state to/from disk with TTL tracking.
 * Each Pit is saved as <slug>.yjs with associated metadata.
 */

const Y = require('yjs');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

class PitPersistence {
  constructor(options = {}) {
    this.pitsDir = options.pitsDir || './pits';
    this.ttlMs = options.ttlMs || 30 * 60 * 1000; // Default: 30 minutes
    this.cleanupIntervalMs = options.cleanupIntervalMs || 5 * 60 * 1000; // Default: 5 minutes

    // In-memory tracking of active pits
    this.activePits = new Map(); // slug -> { doc, lastAccess, connections }

    // Ensure pits directory exists
    this.ensurePitsDir();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  ensurePitsDir() {
    if (!fsSync.existsSync(this.pitsDir)) {
      fsSync.mkdirSync(this.pitsDir, { recursive: true });
      console.log(`[Persistence] Created pits directory: ${this.pitsDir}`);
    }
  }

  getPitPath(slug) {
    return path.join(this.pitsDir, `${slug}.yjs`);
  }

  getMetadataPath(slug) {
    return path.join(this.pitsDir, `${slug}.meta.json`);
  }

  /**
   * Load a Pit's binary data from disk
   */
  async loadPitBinary(slug) {
    const pitPath = this.getPitPath(slug);

    try {
      // Try to load from disk
      const data = await fs.readFile(pitPath);
      return data;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`[Persistence] Error loading pit ${slug}:`, err);
      }
      // If file doesn't exist, return null
      return null;
    }
  }


  /**
   * Save a Pit from a Yjs document instance (used by y-websocket)
   */
  async savePitFromYDoc(slug, ydoc) {
    const pitPath = this.getPitPath(slug);
    const metadataPath = this.getMetadataPath(slug);

    try {
      // Serialize the Yjs document
      const update = Y.encodeStateAsUpdate(ydoc);

      // Save document
      await fs.writeFile(pitPath, update);

      // Get or create pit info for metadata
      let pitInfo = this.activePits.get(slug);
      if (!pitInfo) {
        // Create tracking entry if it doesn't exist
        pitInfo = { lastAccess: Date.now(), connections: 0 };
        this.activePits.set(slug, pitInfo);
      }

      // Save metadata
      const metadata = {
        slug,
        lastAccess: pitInfo.lastAccess,
        lastSaved: Date.now(),
        sizeBytes: update.length,
        connections: pitInfo.connections
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`[Persistence] Saved pit: ${slug} (${update.length} bytes, ${pitInfo.connections} connections)`);
    } catch (err) {
      console.error(`[Persistence] Error saving pit ${slug}:`, err);
    }
  }

  /**
   * Update last access time for a Pit
   */
  touchPit(slug) {
    let pitInfo = this.activePits.get(slug);
    if (!pitInfo) {
      // Create tracking entry if it doesn't exist
      pitInfo = { lastAccess: Date.now(), connections: 0 };
      this.activePits.set(slug, pitInfo);
    }
    pitInfo.lastAccess = Date.now();
  }

  /**
   * Increment connection count for a Pit
   */
  incrementConnections(slug) {
    let pitInfo = this.activePits.get(slug);
    if (!pitInfo) {
      pitInfo = { lastAccess: Date.now(), connections: 0 };
      this.activePits.set(slug, pitInfo);
    }
    pitInfo.connections++;
    this.touchPit(slug);
  }

  /**
   * Decrement connection count for a Pit
   */
  async decrementConnections(slug) {
    const pitInfo = this.activePits.get(slug);
    if (pitInfo) {
      pitInfo.connections = Math.max(0, pitInfo.connections - 1);
      this.touchPit(slug);

      // Note: y-websocket will call writeState which triggers savePitFromYDoc
    }
  }


  /**
   * Check if a Pit has expired based on TTL
   */
  isPitExpired(pitInfo) {
    const age = Date.now() - pitInfo.lastAccess;
    return age > this.ttlMs && pitInfo.connections === 0;
  }

  /**
   * Delete a Pit from memory and disk
   */
  async deletePit(slug) {
    const pitPath = this.getPitPath(slug);
    const metadataPath = this.getMetadataPath(slug);

    try {
      // Remove from memory
      this.activePits.delete(slug);

      // Remove from disk
      await Promise.all([
        fs.unlink(pitPath).catch(() => {}),
        fs.unlink(metadataPath).catch(() => {})
      ]);

      console.log(`[Persistence] Deleted expired pit: ${slug}`);
    } catch (err) {
      console.error(`[Persistence] Error deleting pit ${slug}:`, err);
    }
  }

  /**
   * Clean up expired Pits
   */
  async cleanupExpiredPits() {
    const now = Date.now();
    const expiredSlugs = [];

    for (const [slug, pitInfo] of this.activePits.entries()) {
      if (this.isPitExpired(pitInfo)) {
        expiredSlugs.push(slug);
      }
    }

    if (expiredSlugs.length > 0) {
      console.log(`[Persistence] Cleaning up ${expiredSlugs.length} expired pit(s)...`);
      await Promise.all(expiredSlugs.map(slug => this.deletePit(slug)));
    }
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredPits().catch(err => {
        console.error('[Persistence] Cleanup error:', err);
      });
    }, this.cleanupIntervalMs);

    console.log(`[Persistence] Cleanup interval started (every ${this.cleanupIntervalMs / 1000}s, TTL: ${this.ttlMs / 1000}s)`);
  }

  /**
   * Stop cleanup interval
   * Note: y-websocket automatically calls writeState when connections close,
   * so manual saving is not needed during shutdown.
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log('[Persistence] Shutdown complete');
  }

  /**
   * Get statistics about active pits
   */
  getStats() {
    const pits = Array.from(this.activePits.entries()).map(([slug, info]) => ({
      slug,
      lastAccess: info.lastAccess,
      connections: info.connections,
      age: Date.now() - info.lastAccess
    }));

    return {
      totalPits: this.activePits.size,
      ttlMs: this.ttlMs,
      pitsDir: this.pitsDir,
      pits
    };
  }
}

module.exports = { PitPersistence };
