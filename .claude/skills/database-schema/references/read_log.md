# read_log Table

## Purpose
Many-to-many junction table tracking which broadcasts each client has read. Prevents re-delivery.

## DDL
```sql
CREATE TABLE IF NOT EXISTS read_log (
  client_id TEXT NOT NULL,
  broadcast_id TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, broadcast_id)
);
```

## Columns
- **client_id** (TEXT NOT NULL): Foreign key to clients.client_id
- **broadcast_id** (TEXT NOT NULL): Foreign key to broadcasts.id
- **read_at** (TEXT NOT NULL): ISO timestamp of acknowledgment

## Indexes
None (composite primary key covers both columns)

## Foreign Keys
- **client_id** → clients(client_id) (implicit, not enforced)
- **broadcast_id** → broadcasts.id (implicit, not enforced)

## Insert Pattern
```sql
-- Mark as read (idempotent)
INSERT OR IGNORE INTO read_log (client_id, broadcast_id) VALUES (?, ?)

-- Get read broadcast IDs for client
SELECT broadcast_id FROM read_log WHERE client_id = ?
```

## Usage Flow
1. Client fetches broadcasts since timestamp
2. Server queries `read_log` to exclude already-read broadcasts
3. Client acknowledges reads via `/api/ack`
4. Server inserts into `read_log` with `INSERT OR IGNORE`

## Source Location
`src/db.ts:95-100`, `src/db.ts:240-251`
