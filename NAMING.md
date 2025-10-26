# Naming

This document explains the naming scheme used across **SyncPit** and its runtime daemon **The Well**, why each name exists, and how it fits the system’s structure and tone.

---

## Project Identity

**SyncPit** is the public identity — the product, repository, and service that users interact with.  
**The Well** is the runtime process that actually hosts all Pits.

| Scope | Role | Description |
|--------|------|--------------|
| **SyncPit** | Project | The full ecosystem — code, UI, docs, and web service. |
| **The Well** | Runtime Daemon | The process that orchestrates and synchronizes Pits. |
| **Pit** | Instance | A temporary shared state pocket within The Well. |

Use **SyncPit** when speaking about the overall project (branding, repository, documentation).  
Use **The Well** when describing the running system, its architecture, and behavior.

---

## The Well
**The Well** is the system itself — the substrate, daemon, or orchestration layer that hosts all Pits.

It’s not “a server” in the usual sense; it’s a **persistent but indifferent process**.  
The name comes from the image of a dark, self-sustaining depth: it holds things temporarily,  
then swallows them when their time is up.

**Why “The Well”:**
- Evokes depth, permanence, and indifference.  
- Feels ancient and mechanical rather than corporate or cloud.  
- Implies that things fall into it and disappear — exactly what happens when a Pit is closed.

---

## The Pit
A **Pit** is an ephemeral, collaborative sync space — one instance of shared state inside The Well.

You **start a pit**, **jump into a pit**, and **bail** when you’re done.  
The name suggests energy, noise, and chaos: a mosh pit of data and users.  
It deliberately contrasts with the calm, detached tone of The Well.

**Why “Pit”:**
- Physical and visceral — feels lived-in and temporary.  
- Suggests containment: a bounded space where things happen.  
- Aligns with the system’s verbs (`start`, `jump`, `bail`) and punk-rock tone.

---

## The PitSlug
The **PitSlug** is the six-character alphanumeric code that names each Pit.

It’s short, human, and ugly — something you can yell across a room or write on a napkin.  
A slug isn’t secure; it’s a label, not a key.  
It identifies, but it doesn’t authenticate.

**Why “PitSlug”:**
- “Slug” implies a simple identifier, like a URL slug, but also carries street-level grit.  
- Six characters strike a balance between randomness and memorability.  
- Reinforces the disposable nature of each Pit.

Example:
```
4QZ8RK
```

---

## The PitToken
The **PitToken** is the signed capability link that grants access to a Pit.

Tokens are cryptographically valid but socially casual — passed around like backdoor passes.  
They expire, burn, and vanish.

**Why “PitToken”:**
- The formal, technical term for a capability key, wrapped in the project’s world.  
- A natural contrast with the informal PitSlug: _slug_ is the name, _token_ is the proof.  
- Invokes the “velvet rope” idea — if you have the token, you’re past the bouncer.

Example:
```
https://thewell.local/pit/4QZ8RK#eyJhbGciOi...
```

---

## The Link
A **Link** is shorthand for a shared PitToken — something you *drop*.

It’s casual, almost dismissive: dropping a link doesn’t mean “invite your friends”;  
it means “here’s a doorway, walk in if you dare.”

**Why “Link”:**
- Keeps the everyday language natural.  
- Implies exposure, not invitation.  
- Makes sense in documentation, speech, and UI without extra explanation.

---

## The Verbs
| Verb | Meaning | Reasoning |
|------|----------|-----------|
| **Start** | Create a new Pit. | Action-oriented, clean, technical. |
| **Jump** | Join an existing Pit. | Physical, energetic, no ceremony. |
| **Bail** | Leave a Pit. | Anti-corporate tone; feels human. |
| **Drop** | Share a PitToken. | Matches “drop a link” — casual exposure, not formality. |

---

## Design Principles
1. **Clarity through attitude.**  
   Every term is both literal and stylized — readable for developers, memorable for humans.

2. **No corporate language.**  
   No “session,” “room,” or “workspace.” Those belong to productivity software.  
   These belong to street-level dataworkers.

3. **Symmetry with purpose.**  
   Each name aligns to a layer:
   ```
   SyncPit   → project identity
   The Well  → runtime substrate
   Pit       → shared state instance
   PitSlug   → short code
   PitToken  → access key
   Link      → shareable form
   ```

4. **Minimal ceremony.**  
   One word per idea. Short, direct, lowercase in code.

---

## Summary
| Concept | Role | Example | Tone |
|----------|------|----------|------|
| **SyncPit** | Project / product | `syncpit.local` | Cohesive, public-facing |
| **The Well** | System / runtime | `welld` | Deep, indifferent |
| **Pit** | Shared instance | `pit start` | Chaotic, collaborative |
| **PitSlug** | Identifier | `4QZ8RK` | Ugly, human |
| **PitToken** | Capability link | `https://thewell.local/pit/4QZ8RK#…` | Exclusive, cryptic |
| **Link** | Shared form of a token | “Drop a link.” | Casual, social |
| **Drop / Jump / Bail** | Verbs of motion | CLI verbs | Punk, active |

---

> _Names are half the interface.  
> These ones earn their keep._

