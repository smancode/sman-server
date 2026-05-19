# reports Table

## Purpose
Time-series usage reports linked to clients. One row per client report submission.

## DDL
```sql
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  report_time TEXT NOT NULL,
  active_sessions INTEGER DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients(client_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_client ON reports(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_time ON reports(report_time);
```

## Columns
- **id** (INTEGER PRIMARY KEY): Auto-increment ID
- **client_id** (TEXT NOT NULL): Foreign key to clients.client_id
- **report_time** (TEXT NOT NULL): ISO timestamp from client report
- **active_sessions** (INTEGER): Session count at report time

## Indexes
- **idx_reports_client**: ON (client_id) - for client history queries
- **idx_reports_time**: ON (report_time) - for time-based stats

## Foreign Keys
- **client_id** → clients(client_id)

## Query Pattern
```sql
-- Insert report
INSERT INTO reports (client_id, report_time, active_sessions) VALUES (?, ?, ?)

-- Get client history
SELECT * FROM reports WHERE client_id = ? ORDER BY report_time DESC LIMIT 100

-- 24h stats
SELECT COUNT(*) as c FROM reports WHERE report_time > datetime('now', '-24 hours')
```

## Source Location
`src/db.ts:79-85`, `src/db.ts:200-210`
