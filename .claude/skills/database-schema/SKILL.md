---
name: database-schema
description: Database schema knowledge for sman-server: table structures, relationships, indexes, and DDL
commitHash: 312f64fbef5f2cd1acae067c829101d7e6203a92
scannedAt: 2026-05-22T00:00:00Z
branch: master
---

# Sman-Server Database Schema

## Database Overview
- **Engine**: better-sqlite3 (synchronous Node.js bindings)
- **Mode**: WAL (Write-Ahead Logging) for concurrency
- **Location**: `data/hub.db` (created on startup if missing)
- **Architecture**: No ORM, raw SQL with prepared statements
- **Total Tables**: 19 tables

## Core Tables

### clients
Client device records with version, hostname, IP, and activity tracking.

### reports
Time-series usage reports linked to clients (foreign key).

### broadcasts
Broadcast notifications with soft-delete flag.

### read_log
Many-to-many junction table tracking which broadcasts each client has read.

### hub_settings
Key-value configuration storage (e.g., stardom_dev_mode flag).

### error_reports
Error tracking with session context, workspace, and LLM metadata.

### feedback
User feedback submissions with workspace and LLM context.

### page_views
Daily pageview aggregation by date.

### page_view_logs
Raw pageview logs with IP and timestamp.

### download_logs
Download tracking with IP, filename, and version extraction.

### client_workspaces
Many-to-many relationship between clients and their workspace paths.

### achievement_leaderboard
Agent achievement tracking with points, levels, tier counts, and dimension scores.

### achievement_leaderboard_log
Historical log of leaderboard changes with field-level diff tracking.

## Real-time Collaboration & IM System (NEW)

### rooms ⚠️ MIGRATION
Collaboration rooms supporting public/private visibility, password protection, and soft-delete.
**Migration**: Added `visibility` (public/private) and `password` columns via ALTER TABLE.

### room_members
Junction table managing room membership with roles (owner/member) and capacity enforcement.

### agents ⚠️ MIGRATION
AI agent registration with capabilities, status tracking, heartbeat monitoring, and workspace configuration.
**Migration**: Added `workspace_name` column via ALTER TABLE for human-readable workspace display.

### im_messages
Instant messaging for rooms with features like mentions, quotes, attachments, message types, and automatic 7-day retention.
**Relationship**: Links to rooms via room_id, supports quote threading via quote_id.

## Database Separation

The IM and Room system uses **separate SQLite databases**:
- **Main hub DB**: `data/hub.db` (15 tables: clients, reports, broadcasts, etc.)
- **Rooms DB**: Managed by `RoomDB` class, path configurable (3 tables: rooms, room_members, agents)
- **IM DB**: Managed by `IMDB` class, path configurable (1 table: im_messages)

Both Room and IM databases use WAL mode and independent file storage for isolation from the main hub database.

## Schema Changes Summary (Incremental Update)

### New Tables (1)
- **im_messages**: Chat messages with room-based threading, mentions, quotes, and auto-cleanup

### Modified Tables (1)
- **agents**: Added `workspace_name TEXT` column (nullable) for display purposes

### Integration Points
- **im_messages.room_id** → Logical foreign key to `rooms.id`
- **agents.workspace_name** → Display field complementing existing `workspace` path
- **Room/Agent system** → Standalone database with separate connection and file

## Migration Requirements

### ⚠️ ALTER TABLE Migrations
1. **agents.workspace_name** (db-rooms.ts:67-69)
   - Adds optional human-readable workspace name
   - Non-breaking (NULL allowed, no data migration needed)

2. **rooms.visibility** (db-rooms.ts:56-58)
   - Adds 'public'/'private' with CHECK constraint
   - Non-breaking (defaults to 'private')

3. **rooms.password** (db-rooms.ts:61-64)
   - Adds optional password for private rooms
   - Non-breaking (NULL allowed)

All migrations use try-catch blocks to handle existing columns gracefully.

## References
See `references/` directory for detailed table documentation.
