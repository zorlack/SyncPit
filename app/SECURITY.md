# Security Policy

## Overview

**SyncPit is not a secure system.** It is designed as a simple, ephemeral collaboration tool with **no authentication, no authorization, and no privacy guarantees**. This document outlines the security characteristics and limitations of SyncPit.

## Threat Model

SyncPit is designed for casual, temporary collaboration where privacy and security are **not** requirements. Think of it like a public whiteboard in a coffee shop—anyone who knows where it is can see it and draw on it.

### What SyncPit Is NOT

- **Not private**: Pits are not encrypted. Anyone with network access can see the data.
- **Not authenticated**: There is no user authentication. Anyone can claim any handle.
- **Not authorized**: There are no access controls. Anyone with a pit code can view and modify content.
- **Not tamper-proof**: There is no integrity checking. Malicious actors can inject arbitrary content.
- **Not secure**: Do not use SyncPit for sensitive data, proprietary information, or anything you wouldn't write on a public whiteboard.

## Known Security Limitations

### 1. Pit Enumeration

While the `/stats` endpoint no longer exposes pit IDs (slugs), **pit codes can still be enumerated** through other means:

- **Brute force**: Pit codes are 8-character alphanumeric strings (36^8 ≈ 2.8 trillion combinations). While large, this space could be brute-forced with sufficient resources.
- **HEAD requests**: The `/pit/:slug` HEAD endpoint reveals whether a pit exists (returns 200) or not (returns 404).
- **Timing attacks**: Response times may reveal information about pit existence.
- **Network sniffing**: Pit codes are transmitted in URLs and can be intercepted on unsecured networks.

**Recommendation**: If you need privacy, run your own SyncPit instance on a private network or localhost.

### 2. No Authentication

- Users can set any handle they want. There is no verification.
- Anyone can impersonate anyone else by setting the same handle.
- There is no concept of "ownership" of a pit.

### 3. No Authorization

- All pits are read-write for anyone with the pit code.
- There is no distinction between "creators" and "viewers" at the data level (the UI distinction is purely cosmetic).
- Anyone can join, modify, or delete content.

### 4. Data Persistence

- Pits are persisted to disk and remain accessible until they expire (default: 30 minutes after the last connection).
- Anyone who discovers an old pit code can access its content before it expires.
- Deleted pits may leave traces in logs or backups.

### 5. No Rate Limiting

- There is no rate limiting on requests, making the system vulnerable to:
  - Denial of Service (DoS) attacks
  - Brute-force pit enumeration
  - Resource exhaustion

### 6. WebSocket Security

- WebSocket connections are not authenticated.
- Anyone can connect to the WebSocket server and listen to or modify any pit's data in real-time.

### 7. No Input Validation

- User-provided content (drawings, handles, etc.) is not sanitized or validated.
- Malicious users could potentially inject harmful data structures into the Yjs CRDT.

## Recommendations for Users

If you need **any** level of security or privacy:

1. **Run SyncPit privately**: Deploy your own instance on localhost or a private network.
2. **Use a VPN**: If sharing across the internet, use a VPN to secure the connection.
3. **Don't share sensitive data**: Never put anything in a pit that you wouldn't write on a public whiteboard.
4. **Use long, random pit codes**: While not foolproof, longer random codes make enumeration harder (though SyncPit currently uses 8 characters).
5. **Self-host with network restrictions**: Run behind a firewall, use IP allowlists, or add authentication at the reverse proxy level.

## Reporting Security Issues

Since SyncPit is intentionally not secure by design, there is **no bug bounty program** and security "vulnerabilities" are generally considered features, not bugs.

However, if you discover something that violates the intended design (e.g., a way to access pits from other servers, or a memory leak that could cause a DoS), please report it by opening an issue on the GitHub repository.

## Future Considerations

While SyncPit is currently designed as an insecure, ephemeral tool, future versions **might** consider:

- Optional authentication/authorization (e.g., via tokens or OAuth)
- End-to-end encryption for pits
- Rate limiting and abuse prevention
- Audit logging

**But for now, assume SyncPit has NO security.**

## Summary

**TL;DR**: SyncPit is a public, ephemeral collaboration tool with no security. Don't put anything private in a pit. If you need privacy, run your own instance on a private network.
