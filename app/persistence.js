/**
 * Persistence layer for The Well
 *
 * Handles saving/loading Pit state to/from disk with TTL tracking.
 * Each Pit is saved as <slug>.yjs with associated metadata.
 */

import * as Y from 'yjs';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export class PitPersistence {
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
   * Load a Pit from disk or create a new one
   */
  async loadPit(slug) {
    const pitPath = this.getPitPath(slug);
    const ydoc = new Y.Doc();

    try {
      // Try to load from disk
      const data = await fs.readFile(pitPath);
      Y.applyUpdate(ydoc, data);
      console.log(`[Persistence] Loaded pit: ${slug} (${data.length} bytes)`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`[Persistence] Error loading pit ${slug}:`, err);
      }
      // If file doesn't exist, start with empty doc
      console.log(`[Persistence] Created new pit: ${slug}`);
    }

    // Track as active
    this.activePits.set(slug, {
      doc: ydoc,
      lastAccess: Date.now(),
      connections: 0
    });

    return ydoc;
  }

  /**
   * Save a Pit to disk
   */
  async savePit(slug) {
    const pitInfo = this.activePits.get(slug);
    if (!pitInfo) {
      console.warn(`[Persistence] Cannot save non-existent pit: ${slug}`);
      return;
    }

    const pitPath = this.getPitPath(slug);
    const metadataPath = this.getMetadataPath(slug);

    try {
      // Serialize the Yjs document
      const update = Y.encodeStateAsUpdate(pitInfo.doc);

      // Save document
      await fs.writeFile(pitPath, update);

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
    const pitInfo = this.activePits.get(slug);
    if (pitInfo) {
      pitInfo.lastAccess = Date.now();
    }
  }

  /**
   * Increment connection count for a Pit
   */
  incrementConnections(slug) {
    const pitInfo = this.activePits.get(slug);
    if (pitInfo) {
      pitInfo.connections++;
      this.touchPit(slug);
    }
  }

  /**
   * Decrement connection count for a Pit
   */
  async decrementConnections(slug) {
    const pitInfo = this.activePits.get(slug);
    if (pitInfo) {
      pitInfo.connections = Math.max(0, pitInfo.connections - 1);
      this.touchPit(slug);

      // Auto-save when last connection closes
      if (pitInfo.connections === 0) {
        console.log(`[Persistence] Last connection closed for pit: ${slug}, saving...`);
        await this.savePit(slug);
      }
    }
  }

  /**
   * Get Pit document for WebSocket setup
   */
  getPitDoc(slug) {
    const pitInfo = this.activePits.get(slug);
    return pitInfo ? pitInfo.doc : null;
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
   * Stop cleanup interval and save all active pits
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log('[Persistence] Saving all active pits before shutdown...');
    const slugs = Array.from(this.activePits.keys());
    await Promise.all(slugs.map(slug => this.savePit(slug)));
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
