# clients Table

## Purpose
Stores client device records with version, hostname, IP, and activity tracking. Uses upsert pattern on each report.

## DDL
```sql
CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  version TEXT,
  hostname TEXT,
  ip TEXT,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  active_sessions INTEGER DEFAULT 0
);
```

## Columns
- **client_id** (TEXT PRIMARY KEY): Unique client identifier
- **version** (TEXT): App version string
- **hostname** (TEXT): Client hostname
- **ip** (TEXT): Client IP address
- **first_seen** (TEXT): ISO timestamp, immutable after first insert
- **last_seen** (TEXT): ISO timestamp, updated on each report
- **active_sessions** (INTEGER): Current session count

## Indexes
None (primary key on client_id sufficient)

## Foreign Keys
None

## Upsert Logic
```sql
INSERT INTO clients (client_id, version, hostname, ip, first_seen, last_seen, active_sessions)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(client_id) DO UPDATE SET
  version = excluded.version,
  hostname = excluded.hostname,
  ip = excluded.ip,
  last_seen = excluded.last_seen,
  active_sessions = excluded.active_sessions
```

## Source Location
`src/db.ts:69-77`, `src/db.ts:178-190`
