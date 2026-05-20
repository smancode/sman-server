# page_view_logs

Raw pageview logs with IP and timestamp.

## DDL
```sql
CREATE TABLE IF NOT EXISTS page_view_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_page_view_logs_created ON page_view_logs(created_at);
```

## Columns
- `id` - Auto-increment primary key
- `ip` - Client IP address
- `created_at` - View timestamp (indexed)

## Relationships
- None (audit log table)

## Usage
- Detailed logging via `recordPageView()`
- Queried by `getPageViewIps()` for visitor analytics
- Transaction-wrapped with page_views update
- Indexed for time-based cleanup and queries

## Business Logic
- Records every pageview with IP for visitor tracking
- Supports IP-based analytics (unique visitors, repeat visits)
- Used in conjunction with page_views for both aggregated and raw data
- Helps identify traffic patterns and suspicious activity
