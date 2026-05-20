# page_views

Daily pageview aggregation by date.

## DDL
```sql
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date)
);
CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(date);
```

## Columns
- `id` - Auto-increment primary key
- `date` - Date string (indexed, unique constraint)
- `views` - Cumulative view count for the date

## Relationships
- None (aggregation table)

## Usage
- Stores daily pageview counts via `recordPageView()`
- Upsert pattern: INSERT ... ON CONFLICT DO UPDATE SET views = views + 1
- Queried by `getPageViews()` for time-range analytics
- Indexed for date-range queries

## Business Logic
- Uses UNIQUE constraint on date for upsert semantic
- Atomic increment operation prevents race conditions
- Transaction-wrapped with page_view_logs insert
- Supports historical analytics and trend analysis
