# achievement_leaderboard

Agent achievement tracking with points, levels, tier counts, and dimension scores.

## DDL
```sql
CREATE TABLE IF NOT EXISTS achievement_leaderboard (
  agent_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_unlocked INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'bronze',
  tier_counts TEXT NOT NULL DEFAULT '{}',
  dimension_scores TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_achievement_leaderboard_points ON achievement_leaderboard(total_points DESC);
```

## Columns
- `agent_id` - Primary key, unique agent identifier
- `agent_name` - Display name for the agent
- `total_points` - Overall achievement points (indexed DESC for ranking)
- `total_unlocked` - Count of unlocked achievements
- `level` - Current level tier (bronze/silver/gold)
- `tier_counts` - JSON string mapping tiers to counts
- `dimension_scores` - JSON string with per-dimension scores (e.g., sessions, messages, tokens)
- `updated_at` - Last modification timestamp

## Relationships
- One-to-many with `achievement_leaderboard_log` (via agent_id)

## Usage
- Main leaderboard table queried by `getLeaderboard()` and `getLeaderboardPage()`
- Upserted via `upsertAchievementEntry()` with change detection
- Supports sorting by total points or individual dimensions
- Used for paginated admin view with search and sorting

## ⚠️ MIGRATION
Existing databases add `dimension_scores` column via ALTER TABLE (lines 205-210)
