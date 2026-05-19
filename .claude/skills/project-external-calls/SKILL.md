---
name: project-external-calls
description: External dependency knowledge for sman-server. Contains local system calls (database, file system, crypto) with call methods, config sources, and usage locations.
_scanned:
  commitHash: 6a87529d7c30fef9a812f0d1b6bbfa87c5870fed
  scannedAt: 2026-05-20T03:04:00Z
  branch: master
---

# External Dependencies

## Local System Services

| Service | Type | Purpose | Reference |
|---------|------|---------|-----------|
| better-sqlite3 | SQLite Database | Persistent storage for clients, reports, broadcasts, settings, error reports, feedback, analytics | [better-sqlite3.md](references/better-sqlite3.md) |
| node:crypto | Cryptographic Operations | AES-256-GCM encryption/decryption for client communication | [node-crypto.md](references/node-crypto.md) |
| node:fs | File System | Update file serving, redirect mappings, static pages, PSK loading | [node-fs.md](references/node-fs.md) |
| ws (WebSocket) | Real-time Communication | Desktop client connections, room subscriptions, task broadcasts | [ws-websocket.md](references/ws-websocket.md) |
