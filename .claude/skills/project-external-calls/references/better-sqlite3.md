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

- **Database path**: `data/hub.db` (from `DATA_DIR` environment variable or `cwd/data`)
- **Connection**: `src/index.ts` - Creates `HubDB` instance on startup
- **Schema initialization**: `src/db.ts` - `HubDB.initTables()` creates all tables on construction

## Call Locations

| File | Purpose |
|------|---------|
| `src/db.ts` | HubDB class wrapping all database operations |
| `src/routes/report.ts` | Client upsert, report insertion, error reports, feedback |
| `src/routes/broadcast.ts` | Broadcast queries, read tracking |
| `src/routes/admin.ts` | Stats, client listing, broadcast CRUD, analytics queries |
| `src/index.ts` | Page view tracking, download logging |

## Purpose

**Primary data store** for the hub server. All persistent data including:
- Client records (upsert on each report)
- Usage reports (time-series data)
- Broadcast messages
- Read acknowledgments (many-to-many client↔broadcast)
- Error reports and feedback
- Page view and download analytics
- Hub settings (feature flags)
- Client workspaces

## Database Schema

Key tables:
- `clients` - Client registry with upsert pattern
- `reports` - Historical usage reports
- `broadcasts` - Broadcast messages with soft delete
- `read_log` - Broadcast read tracking
- `error_reports` - Error tracking
- `feedback` - User feedback
- `page_views`, `page_view_logs`, `download_logs` - Analytics
- `client_workspaces` - Workspace associations

## WAL Mode

Database runs in WAL (Write-Ahead Logging) mode for concurrent access:
```sql
PRAGMA journal_mode = WAL;
```
