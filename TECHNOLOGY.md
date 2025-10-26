# Technology

## The Stack at a Glance

| Layer | Tool | Role | Reason |
|--------|------|------|--------|
| **Real‑time State** | **Yjs (CRDT)** | Maintains shared document state across clients | Deterministic convergence, offline‑tolerant, battle‑tested. |
| **Transport** | **WebSocket / y‑websocket** | Streams binary updates between The Well and connected clients | Simple, bi‑directional, supported everywhere. |
| **Web Framework** | **Express (Node.js)** | Serves static assets and upgrades connections | Lightweight, easy to extend. |
| **Persistence** | **Local Filesystem (.yjs)** | Stores serialized Pit state | Zero dependency, human‑portable. |
| **Runtime** | **Docker Compose** | Orchestrates the single‑service Well locally | Fast to boot, zero infrastructure. |
| **Frontend** | **HTML5 Canvas + JS** | Renders the Pit UI for drawing and viewing | Works on any modern browser, low latency. |

---

## The Well’s Layers

### 1. Network
The Well exposes an HTTP endpoint for static assets and upgrades incoming WebSocket requests to Yjs protocol channels. Each PitSlug maps to one active Yjs document in memory. The WebSocket layer also enforces rate limits and connection quotas.

### 2. Sync
All shared data lives inside Yjs documents. Each mutation in a Pit (a stroke, an erase, a note) becomes a binary update propagated to all clients. Yjs handles ordering, conflict resolution, and merge semantics — The Well simply relays bytes.

### 3. Persistence
The Well serializes each document using `Y.encodeStateAsUpdate(doc)` and saves it to `/pits/<slug>.yjs`. These snapshots can be re‑hydrated at startup or downloaded for replay. This local persistence keeps everything inspectable and offline‑capable.

### 4. User Interface
The Creator and Viewer interfaces are HTML5 Canvas applications that talk directly to the Yjs provider. The Creator emits drawing events; the Viewer listens for document updates and re‑renders automatically.

### 5. Runtime and Container
The entire system runs as a single Node.js container managed by Docker Compose. This allows full local reproducibility: one command spins up The Well, static assets, and live sync relay.

---

## The Flow of Data
1. **Input** — The Creator draws on a canvas; pointer events become coordinate data.
2. **Document Update** — The client writes to the Yjs document (`strokes.push([...])`).
3. **Transport** — The Yjs WebSocket provider sends a compact binary delta.
4. **Relay** — The Well receives and broadcasts the update to all connected clients of that Pit.
5. **Merge** — Each client applies the delta via Yjs merge logic.
6. **Render** — The Viewer’s canvas updates instantly.

This end‑to‑end loop completes in under 150 ms on a normal LAN.

---

## Why These Choices
- **Yjs** gives deterministic, conflict‑free state sync with built‑in delta compression.
- **WebSocket** is ubiquitous and trivial to host locally — no signaling servers or TURN needed.
- **Express** is a minimal, reliable baseline with the fewest moving parts.
- **Local FS persistence** makes Pits tangible: you can open a `.yjs` file, back it up, or diff it.
- **Docker Compose** abstracts away all environment quirks — anyone can run The Well with one command.

---

## Future Substitutions
| Layer | Candidate | Motivation |
|--------|------------|-------------|
| Real‑time | **Automerge** | Simpler CRDT with native Rust core. |
| Transport | **WebTransport (HTTP/3)** | Lower latency, datagram support. |
| Persistence | **Redis Streams** | Rolling log storage and replay. |
| Runtime | **Kubernetes / Cloudflare DO** | Scalable multi‑Pit hosting. |
| Framework | **Fastify / Bun / Deno** | Higher performance Node alternatives. |

---

## Interoperability Philosophy
The Well uses open protocols and self‑contained documents. Any service that can speak the Yjs binary protocol can act as a Well node. A Go, Rust, or Bun implementation could interoperate without translation.

---

## Monitoring and Protection Hooks
- **Rate and volume limits** enforced at the WebSocket layer.  
- **Pit size and lifetime caps** enforced during persistence.  
- **Metrics**: ops/sec, bytes/sec, connection counts, disk usage.  
- **Quotas**: per‑IP buckets for create, connect, and update volume.  
These ensure that nobody can use The Well for free bulk storage or bandwidth extraction.

---

## Tech Tree Summary
| Layer | Tool | Role | Future Alternative |
|--------|------|------|-------------------|
| Real‑time | Yjs | CRDT engine | Automerge |
| Transport | WebSocket | Sync channel | WebTransport |
| Web App | Express | Host & relay | Fastify |
| Persistence | Local FS (.yjs) | Snapshots | Redis Streams |
| Runtime | Docker Compose | Local orchestration | Kubernetes |

---

## Ethos
We pick tools that run anywhere, work offline, and don’t ask permission.  
The Well doesn’t care what machine it’s on — only that it syncs.

> _If it speaks Yjs and keeps time, it belongs in The Well._

