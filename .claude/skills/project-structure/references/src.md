# src/ - Server Core

## Purpose

Express 5 API server handling encrypted client reports, broadcast management, WebSocket connections, background task processing, real-time instant messaging, and achievement leaderboard. Uses better-sqlite3 with WAL mode (raw SQL, no ORM).

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Express app setup, env validation, route mounting, all DB initialization |
| `db.ts` | HubDB class (clients, reports, broadcasts, read_log, achievement_leaderboard) |
| `db-rooms.ts` | RoomDB class (rooms, room_members, agents with workspace_name) |
| `db-tasks.ts` | TaskDB class (background task queue) |
| `db-im.ts` | ⚠️ NEW IMDB class (persistent IM message storage with 7-day retention) |
| `crypto.ts` | AES-256-GCM encrypt/decrypt, wire format: base64(IV + ciphertext + authTag) |
| `types.ts` | Shared TypeScript interfaces (Client, Report, Broadcast, IMMessage, etc.) |
| `ws-server.ts` | WebSocket server with IM message routing and transparent forwarding |
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
| `agents` | Agent registration | ⚠️ ADDED workspace_name column for display |

### ⚠️ IMDB (data/im.db) - NEW
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `im_messages` | Instant messaging | Persistent storage with 7-day auto-cleanup |

### TaskDB (data/tasks.db)
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `tasks` | Background task queue | Status tracking, retry logic |

## Dependencies

- **Express 5** - HTTP server
- **better-sqlite3** - SQLite database (WAL mode)
- **ws** - WebSocket server
- **dotenv** - Environment variables
- **tsx** - Dev execution (no compile step)

## Key Patterns

- Factory functions: `createXRouter(db, psk)` - dependencies injected, no global state
- Encrypted envelopes: `{ payload, timestamp, pskVersion }` for client API
- Replay protection: 5-min timestamp window
- Upsert pattern: `INSERT ON CONFLICT DO UPDATE` for client records
- Soft delete: `active` flag for broadcasts
- ⚠️ NEW: IM system with transparent message routing (im.agent_delta, im.presence, im.typing)
- ⚠️ NEW: IM persistence with automatic cleanup (hourly job deletes messages > 7 days)
- ⚠️ NEW: Migration pattern for adding columns (try/catch ALTER TABLE)
- ⚠️ NEW: JSON columns for flexible dimension scoring in leaderboard

## ⚠️ Breaking Changes & Migration Notes

- **IMDB initialization**: `new IMDB(path.join(DATA_DIR, 'im.db'))` must be called in index.ts
- **WsHub constructor**: Now requires `imDB` parameter: `new WsHub(server, roomDB, imDB, PSK, taskEngine)`
- **IM cleanup timer**: Automatically runs every hour to delete old messages
- **Agent workspace_name**: New column in RoomDB.agents (migration handled automatically)
