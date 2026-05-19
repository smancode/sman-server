---
name: database-schema
description: Database schema knowledge for sman-server: table structures, relationships, indexes, and DDL
commitHash: 6a87529d7c30fef9a812f0d1b6bbfa87c5870fed
scannedAt: 2026-05-20T03:04:00Z
branch: master
---

# Sman-Server Database Schema

## Database Overview
- **Engine**: better-sqlite3 (synchronous Node.js bindings)
- **Mode**: WAL (Write-Ahead Logging) for concurrency
- **Location**: `data/hub.db` (created on startup if missing)
- **Architecture**: No ORM, raw SQL with prepared statements
- **Total Tables**: 13 tables

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

## References
See `references/` directory for detailed table documentation.
