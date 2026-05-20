# download_logs

Download tracking with IP, filename, and version extraction.

## DDL
```sql
CREATE TABLE IF NOT EXISTS download_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  filename TEXT NOT NULL,
  version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_download_logs_created ON download_logs(created_at);
```

## Columns
- `id` - Auto-increment primary key
- `ip` - Client IP address
- `filename` - Downloaded filename
- `version` - Extracted version number (nullable)
- `created_at` - Download timestamp (indexed)

## Relationships
- None (audit log table)

## Usage
- Download tracking via `recordDownload()`
- Queried by `getDownloadLogs()` for raw logs
- Queried by `getDownloadStats()` for aggregated analytics
- Version extracted from filename using regex

## Business Logic
- Version extraction pattern: `/\d+\.\d+\.\d+/` (semver format)
- Supports download analytics by version, IP, and time
- Helps track update adoption and geographic distribution
- Indexed for time-based queries and cleanup
