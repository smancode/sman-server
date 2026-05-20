# achievement_leaderboard_log

Historical log of leaderboard changes with field-level diff tracking.

## DDL
```sql
CREATE TABLE IF NOT EXISTS achievement_leaderboard_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  total_points INTEGER NOT NULL,
  total_unlocked INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'bronze',
  tier_counts TEXT NOT NULL DEFAULT '{}',
  dimension_scores TEXT NOT NULL DEFAULT '{}',
  changed_fields TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_achievement_log_agent ON achievement_leaderboard_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_achievement_log_time ON achievement_leaderboard_log(created_at);
```

## Columns
- `id` - Auto-increment primary key
- `agent_id` - Foreign key to achievement_leaderboard (indexed)
- `agent_name` - Snapshot of agent name at log time
- `total_points` - Snapshot of points at log time
- `total_unlocked` - Snapshot of unlocked count at log time
- `level` - Snapshot of level at log time
- `tier_counts` - Snapshot of tier counts JSON at log time
- `dimension_scores` - Snapshot of dimension scores JSON at log time
- `changed_fields` - JSON array of field names that changed in this update
- `created_at` - Log entry timestamp (indexed)

## Relationships
- Many-to-one with `achievement_leaderboard` (via agent_id)

## Usage
- Written by `upsertAchievementEntry()` only when fields actually change
- Tracks complete snapshot of leaderboard state at each change
- `changed_fields` JSON array indicates which fields triggered the log entry
- Queried via `getAchievementLogs()` to show agent history timeline

## Business Logic
- Log entry created on first insert (empty current record)
- Subsequent logs only when any field changes
- Change detection compares all fields before upsert
