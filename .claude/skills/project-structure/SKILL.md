---
name: project-structure
description: Project structure knowledge for sman-server (management hub with encrypted reporting, broadcasts, admin dashboard, real-time IM, room collaboration, and task management)
_scanned:
  commitHash: 5e4e0b43e7ba530e3efcd3e68e9814c38c250ae2
  scannedAt: "2026-05-22T19:09:00Z"
  branch: master
---

## Tech Stack

- **Server**: TypeScript + Express 5 + better-sqlite3 (WAL mode, raw SQL, no ORM)
- **Admin UI**: React 19 + Vite + Zustand + hand-written CSS
- **Real-time**: WebSocket (ws) with persistent message storage and room-based collaboration
- **Build**: ESM throughout, tsx for dev, tsc for build
- **Package Manager**: pnpm
- **Security**: AES-256-GCM encryption for client-server communication and IM messages

## Directory Structure

```
sman-server/
├── src/                    # Server core (TypeScript)
│   ├── routes/            # Express route modules
│   ├── __tests__/         # Vitest tests
│   ├── index.ts           # Express app setup, all DB initialization
│   ├── db.ts              # HubDB (clients, reports, broadcasts)
│   ├── db-rooms.ts        # RoomDB (room management)
│   ├── db-tasks.ts        # TaskDB (background tasks)
│   ├── db-im.ts           # IMDB (instant messaging with encryption)
│   ├── crypto.ts          # AES-256-GCM encrypt/decrypt + PSK loading
│   ├── im-crypto.ts       # ⚠️ NEW IM message encryption layer
│   ├── types.ts           # Shared TypeScript interfaces
│   ├── ws-server.ts       # WebSocket with IM and task support
│   ├── task-engine.ts     # Background task processing engine
│   ├── ws-task-handler.ts # WebSocket task message handler
│   └── skill-scheduler.ts # Automated skill update scheduler
├── web/                   # Admin dashboard (React SPA)
│   ├── src/
│   │   ├── components/    # React components (tab-based UI)
│   │   ├── stores/        # Zustand state management
│   │   ├── lib/           # Utility functions
│   │   └── locales/       # Internationalization
├── data/                  # Runtime data (4 DB files: hub, rooms, tasks, im)
├── dist/                  # Build output
└── package.json
```

## Core Modules

| Module | Path | Purpose |
|--------|------|---------|
| Server Core | `src/` | Express API, WebSocket, databases, crypto, task engine |
| Routes | `src/routes/` | API endpoints (admin, hub-api, report, broadcast, rooms, tasks) |
| Databases | `src/db*.ts` | HubDB, RoomDB, TaskDB, IMDB (persistent IM storage) |
| Crypto | `src/crypto.ts`, `src/im-crypto.ts` | PSK loading, message encryption, IM field encryption |
| WebSocket | `src/ws-server.ts` | Real-time communication with IM routing and task dispatch |
| Task Engine | `src/task-engine.ts` | Background task processing with retry logic |
| Admin UI | `web/src/` | React admin dashboard with tab-based navigation |

## Build and Run

```bash
bash dev.sh                # API on :5882, UI on :4000
pnpm build                # server TS → dist/, web → dist/public/
pnpm test                 # vitest run
pnpm test:watch           # vitest in watch mode
```

## Environment Setup

Copy `.env.example` to `.env`. Required: `PSK` (32-char) OR `SMAN_PSK` env var, `ADMIN_TOKEN`, `PORT` (default: 5882), `PSK_VERSION` (must be `1`)

## Key Patterns

- Route modules export factory functions: `createXRouter(db, psk, ...)`
- Client API uses encrypted envelopes with replay protection (5-min window)
- PSK loading via `loadPsk()` with caching (env var `SMAN_PSK` OR `data/hub.key` file)
- Broadcasts use soft delete (`active` flag)
- Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`
- Tests create temp database in `os.tmpdir()` per file
- IM messages stored persistently with 7-day retention and automatic cleanup
- IM messages support quotes, mentions, attachments, typing indicators, and sequence numbers
- ⚠️ NEW: IM message encryption via `im-crypto.ts` for content and attachments
- ⚠️ NEW: PSK loading refactored into `crypto.ts` with environment variable support
- ⚠️ NEW: Client search feature via `im.clients.search` WebSocket message
- ⚠️ NEW: Message sequence numbers for ordering and deduplication

## ⚠️ Breaking Changes

### PSK Loading (commit 6f685b9)
- **Before**: PSK loaded inline in `src/index.ts`
- **After**: PSK loaded via `loadPsk()` function in `src/crypto.ts`
- **Migration**: Update any direct PSK loading to use `import { loadPsk } from './crypto.js'`
- **New Feature**: Supports `SMAN_PSK` environment variable OR `data/hub.key` file
- **New Feature**: PSK caching via internal `cachedPsk` variable

### IM Message Encryption (commit ef4576e)
- **Before**: IM messages stored and transmitted in plaintext
- **After**: IM message content and attachments encrypted via `im-crypto.ts`
- **New Functions**: `encryptIMMessage()`, `decryptIMMessage()`, `encryptField()`, `decryptField()`
- **Encryption Format**: `enc:` + base64(AES-256-GCM encrypted payload)
- **Migration**: Existing plaintext messages still supported (backward compatible)

### Message Sequence Numbers (commit 6d235fa)
- **Before**: Messages ordered by timestamp only
- **After**: Messages have explicit `seq` field for ordering
- **Database Migration**: Automatic column addition with default value 0
- **New Index**: `idx_im_msg_room_seq` on `(room_id, seq)` for efficient queries

### Client Search Feature (commit 5e4e0b4)
- **New Message Type**: `im.clients.search` for searching connected clients
- **Parameters**: `{ query: string, seq: number }`
- **Response**: `{ type: 'im.clients.search', results: [{ clientId }], seq }`
- **Max Results**: 20 clients, case-insensitive substring match on clientId

## Migration Requirements

⚠️ **MIGRATION**: If upgrading from pre-6f685b9:
1. Set `SMAN_PSK` environment variable (32 characters) OR create `data/hub.key` file
2. Update imports: `import { loadPsk } from './crypto.js'`
3. Replace inline PSK loading with `const PSK = loadPsk();`

⚠️ **MIGRATION**: If upgrading from pre-ef4576e:
1. Existing plaintext IM messages will still work
2. New messages will be encrypted automatically
3. No manual migration required

⚠️ **MIGRATION**: If upgrading from pre-6d235fa:
1. Database schema migration is automatic (ALTER TABLE with try/catch)
2. Existing messages will have `seq = 0`
3. New index created automatically on startup
