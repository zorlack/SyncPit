#!/usr/bin/env node

/**
 * The Well - SyncPit's ephemeral real-time sync daemon
 *
 * Hosts temporary Pits (shared state spaces) via Yjs CRDT over WebSocket.
 * Pits persist to disk with configurable TTL for ephemeral collaboration.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { PitPersistence } from './persistence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const PITS_DIR = process.env.PITS_DIR || path.join(__dirname, 'pits');
const PIT_TTL_MINUTES = parseInt(process.env.PIT_TTL_MINUTES || '30', 10);
const CLEANUP_INTERVAL_MINUTES = parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '5', 10);

// Initialize persistence layer
const persistence = new PitPersistence({
  pitsDir: PITS_DIR,
  ttlMs: PIT_TTL_MINUTES * 60 * 1000,
  cleanupIntervalMs: CLEANUP_INTERVAL_MINUTES * 60 * 1000
});

// Express app
const app = express();

// Serve static files from the static/ directory
app.use(express.static(path.join(__dirname, 'static')));

// Route: serve creator interface
app.get('/pit/:slug/creator', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'creator.html'));
});

// Route: serve viewer interface
app.get('/pit/:slug/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'viewer.html'));
});

// Route: redirect bare pit URLs to creator by default
app.get('/pit/:slug', (req, res) => {
  res.redirect(`/pit/${req.params.slug}/creator`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'The Well' });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json(persistence.getStats());
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server for Yjs
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
  // Extract pit slug from URL path (y-websocket sends room name as path)
  // Example: /alpha -> 'alpha', /test123 -> 'test123'
  const docName = req.url.slice(1).split('?')[0] || 'default';

  console.log(`[Well] WebSocket URL: ${req.url}`);
  console.log(`[Well] Extracted room name: ${docName}`);
  console.log(`[Well] Client connected to pit: ${docName}`);

  try {
    // Load or create the pit document
    await persistence.loadPit(docName);

    // Increment connection count
    persistence.incrementConnections(docName);

    // Setup Yjs WebSocket connection with custom document getter
    setupWSConnection(ws, req, {
      docName,
      gc: true,
      // Provide our document instead of letting y-websocket create its own
      getYDoc: (docName) => {
        const doc = persistence.getPitDoc(docName);
        if (!doc) {
          console.error(`[Well] Document not found for pit: ${docName}`);
        }
        return doc;
      }
    });

    // Get the document for event handling
    const doc = persistence.getPitDoc(docName);

    // Handle updates to trigger saves
    const updateHandler = async (update, origin) => {
      if (origin !== null) { // Don't save on initial sync
        persistence.touchPit(docName);
        // Debounced save will happen on disconnect or during cleanup
      }
    };

    doc.on('update', updateHandler);

    ws.on('close', async () => {
      console.log(`[Well] Client disconnected from pit: ${docName}`);

      // Clean up
      doc.off('update', updateHandler);

      // Decrement connection count and auto-save if needed
      await persistence.decrementConnections(docName);
    });
  } catch (err) {
    console.error(`[Well] Error setting up connection for pit ${docName}:`, err);
    ws.close();
  }
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[Well] Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('[Well] HTTP server closed');
  });

  // Save all pits and cleanup
  await persistence.shutdown();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
server.listen(PORT, HOST, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║           The Well is running          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`  → http://${HOST}:${PORT}`);
  console.log(`  → Pits directory: ${PITS_DIR}`);
  console.log(`  → TTL: ${PIT_TTL_MINUTES} minutes`);
  console.log(`  → Cleanup interval: ${CLEANUP_INTERVAL_MINUTES} minutes`);
  console.log('');
  console.log('Try these URLs:');
  console.log(`  Creator: http://${HOST}:${PORT}/pit/test123/creator`);
  console.log(`  Viewer:  http://${HOST}:${PORT}/pit/test123/viewer`);
  console.log(`  Stats:   http://${HOST}:${PORT}/stats`);
  console.log('');
});
