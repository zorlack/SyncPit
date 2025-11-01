#!/usr/bin/env node

/**
 * The Well - SyncPit's ephemeral real-time sync daemon
 *
 * Hosts temporary Pits (shared state spaces) via Yjs CRDT over WebSocket.
 * Pits persist to disk with configurable TTL for ephemeral collaboration.
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const Y = require('yjs');
const http = require('http');
const path = require('path');
const { PitPersistence } = require('./persistence.js');

// Configuration from environment
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const PITS_DIR = process.env.PITS_DIR || path.join(__dirname, 'pits');
const PIT_TTL_MINUTES = parseInt(process.env.PIT_TTL_MINUTES || '30', 10);
const CLEANUP_INTERVAL_MINUTES = parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '5', 10);

// Initialize persistence layer
const pitStorage = new PitPersistence({
  pitsDir: PITS_DIR,
  ttlMs: PIT_TTL_MINUTES * 60 * 1000,
  cleanupIntervalMs: CLEANUP_INTERVAL_MINUTES * 60 * 1000
});

// Register persistence with y-websocket
setPersistence({
  bindState: async (docName, ydoc) => {
    console.log(`[Persistence] bindState called for: ${docName}`);

    // Load existing state from disk as binary
    const storedUpdate = await pitStorage.loadPitBinary(docName);

    if (storedUpdate && storedUpdate.length > 0) {
      // Apply stored state to the y-websocket managed document
      Y.applyUpdate(ydoc, storedUpdate);
      console.log(`[Persistence] Loaded ${storedUpdate.length} bytes for pit: ${docName}`);
    } else {
      console.log(`[Persistence] No existing data for pit: ${docName}`);
    }

    // Listen for updates and touch the pit
    ydoc.on('update', (update) => {
      pitStorage.touchPit(docName);
    });
  },
  writeState: async (docName, ydoc) => {
    console.log(`[Persistence] writeState called for: ${docName}`);
    // This is called when the last connection closes
    await pitStorage.savePitFromYDoc(docName, ydoc);
  }
});

// Express app
const app = express();

// Serve static files from the dist/ directory (built by Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// Serve static assets (audio, etc.)
app.use(express.static(path.join(__dirname, 'static')));

// Route: serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Route: serve creator interface
app.get('/pit/:slug/creator', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'creator.html'));
});

// Route: serve viewer interface
app.get('/pit/:slug/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'viewer.html'));
});

// Route: check if a pit exists (HEAD request) - must be before GET /pit/:slug
app.head('/pit/:slug', async (req, res) => {
  const { slug } = req.params;
  if (pitStorage.pitExists(slug)) {
    res.status(200).end();
  } else {
    // Delay 404 responses to prevent scraping/enumeration
    await new Promise(resolve => setTimeout(resolve, 500));
    res.status(404).end();
  }
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
  res.json(pitStorage.getStats());
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server for Yjs
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // y-websocket will handle document management via setPersistence
  setupWSConnection(ws, req);

  // Track connection for stats/monitoring
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docName = url.pathname.slice(1) || 'default';

  console.log(`[Well] Client connected to pit: ${docName}`);
  pitStorage.incrementConnections(docName);

  ws.on('close', async () => {
    console.log(`[Well] Client disconnected from pit: ${docName}`);
    await pitStorage.decrementConnections(docName);
  });
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[Well] Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('[Well] HTTP server closed');
  });

  // Save all pits and cleanup
  await pitStorage.shutdown();

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
