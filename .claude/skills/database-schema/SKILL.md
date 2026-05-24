---
name: database-schema
description: Database schema knowledge for sman-server: table structures, relationships, indexes, and DDL
_scanned:
  commitHash: d76da6e344e1f66d3c5acec32502380c83ce5a68
  scannedAt: "2026-05-25T00:00:00Z"
  branch: "master"
---

# Database Schema Knowledge

## Overview
- **Engine**: better-sqlite3 (WAL mode)
- **Files**: hub.db, rooms.db, im.db, tasks.db (28 tables total)
- **Pattern**: Raw SQL, no ORM, prepared statements for performance

## Core Tables

| DB | Tables | Purpose |
|----|--------|---------|
| hub.db (13) | clients, reports, broadcasts, read_log, hub_settings, error_reports, feedback, page_views, page_view_logs, download_logs, client_workspaces, achievement_leaderboard, achievement_leaderboard_log | Client tracking, broadcasts, analytics |
| rooms.db (3) | rooms, room_members, agents | Room management, agent registration |
| im.db (2) | im_messages, im_rooms | Instant messaging |
| tasks.db (4) | tasks, task_events, evaluation_reports, task_assignments | Task lifecycle management |

## Schema Changes (Since 1353222)

### New Tables
- `im_rooms`: IM room metadata (members, last_message_time)

### Modified Tables
| Table | Change | Migration |
|-------|--------|-----------|
| `im_messages` | Added `seq INTEGER DEFAULT 0` | ⚠️ Yes |
| `agents` | Added `workspace_name TEXT` | ⚠️ Yes |
| `achievement_leaderboard` | Added `dimension_scores TEXT` | ⚠️ Yes |

### Migrations Applied
All migrations handled in-code with try-catch:
- `src/db-im.ts:63`: seq column (now in CREATE TABLE)
- `src/db-rooms.ts:67-69`: workspace_name column
- `src/db.ts:206-210`: dimension_scores column

## Key Design Patterns
1. **WAL mode** for concurrency
2. **Soft deletes** (`active` flags)
3. **Upsert patterns** (`ON CONFLICT DO UPDATE`)
4. **JSON storage** for complex objects
5. **Prepared statements** (IMDB)
6. **Try-catch migrations** for new columns

## Database Files
- `data/hub.db` → HubDB (`src/db.ts`)
- `data/rooms.db` → RoomDB (`src/db-rooms.ts`)
- `data/im.db` → IMDB (`src/db-im.ts`)
- `data/tasks.db` → TaskDB (`src/db-tasks.ts`)

## Reference Files
See `references/` for detailed table schemas with DDL, columns, indexes, and usage patterns.
