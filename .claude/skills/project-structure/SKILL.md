---
name: project-structure
description: Project structure knowledge for sman-server (management hub with encrypted reporting, broadcasts, admin dashboard, real-time IM, and achievement leaderboard)
_scanned:
  commitHash: 312f64fbef5f2cd1acae067c829101d7e6203a92
  scannedAt: 2026-05-22T10:30:00+08:00
  branch: master
---

## Tech Stack

- **Server**: TypeScript + Express 5 + better-sqlite3 (WAL mode, raw SQL, no ORM)
- **Admin UI**: React 19 + Vite + Zustand + hand-written CSS
- **Real-time**: WebSocket (ws) with persistent message storage
- **Build**: ESM throughout, tsx for dev, tsc for build
- **Package Manager**: pnpm
- **Security**: AES-256-GCM encryption for client-server communication

## Directory Structure

```
sman-server/
├── src/                    # Server core (TypeScript)
│   ├── routes/            # Express route modules
│   ├── index.ts           # Express app setup, all DB initialization
│   ├── db.ts              # HubDB (clients, reports, broadcasts)
│   ├── db-rooms.ts        # RoomDB (room management)
│   ├── db-tasks.ts        # TaskDB (background tasks)
│   ├── db-im.ts           # ⚠️ NEW IMDB (instant messaging)
│   ├── crypto.ts          # AES-256-GCM encrypt/decrypt
│   ├── types.ts           # Shared TypeScript interfaces
│   └── ws-server.ts       # WebSocket with IM support
├── web/                   # Admin dashboard (React SPA)
├── data/                  # Runtime data (4 DB files: hub, rooms, tasks, im)
├── dist/                  # Build output
└── package.json
```

## Core Modules

| Module | Path | Purpose |
|--------|------|---------|
| Server Core | `src/` | Express API, WebSocket, databases, crypto |
| Routes | `src/routes/` | API endpoints (admin, hub-api, report, broadcast, rooms, tasks) |
| Databases | `src/db*.ts` | HubDB, RoomDB, TaskDB, ⚠️ IMDB (persistent IM storage) |
| WebSocket | `src/ws-server.ts` | Real-time communication with IM routing |
| Task Engine | `src/task-engine.ts` | Background task processing |
| Admin UI | `web/src/` | React admin dashboard |

## Build and Run

```bash
bash dev.sh                # API on :5882, UI on :4000
pnpm build                # server TS → dist/, web → dist/public/
pnpm test                 # vitest run
```

## Environment Setup

Copy `.env.example` to `.env`. Required: `PSK` (32-char), `ADMIN_TOKEN`, `PORT` (default: 5882), `PSK_VERSION` (must be `1`)

## Key Patterns

- Route modules export factory functions: `createXRouter(db, psk)`
- Client API uses encrypted envelopes with replay protection
- Broadcasts use soft delete (`active` flag)
- Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`
- Tests create temp database in `os.tmpdir()` per file
- ⚠️ NEW: IM system stores messages persistently with 7-day retention
- ⚠️ NEW: IM messages support quotes, mentions, attachments, typing indicators
- ⚠️ NEW: Achievement system uses JSON columns for flexible dimension scoring
- ⚠️ NEW: Migration pattern for adding columns to existing databases

## ⚠️ Breaking Changes

- **WsHub constructor**: Now requires `imDB` parameter: `new WsHub(server, roomDB, imDB, PSK, taskEngine)`
- **IMDB initialization**: `new IMDB(path.join(DATA_DIR, 'im.db'))` required in index.ts
- **Agent workspace_name**: New column in RoomDB.agents (migration handled automatically)
