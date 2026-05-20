# feedback

User feedback submissions with workspace and LLM context.

## DDL
```sql
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT,
  message TEXT NOT NULL,
  workspace TEXT,
  llm_model TEXT,
  llm_base_url TEXT,
  os_info TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_time ON feedback(created_at);
```

## Columns
- `id` - Auto-increment primary key
- `client_id` - Optional foreign key to clients table
- `message` - Feedback message text (required)
- `workspace` - Workspace path context
- `llm_model` - LLM model in use
- `llm_base_url` - LLM API endpoint
- `os_info` - Operating system information
- `created_at` - Submission timestamp (indexed)

## Relationships
- Many-to-one with clients (via client_id, nullable)

## Usage
- User feedback collection via `insertFeedback()`
- Queryable by `getFeedbacks()` with time-based ordering
- Supports deletion via `deleteFeedback()`
- Indexed for time-series analysis

## Business Logic
- Only message field is required
- Rich context tracking for product feedback analysis
- Helps correlate feedback with usage patterns and LLM configurations
