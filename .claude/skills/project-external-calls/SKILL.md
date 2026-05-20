---
name: project-external-calls
description: External dependency knowledge for sman-server. Contains local system calls (database, file system, crypto) with call methods, config sources, and usage locations.
_scanned:
  commitHash: 60687534e9e2a4acf2800a04840cf09048ff3dda
  scannedAt: 2026-05-21T00:00:00Z
  branch: master
---

# External Dependencies

## Local System Services

| Service | Type | Purpose | Reference |
|---------|------|---------|-----------|
| better-sqlite3 | SQLite Database | Persistent storage for clients, reports, broadcasts, settings, error reports, feedback, analytics, achievement leaderboard | [better-sqlite3.md](references/better-sqlite3.md) |
| node:crypto | Cryptographic Operations | AES-256-GCM encryption/decryption for client communication | [node-crypto.md](references/node-crypto.md) |
| node:fs | File System | Update file serving, redirect mappings, static pages, PSK loading | [node-fs.md](references/node-fs.md) |
| ws (WebSocket) | Real-time Communication | Desktop client connections, room subscriptions, task broadcasts | [ws-websocket.md](references/ws-websocket.md) |
