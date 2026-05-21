---
name: project-external-calls
description: External dependency knowledge for sman-server. Contains local system calls (database, file system, crypto) with call methods, config sources, and usage locations.
_scanned:
  commitHash: 312f64fbef5f2cd1acae067c829101d7e6203a92
  scannedAt: 2026-05-22T00:00:00Z
  branch: master
---

# External Dependencies

## Local System Services

| Service | Type | Purpose | Reference |
|---------|------|---------|-----------|
| better-sqlite3 | SQLite Database | Persistent storage for clients, reports, broadcasts, settings, error reports, feedback, analytics, achievement leaderboard, IM messages, room management, task management | [better-sqlite3.md](references/better-sqlite3.md) |
| node:crypto | Cryptographic Operations | AES-256-GCM encryption/decryption for client communication, UUID generation for rooms and IM messages | [node-crypto.md](references/node-crypto.md) |
| node:fs | File System | Update file serving, redirect mappings, static pages, PSK loading, database directory creation | [node-fs.md](references/node-fs.md) |
| ws (WebSocket) | Real-time Communication | Desktop client connections, room subscriptions, task broadcasts, instant messaging, agent presence | [ws-websocket.md](references/ws-websocket.md) |
