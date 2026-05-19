# broadcasts Table

## Purpose
Broadcast notifications with soft-delete flag. Active broadcasts fetched by clients based on timestamp.

## DDL
```sql
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON broadcasts(active);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique broadcast ID
- **title** (TEXT NOT NULL): Message title
- **body** (TEXT NOT NULL): Message body (markdown)
- **created_at** (TEXT NOT NULL): ISO timestamp
- **active** (INTEGER DEFAULT 1): Soft-delete flag (1=active, 0=deleted)

## Indexes
- **idx_broadcasts_active**: ON (active) - for filtering active broadcasts

## Foreign Keys
None

## Soft Delete Pattern
```sql
-- Deactivate (soft delete)
UPDATE broadcasts SET active = 0 WHERE id = ?

-- Query active broadcasts
SELECT * FROM broadcasts WHERE active = 1 ORDER BY created_at DESC

-- Fetch since timestamp
SELECT * FROM broadcasts WHERE active = 1 AND created_at > ? ORDER BY created_at DESC
```

## Source Location
`src/db.ts:87-93`, `src/db.ts:212-238`
