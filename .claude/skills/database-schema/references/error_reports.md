# error_reports

Error tracking with session context, workspace, and LLM metadata.

## DDL
```sql
CREATE TABLE IF NOT EXISTS error_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT,
  session_id TEXT,
  error_code TEXT,
  error_message TEXT,
  raw_error TEXT,
  workspace TEXT,
  last_user_message TEXT,
  llm_model TEXT,
  llm_base_url TEXT,
  os_info TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_error_reports_time ON error_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_code ON error_reports(error_code);
```

## Columns
- `id` - Auto-increment primary key
- `client_id` - Optional foreign key to clients table
- `session_id` - Session identifier for context
- `error_code` - Categorized error code (indexed)
- `error_message` - Human-readable error description
- `raw_error` - Full error stack/trace
- `workspace` - Workspace path context
- `last_user_message` - Last user message before error
- `llm_model` - LLM model in use
- `llm_base_url` - LLM API endpoint
- `os_info` - Operating system information
- `created_at` - Error timestamp (indexed)

## Relationships
- Many-to-one with clients (via client_id, nullable)

## Usage
- Error tracking and debugging via `insertErrorReport()`
- Queryable by `getErrorReports()` with time-based ordering
- Supports deletion via `deleteErrorReport()`
- Indexed for time-series analysis and error code grouping

## Business Logic
- All fields except created_at are nullable for flexibility
- Rich context tracking for post-mortem analysis
- Supports both structured (error_code) and unstructured (raw_error) error data
