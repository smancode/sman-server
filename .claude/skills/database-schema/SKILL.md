---
name: database-schema
description: Database schema knowledge for sman-server: table structures, relationships, indexes, and DDL
commitHash: 60687534e9e2a4acf2800a04840cf09048ff3dda
scannedAt: 2026-05-21T00:00:00Z
branch: master
---

# Sman-Server Database Schema

## Database Overview
- **Engine**: better-sqlite3 (synchronous Node.js bindings)
- **Mode**: WAL (Write-Ahead Logging) for concurrency
- **Location**: `data/hub.db` (created on startup if missing)
- **Architecture**: No ORM, raw SQL with prepared statements
- **Total Tables**: 15 tables

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

## References
See `references/` directory for detailed table documentation.
