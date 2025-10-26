# The Well — Requirements

## Overview

**The Well** is a lightweight, real-time system for shared state — a substrate that hosts temporary sync spaces called **Pits**.  
Each Pit is ephemeral: it flickers to life when someone starts it and collapses when everyone bails.  
The system is designed for frictionless creation and observation — a person can start a Pit on one device and stream it live into another.

The MVP runs locally using **Docker Compose** and consists of a single service that:

- Hosts the web interfaces for both **Creators** (who start Pits) and **Viewers** (who jump into them).  
- Relays and records the shared state of each Pit using **Yjs** (CRDT).  
- Persists each Pit’s state to local disk as a binary `.yjs` file.  
- Enforces limits to prevent abuse and resource exhaustion.

---

## Core Technology Choices

| Layer | Technology | Rationale |
|--------|-------------|-----------|
| Real-time data layer | **Yjs** (CRDT) | Conflict-free synchronization for multi-writer Pits. |
| Transport | **WebSocket** (`y-websocket` protocol) | Lightweight, bi-directional sync layer. |
| Web framework | **Express** (Node.js) | Simple static hosting and WebSocket upgrade handling. |
| Storage | Local filesystem (`/pits/*.yjs`) | Local persistence of Pit state for replay. |
| Containerization | Docker Compose | One-command local runtime. |
| Frontend | HTML5 Canvas + JS | Fast prototype for drawing and state visualization. |

---

## Functional Requirements

### 1. Pit Lifecycle
- A **Pit** is a Yjs document keyed by a **PitSlug** (six-character code).  
- Pits can be started, joined, and deleted.  
- Pits are saved to `/pits/` as `<slug>.yjs` when active.  
- Each Pit may have one or more connected clients, but a single authority may act as the **Creator**.  
- Pit state is loaded on demand and auto-saved after updates.

### 2. Creator & Viewer Interfaces
- **Creator UI**
  - Fullscreen drawing surface (Canvas) with pen and color tools.
  - Emits strokes and updates into the shared Yjs doc.
- **Viewer UI**
  - Mirrors the Pit’s state in real time.
  - Automatically receives Yjs updates.
  - No write privileges.

### 3. Networking
- Sync occurs exclusively via the Yjs WebSocket protocol.  
- Viewers joining mid-stream automatically receive the full Pit state.  
- Each WebSocket connection is associated with one PitSlug.  
- Pits may be addressed as `/pit/<slug>?role=creator|viewer`.

### 4. Persistence
- Each Pit’s CRDT state is serialized periodically with `Y.encodeStateAsUpdate()`.
- Saved to disk as `<slug>.yjs` under `/pits/`.
- The Well loads snapshots at startup and rehydrates them lazily.
- Optional HTTP endpoint exposes the binary snapshot for replay.

### 5. Replay (future)
- The Well may later log Yjs update deltas in JSONL for time-based replay.
- Playback UI reconstructs a Pit frame by frame.

---

## Security & Abuse Protections

### 1. Change & Volume Constraints
| Constraint | Description |
|-------------|--------------|
| **Change Rate** | Limit CRDT updates per connection (e.g., 100 ops/min). Disconnect violators. |
| **Change Volume** | Limit total bytes of updates per minute (e.g., 200 KB/min). |
| **Pit Size** | Cap total encoded doc size (e.g., 5 MB). Further writes rejected. |
| **Pit Count** | Cap total saved Pits (e.g., 100). Oldest Pits evicted. |

### 2. Creation & Retrieval Controls
| Constraint | Description |
|-------------|--------------|
| **New Pit Creation** | Gate creation behind capability tokens or IP quotas. |
| **Pit Retrieval** | Rate-limit snapshot downloads and WebSocket joins per IP. |
| **Connection Limits** | Restrict concurrent WS sessions per IP (e.g., 10). |
| **Idle Expiration** | Auto-bail idle Pits after 30 minutes. |

### 3. Global Quotas
- Implement per-IP leaky bucket metrics: `ops_per_min`, `bytes_per_min`, `pits_created`, `connections_active`.
- Track and enforce within The Well runtime.

### 4. Abuse Mitigation
- Reject updates exceeding size threshold (e.g., 64 KB).
- Cap memory usage per Pit.
- Strip or block large binary blobs or encoded images.
- Serve snapshots with cache headers; rate-limit external pulls.
- Optionally block datacenter IPs or VPN ranges from anonymous use.

---

## Non-Functional Requirements

| Category | Requirement |
|-----------|-------------|
| **Performance** | Median latency <150 ms; join-to-first-render <1.5 s |
| **Storage** | `/pits` limited to ~500 MB by default |
| **Reliability** | CRDT state must survive temporary disconnects |
| **Security** | HTTPS for deployment, signed **PitTokens** for access |
| **Observability** | Log ops/sec, bytes/sec, Pit count, memory usage |
| **Scalability (future)** | Migrate from local FS → Redis Streams → object storage |

---

## Optional Future Features

1. **Multi-writer Pits** — full collaborative editing with concurrent cursors.  
2. **Text and image layers** — shared Yjs maps for richer content.  
3. **Replay engine** — temporal scrubbing and export.  
4. **Cloud Well** — distributed hosting of Pits.  
5. **Authentication & API keys** — user-level quotas and billing.  
6. **WebRTC or WebTransport** — peer-to-peer sync for lower latency.  
7. **Observatory** — live metrics dashboard for The Well.

---

## Directory Layout

```
app/
├─ welld.js            # Express + y-websocket daemon (The Well)
├─ persistence.js      # Pit load/save helpers
├─ static/
│   ├─ creator.html
│   ├─ viewer.html
│   └─ app.js
└─ pits/               # Stored .yjs documents
Dockerfile
docker-compose.yml
requirements.md
```

---

## Example Constraints (Suggested Defaults)

| Setting | Default | Purpose |
|----------|----------|----------|
| `MAX_PIT_SIZE_BYTES` | 5 MB | Prevent bulk data storage |
| `MAX_NEW_PITS_PER_IP_PER_HOUR` | 10 | Prevent creation spam |
| `MAX_CONNECTIONS_PER_IP` | 10 | Prevent fan-out abuse |
| `MAX_UPDATE_BYTES_PER_MIN` | 200 KB | Prevent flooding |
| `IDLE_PIT_TIMEOUT_MIN` | 30 | Free idle resources |
| `TOTAL_PIT_CAP` | 100 | Disk budget control |

---

## Summary

The Well is a minimal, CRDT-based substrate.  
Each Pit is a temporary pocket of sync, identified by a **PitSlug**, secured by a **PitToken**, and exposed through a **Link**.  
When everyone bails, The Well forgets.

> _Start a Pit. Drop a Link. Jump in. Bail when it gets weird._