# src/ - Server Core

## Purpose

Express 5 API server handling encrypted client reports, broadcast management, WebSocket connections, background task processing, real-time encrypted instant messaging, and achievement leaderboard. Uses better-sqlite3 with WAL mode (raw SQL, no ORM).

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Express app setup, env validation, route mounting, all DB initialization, PSK loading via `loadPsk()` |
| `db.ts` | HubDB class (clients, reports, broadcasts, read_log, achievement_leaderboard) |
| `db-rooms.ts` | RoomDB class (rooms, room_members, agents with workspace_name) |
| `db-tasks.ts` | TaskDB class (background task queue) |
| `db-im.ts` | IMDB class (persistent IM message storage with 7-day retention, seq field) |
| `crypto.ts` | ⚠️ NEW: PSK loading with caching, AES-256-GCM encrypt/decrypt |
| `im-crypto.ts` | ⚠️ NEW: IM message encryption utilities (field and message level) |
| `types.ts` | Shared TypeScript interfaces (Client, Report, Broadcast, IMMessage, etc.) |
| `ws-server.ts` | WebSocket server with encrypted IM routing, client search, task dispatch |
| `task-engine.ts` | Background task processing engine |
| `skill-scheduler.ts` | Skill scheduling logic |
| `ws-task-handler.ts` | WebSocket task handling |

## Routes (src/routes/)

| File | Endpoints | Purpose |
|------|-----------|---------|
| `admin.ts` | `/admin/*` | Admin CRUD for broadcasts, clients, stats, leaderboard, settings, file upload, publish |
| `hub-api.ts` | `/api/hub/*` | Hub API endpoints (clients, bots, workspaces) |
| `report.ts` | `POST /api/report` | Encrypted client usage report with replay protection |
| `broadcast.ts` | `/api/broadcasts`, `/api/ack` | Fetch broadcasts, mark as read |
| `rooms.ts` | `/api/rooms/*` | Room management endpoints |
| `tasks.ts` | `/api/tasks/*` | Task management endpoints |

## Database Tables

### HubDB (data/hub.db)
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `clients` | Client registry | Upsert on report, tracks last_seen |
| `reports` | Usage reports | Timestamped client activity logs |
| `broadcasts` | Broadcast messages | Soft delete via `active` flag |
| `read_log` | Read receipts | Many-to-many client↔broadcast |
| `error_reports` | Client error logs | Structured error tracking |
| `feedback` | User feedback | Text feedback with metadata |
| `client_workspaces` | Workspace stats | Per-client workspace usage |
| `hub_settings` | Feature flags | Key-value settings (stardom_dev_mode, hub_dev_mode) |
| `achievement_leaderboard` | Achievement tracking | JSON dimension scores |
| `achievement_leaderboard_log` | Change history | Audit log for leaderboard |

### RoomDB (data/rooms.db)
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `rooms` | Room registry | Visibility (public/private), password support |
| `room_members` | Room membership | Role-based (owner/member) |
| `agents` | Agent registration | workspace_name column for display |

### IMDB (data/im.db)
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `im_messages` | Instant messaging | Persistent storage, 7-day auto-cleanup, ⚠️ seq field for ordering |

### TaskDB (data/tasks.db)
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `tasks` | Background task queue | Status tracking, retry logic |

## Dependencies

- **Express 5** - HTTP server
- **better-sqlite3** - SQLite database (WAL mode)
- **ws** - WebSocket server
- **node:crypto** - Cryptographic operations
- **node:fs** - File system operations
- **dotenv** - Environment variables
- **tsx** - Dev execution (no compile step)

## Key Patterns

- Factory functions: `createXRouter(db, psk)` - dependencies injected, no global state
- Encrypted envelopes: `{ payload, timestamp, pskVersion }` for client API
- Replay protection: 5-min timestamp window
- Upsert pattern: `INSERT ON CONFLICT DO UPDATE` for client records
- Soft delete: `active` flag for broadcasts
- IM system: Encrypted message routing with `im-crypto.ts` utilities
- IM persistence: Automatic cleanup (hourly job deletes messages > 7 days)
- Migration pattern: Adding columns via try/catch ALTER TABLE
- JSON columns: Flexible dimension scoring in leaderboard
- ⚠️ NEW: PSK loading via `loadPsk()` with environment variable support
- ⚠️ NEW: IM message encryption with `enc:` prefix
- ⚠️ NEW: Message sequence numbers for ordering
- ⚠️ NEW: Client search via `im.clients.search`

## ⚠️ Breaking Changes & Migration Notes

### PSK Loading (commit 6f685b9)
- **Before**: PSK loaded inline in `src/index.ts`
- **After**: PSK loaded via `loadPsk()` function in `src/crypto.ts`
- **New Feature**: Environment variable support (`SMAN_PSK`)
- **New Feature**: PSK caching for performance
- **Migration**: Update imports to use `import { loadPsk } from './crypto.js'`

### IM Message Encryption (commit ef4576e)
- **Before**: IM messages in plaintext
- **After**: IM messages encrypted with `enc:` prefix
- **New Module**: `src/im-crypto.ts` with encryption utilities
- **Backward Compatible**: Non-encrypted fields pass through unchanged
- **Impact**: Clients must support decryption of `enc:` prefixed content

### Message Sequence Numbers (commit 6d235fa)
- **Before**: Messages ordered by timestamp only
- **After**: Messages have explicit `seq` field
- **Database Migration**: Automatic column addition with default value 0
- **New Index**: `idx_im_msg_room_seq` on `(room_id, seq)`

### Client Search Feature (commit 5e4e0b4)
- **New Message Type**: `im.clients.search`
- **Use Case**: Real-time client discovery
- **Max Results**: 20 clients per search
- **Search Logic**: Case-insensitive substring match on clientId
