---
name: database-schema
description: Database schema knowledge for sman-server: table structures, relationships, indexes, and DDL
_scanned:
  commitHash: 5e4e0b43e7ba530e3efcd3e68e9814c38c250ae2
  scannedAt: "2026-05-22T19:08:21Z"
  branch: "master"
---

# Database Schema Knowledge

Database schema knowledge for sman-server: table structures, relationships, indexes, and DDL.

## Database Overview

- **Engine**: better-sqlite3 (WAL mode enabled)
- **Database Files**:
  - `data/hub.db` - Main hub database (HubDB)
  - `data/rooms.db` - Room and agent management (RoomDB)
  - `data/im.db` - Instant messaging (IMDB)
  - `data/tasks.db` - Task execution tracking (TaskDB)
- **Table Count**: 24 tables across 4 database files
- **ORM**: No ORM - raw SQL with better-sqlite3

## Core Tables

| Table | Database | Purpose | Reference |
|-------|----------|---------|-----------|
| `clients` | hub.db | Client registration and tracking | `references/clients.md` |
| `reports` | hub.db | Client usage reports | `references/reports.md` |
| `broadcasts` | hub.db | Broadcast notifications | `references/broadcasts.md` |
| `read_log` | hub.db | Broadcast read tracking (many-to-many) | `references/read_log.md` |
| `hub_settings` | hub.db | Hub configuration settings | `references/hub_settings.md` |
| `error_reports` | hub.db | Client error reporting | `references/error_reports.md` |
| `feedback` | hub.db | User feedback submissions | `references/feedback.md` |
| `page_views` | hub.db | Daily page view aggregation | `references/page_views.md` |
| `page_view_logs` | hub.db | Page view log entries | `references/page_view_logs.md` |
| `download_logs` | hub.db | Download tracking | `references/download_logs.md` |
| `client_workspaces` | hub.db | Client workspace mapping | `references/client_workspaces.md` |
| `achievement_leaderboard` | hub.db | Achievement system leaderboard | `references/achievement_leaderboard.md` |
| `achievement_leaderboard_log` | hub.db | Achievement change log | `references/achievement_leaderboard_log.md` |
| `rooms` | rooms.db | Multi-purpose room definitions | `references/rooms.md` |
| `room_members` | rooms.db | Room membership tracking | `references/room_members.md` |
| `agents` | rooms.db | Agent registration and status | `references/agents.md` |
| `im_messages` | im.db | Instant messaging messages | `references/im_messages.md` |

## Schema Changes Summary (Since 312f64fb)

### New Tables
None - all tables existed in previous version.

### Modified Tables

| Table | Change | Impact | Migration |
|-------|--------|--------|-----------|
| `im_messages` | Added `seq INTEGER` column | Enables message ordering and sync | ⚠️ MIGRATION |
| `achievement_leaderboard` | Added `dimension_scores TEXT` column | Stores multi-dimensional achievement scores | ⚠️ MIGRATION |

### New Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `im_messages` | `idx_im_msg_room_seq` | Message retrieval by sequence number |

## Migration Requirements

### ⚠️ MIGRATION: Add seq column to im_messages

```sql
ALTER TABLE im_messages ADD COLUMN seq INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_im_msg_room_seq ON im_messages(room_id, seq);
```

**Impact**: Required for message sync and ordering. Already handled in `src/db-im.ts` with try-catch for existing databases.

**Applied in**: `src/db-im.ts` lines 49-59

### ⚠️ MIGRATION: Add dimension_scores to achievement_leaderboard

```sql
ALTER TABLE achievement_leaderboard ADD COLUMN dimension_scores TEXT NOT NULL DEFAULT '{}';
```

**Impact**: Required for multi-dimensional leaderboard. Already handled in `src/db.ts` with try-catch.

**Applied in**: `src/db.ts` lines 206-210

## Database File Locations

- **Hub DB**: `data/hub.db` (managed by `HubDB` in `src/db.ts`)
- **Rooms DB**: `data/rooms.db` (managed by `RoomDB` in `src/db-rooms.ts`)
- **IM DB**: `data/im.db` (managed by `IMDB` in `src/db-im.ts`)
- **Tasks DB**: `data/tasks.db` (managed by `TaskDB` in `src/db-tasks.ts`)

## Key Design Patterns

1. **WAL Mode**: All databases use `PRAGMA journal_mode = WAL` for better concurrency
2. **Soft Deletes**: `rooms.active`, `broadcasts.active` flags instead of DELETE
3. **Upsert Patterns**: `INSERT ON CONFLICT DO UPDATE` for idempotent operations
4. **Migration**: Try-catch around `ALTER TABLE` adds new columns to existing DBs
5. **Timestamps**: Use `datetime('now', 'localtime')` for local timezone timestamps
6. **Foreign Keys**: Defined but not enforced (no `PRAGMA foreign_keys = ON`)
7. **JSON Storage**: Complex objects stored as TEXT (e.g., `capabilities`, `dimension_scores`)

## Reference Files

See `references/` directory for detailed table schemas including:
- CREATE TABLE DDL
- Column details (Name | Type | Nullable | Description)
- Indexes and foreign keys
- Source file locations
