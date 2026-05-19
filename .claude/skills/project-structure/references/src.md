# src/ - Server Core

## Purpose

Express 5 API server handling encrypted client reports, broadcast management, WebSocket connections, and background task processing. Uses better-sqlite3 with WAL mode (raw SQL, no ORM).

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Express app setup, env validation, route mounting, static file serving |
| `db.ts` | HubDB class wrapping all SQLite operations (clients, reports, broadcasts, read_log) |
| `crypto.ts` | AES-256-GCM encrypt/decrypt, wire format: base64(IV + ciphertext + authTag) |
| `types.ts` | Shared TypeScript interfaces (Client, Report, Broadcast, etc.) |
| `ws-server.ts` | WebSocket server for real-time communication |
| `task-engine.ts` | Background task processing engine |
| `skill-scheduler.ts` | Skill scheduling logic |
| `db-rooms.ts` | Room management database operations |
| `db-tasks.ts` | Task database operations |
| `ws-task-handler.ts` | WebSocket task handling |

## Routes (src/routes/)

| File | Endpoints | Purpose |
|------|-----------|---------|
| `admin.ts` | `/admin/*` | Admin CRUD for broadcasts, clients, stats, file upload, publish |
| `hub-api.ts` | `/api/hub/*` | Hub API endpoints (clients, bots, workspaces) |
| `report.ts` | `POST /api/report` | Encrypted client usage report with replay protection |
| `broadcast.ts` | `/api/broadcasts`, `/api/ack` | Fetch broadcasts, mark as read |
| `rooms.ts` | `/api/rooms/*` | Room management endpoints |
| `tasks.ts` | `/api/tasks/*` | Task management endpoints |

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
