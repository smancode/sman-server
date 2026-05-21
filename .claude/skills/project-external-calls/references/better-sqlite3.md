# better-sqlite3

SQLite database for persistent storage using better-sqlite3 package.

## Call Methods

### Database Connection
```typescript
import Database from 'better-sqlite3';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
```

### Query Execution
```typescript
// Prepared statements
db.prepare('SELECT * FROM clients WHERE client_id = ?').get(clientId);
db.prepare('INSERT INTO reports (...) VALUES (?, ?)').run(param1, param2);

// Transactions
db.transaction(() => {
  db.prepare('DELETE FROM client_workspaces WHERE client_id = ?').run(clientId);
  for (const ws of workspaces) {
    db.prepare('INSERT INTO client_workspaces (...) VALUES (?, ?)').run(clientId, ws);
  }
})();
```

## Config Source

- **Database paths**: Multiple databases in `data/` directory
  - `data/hub.db` - Main hub database (HubDB)
  - `data/rooms.db` - Room and agent management (RoomDB)
  - `data/tasks.db` - Task execution tracking (TaskDB)
  - `data/im.db` - Instant messaging (IMDB)
- **Base directory**: `DATA_DIR` environment variable or `cwd/data`
- **Connection**: `src/index.ts` - Creates all database instances on startup
- **Schema initialization**: Each DB class (`HubDB`, `RoomDB`, `TaskDB`, `IMDB`) initializes tables in constructor

## Call Locations

| File | Purpose |
|------|---------|
| `src/db.ts` | HubDB class - clients, reports, broadcasts, analytics, settings |
| `src/db-rooms.ts` | RoomDB class - rooms, members, agents with migrations |
| `src/db-tasks.ts` | TaskDB class - task execution tracking |
| `src/db-im.ts` | IMDB class - instant messaging with cleanup |
| `src/routes/report.ts` | Client upsert, report insertion, error reports, feedback, achievement reports |
| `src/routes/broadcast.ts` | Broadcast queries, read tracking |
| `src/routes/admin.ts` | Stats, client listing, broadcast CRUD, analytics queries, leaderboard |
| `src/routes/rooms.ts` | Room CRUD, member management, agent registration |
| `src/routes/tasks.ts` | Task creation, status updates, evaluation |
| `src/routes/hub-api.ts` | Client hub settings queries |
| `src/index.ts` | Page view tracking, download logging |
| `src/ws-server.ts` | Room queries, IM message insertion and sync, agent management |

## Purpose

**Multi-database architecture** for the hub server:
- **hub.db**: Core client data, reports, broadcasts, analytics, settings
- **rooms.db**: Real-time collaboration rooms and agent management
- **tasks.db**: Distributed task execution tracking
- **im.db**: Instant messaging with automatic cleanup

### hub.db (HubDB)
Key tables:
- `clients` - Client registry with upsert pattern
- `reports` - Historical usage reports
- `broadcasts` - Broadcast messages with soft delete
- `read_log` - Broadcast read tracking
- `error_reports` - Error tracking
- `feedback` - User feedback
- `page_views`, `page_view_logs`, `download_logs` - Analytics
- `client_workspaces` - Workspace associations
- `achievement_leaderboard` - Agent achievement rankings
- `achievement_leaderboard_log` - Audit trail for leaderboard
- `hub_settings` - Feature flags and configuration

### rooms.db (RoomDB)
Key tables:
- `rooms` - Room registry with visibility (public/private) and password protection
- `room_members` - Room membership with roles (owner/member)
- `agents` - Agent registration with capabilities, status, heartbeat tracking

Migrations:
- `visibility` column - Public/private room access
- `password` column - Optional password protection
- `workspace_name` column - Human-readable workspace names

### tasks.db (TaskDB)
Key tables:
- `tasks` - Task execution tracking with status workflow
- `task evaluations` - Task evaluation results

### im.db (IMDB)
Key tables:
- `im_messages` - Instant messages with timestamps, quotes, attachments, mentions

Automatic cleanup:
- Deletes messages older than 7 days (hourly interval)

## WAL Mode

All databases run in WAL (Write-Ahead Logging) mode for concurrent access:
```sql
PRAGMA journal_mode = WAL;
```

## Graceful Shutdown

All databases are properly closed on SIGTERM/SIGINT:
```typescript
process.on('SIGTERM', () => {
  taskDB.close();
  roomDB.close();
  imDB.close();
  db.close();
});
```
