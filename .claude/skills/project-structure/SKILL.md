---
name: project-structure
description: Project structure knowledge for sman-server (management hub with encrypted reporting, broadcasts, admin dashboard, and achievement leaderboard)
_scanned:
  commitHash: 60687534e9e2a4acf2800a04840cf09048ff3dda
  scannedAt: 2026-05-21T14:30:00+08:00
  branch: master
---

## Tech Stack

- **Server**: TypeScript + Express 5 + better-sqlite3 (WAL mode, raw SQL, no ORM)
- **Admin UI**: React 19 + Vite + Zustand + hand-written CSS
- **Build**: ESM throughout, tsx for dev, tsc for build
- **Package Manager**: pnpm
- **Security**: AES-256-GCM encryption for client-server communication

## Directory Structure

```
sman-server/
├── src/                    # Server core (TypeScript)
│   ├── routes/            # Express route modules
│   ├── __tests__/         # Vitest tests
│   ├── index.ts           # Express app setup
│   ├── db.ts              # HubDB class (SQLite operations)
│   ├── crypto.ts          # AES-256-GCM encrypt/decrypt
│   ├── types.ts           # Shared TypeScript interfaces
│   └── ...
├── web/                   # Admin dashboard (React SPA)
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── stores/        # Zustand state
│   │   ├── locales/       # i18n translations
│   │   ├── App.tsx        # Main app
│   │   └── api.ts         # API client
│   └── package.json
├── data/                  # Runtime data
│   ├── updates/sman/      # Update files (.exe, .dmg, .yml)
│   └── pages/             # Static pages
├── dist/                  # Build output
└── package.json
```

## Core Modules

| Module | Path | Purpose |
|--------|------|---------|
| Server Core | `src/` | Express API, WebSocket, database, crypto |
| Routes | `src/routes/` | API endpoints (admin, hub-api, report, broadcast, rooms, tasks) |
| Database | `src/db.ts` | HubDB with clients, reports, broadcasts, read_log, achievement_leaderboard |
| WebSocket | `src/ws-server.ts` | WebSocket server for real-time communication |
| Task Engine | `src/task-engine.ts` | Background task processing |
| Admin UI | `web/src/` | React admin dashboard with auth, CRUD, and leaderboard |

## How to Build and Run

```bash
# Development (API on :5882, UI on :4000)
bash dev.sh

# Or individually:
pnpm dev                    # API server via tsx
cd web && pnpm dev          # Vite dev server

# Build everything
pnpm build                  # server TS → dist/, web → dist/public/

# Tests
pnpm test                   # vitest run
pnpm test:watch             # vitest watch mode
```

## Environment Setup

Copy `.env.example` to `.env`. Required: `PSK` (32-char), `ADMIN_TOKEN`, `PORT` (default: 5882), `PSK_VERSION` (must be `1`)

## Key Patterns

- Route modules export factory functions: `createXRouter(db, psk)`
- Client API uses encrypted envelopes with replay protection
- Broadcasts use soft delete (`active` flag)
- Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`
- Tests create temp database in `os.tmpdir()` per file
- ⚠️ NEW: Achievement system uses JSON columns for flexible dimension scoring
