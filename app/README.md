# The Well - MVP Implementation

An in-memory WebSocket server for SyncPit with persistence and TTL.

## Features

- Real-time drawing sync via Yjs CRDT over WebSocket
- Persistent storage with configurable TTL (time-to-live)
- Automatic cleanup of expired sessions
- Creator and Viewer interfaces
- Stats endpoint for monitoring

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or use watch mode for development
npm run dev
```

The server starts on `http://localhost:3000`

## Testing

Open two browser windows:

**Window 1 - Creator:**
```
http://localhost:3000/pit/test123/creator
```

**Window 2 - Viewer:**
```
http://localhost:3000/pit/test123/viewer
```

Draw in the Creator window and watch it sync in real-time to the Viewer!

## Testing Persistence

1. Draw something in the Creator
2. Close both browser windows
3. Check that files were saved: `ls -la pits/`
4. Reopen the Creator - your drawing should be restored!

## Configuration

Create a `.env` file or set environment variables:

```bash
# Server settings
PORT=3000
HOST=localhost

# Persistence settings
PITS_DIR=./pits
PIT_TTL_MINUTES=30              # Pits expire after 30 minutes of inactivity
CLEANUP_INTERVAL_MINUTES=5      # Check for expired pits every 5 minutes
```

## Endpoints

- `GET /` - Static file server
- `GET /pit/:slug/creator` - Creator interface
- `GET /pit/:slug/viewer` - Viewer interface
- `GET /health` - Health check
- `GET /stats` - Server statistics and active pits
- `WS /` - WebSocket endpoint for Yjs sync (with `?room=<slug>`)

## How It Works

1. **Persistence**: Each Pit is saved as `<slug>.yjs` (binary Yjs document) and `<slug>.meta.json` (metadata)
2. **TTL Tracking**: Last access time is tracked and updated on each connection/update
3. **Auto-cleanup**: A background job runs every 5 minutes to delete expired pits
4. **Auto-save**: Pits are saved automatically when the last connection closes
5. **Graceful shutdown**: Ctrl+C saves all active pits before exiting

## Architecture

```
app/
├── welld.js           # Express + WebSocket server
├── persistence.js     # Pit persistence with TTL
├── static/
│   ├── creator.html   # Drawing interface
│   └── viewer.html    # Read-only viewer
└── pits/              # Persisted pit files
    ├── *.yjs          # Binary Yjs documents
    └── *.meta.json    # Metadata (TTL, size, etc)
```

## File Formats

**Binary Document (`*.yjs`):**
- Yjs CRDT state encoded as binary
- Can be loaded directly into a Yjs document
- Portable and version-agnostic

**Metadata (`*.meta.json`):**
```json
{
  "slug": "test123",
  "lastAccess": 1761508523678,
  "lastSaved": 1761508523684,
  "sizeBytes": 2048,
  "connections": 0
}
```

## Monitoring

Check server stats:
```bash
curl http://localhost:3000/stats | json_pp
```

Returns:
```json
{
  "totalPits": 2,
  "ttlMs": 1800000,
  "pitsDir": "./pits",
  "pits": [
    {
      "slug": "test123",
      "lastAccess": 1761508511270,
      "connections": 1,
      "age": 8459
    }
  ]
}
```

## Troubleshooting

**Warning: "Yjs was already imported"**
- This is expected when using y-websocket
- Does not affect functionality for this MVP
- Can be ignored for now

**Pits not persisting:**
- Check `PITS_DIR` exists and is writable
- Check console logs for save errors
- Verify `PIT_TTL_MINUTES` is long enough

**Cleanup not working:**
- Check `CLEANUP_INTERVAL_MINUTES` setting
- Watch console logs for cleanup messages
- Use `/stats` endpoint to verify lastAccess times
