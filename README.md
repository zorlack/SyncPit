# SyncPit

> **Draw fast. Sync faster. Bail whenever. Leave no trace.**

---

## Overview

**SyncPit** is an ephemeral real-time whiteboard and shared-state system.  
It’s built for people who want to collaborate instantly — without accounts, history, or ceremony.  
You start a Pit, share a link, create together, and bail when you’re done.  
When the last participant leaves, the data disappears. The Well forgets.

**SyncPit** is not a platform. It’s a disposable surface — fast, direct, and temporary.

---

## Goals

### 1. Frictionless Creation
Open a browser, start drawing, and everything you do syncs live.  
No authentication, no setup, no project management layer.  
SyncPit exists to eliminate overhead between an idea and its expression.

### 2. One-Click Sharing
When you start a Pit, you can drop a link.  
Anyone with that link can **jump in** and watch or participate, depending on permissions.  
It’s not an invite — it’s exposure.  
Share the moment, not the infrastructure.

### 3. Ephemeral by Design
Nothing persists unless you decide it should.  
Each Pit lives only while it’s in use.  
When everyone bails, it collapses — no logs, no history, no analytics, no ghosts.

### 4. Local First, Cloud Optional
The MVP runs entirely via **Docker Compose** — one container, no dependencies.  
It stores temporary state locally and forgets it on demand.  
The system can later scale up, but it begins self-contained, fast, and easy to run anywhere.

### 5. Minimal Infrastructure, Maximum Flow
The Well (the backend process) does one thing: it keeps participants in sync.  
It doesn’t interpret, optimize, or analyze — it just moves state between clients quickly and fairly.  
Everything else — creation tools, replay, authentication — is optional layering.

---

## How It Works

- **The Well** is the runtime daemon that hosts every Pit.  
- Each **Pit** is a temporary shared state pocket that lives inside The Well.  
- A **PitSlug** identifies each Pit — six characters, ugly, human, disposable.  
- A **PitToken** is a capability link that grants access.  
- A **Link** is how you share that token — you _drop_ it so others can _jump_ in.

Participants connect over WebSocket, syncing live through a CRDT engine.  
The Well relays all changes instantly to connected clients.  
No data leaves the Well unless explicitly shared.  
When a Pit dies, it’s gone — even the Well doesn’t remember.

---

## Execution Philosophy

1. **Speed is everything.**  
   Every millisecond between movement and mirror matters.  
   SyncPit optimizes for perceived immediacy, not theoretical throughput.

2. **No user accounts. No tracking. No ads.**  
   Every participant is transient; identity is implicit in presence.

3. **Simplicity wins.**  
   The architecture favors readability and reproducibility.  
   A single service, transparent design, no opaque cloud stack.

4. **Disposable by default.**  
   The Well forgets automatically.  
   Storage is temporary, local, and minimal.

5. **Honest about its limits.**  
   SyncPit doesn’t pretend to be a productivity suite.  
   It’s a place for bursts of collaboration — drawing, thinking, sharing — not permanent archives.

---

## What It’s For

- Explaining an idea in real time without sharing your screen.
- Drawing on a tablet while others watch via Meet or Zoom.
- Hosting transient collaborative sessions with zero setup.
- Giving live feedback during brainstorming or design sprints.
- Teaching, sketching, or diagramming — then letting it vanish.

---

## What It’s Not

- A replacement for Miro, Figma, or Google Docs.
- A storage system or productivity suite.
- A social network.
- A surveillance tool.

SyncPit is for moments — not memory.

---

## The Ethos

> _Start a Pit. Drop a Link. Jump in. Bail when it gets weird._

There’s no persistence, no accounts, no marketing copy pretending otherwise.  
Just sync — fast, simple, and temporary.