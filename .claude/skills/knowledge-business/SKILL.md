---
name: knowledge-business
description: Business knowledge for sman-server: product requirements, user flows, business rules, and domain terminology
commitHash: 6a87529d7c30fef9a812f0d1b6bbfa87c5870fed
scannedAt: 2026-05-20T03:04:00Z
branch: master
---

# Sman-Server Business Knowledge

Sman-server is a management hub for the Sman desktop application. It collects encrypted usage reports from remote clients, manages broadcast notifications, serves application updates, and provides a React admin dashboard.

## Core Business Flows

### 1. Client Report Submission Flow
Clients send encrypted usage reports every 5 minutes to `/api/report`. The server decrypts using AES-256-GCM pre-shared key (PSK), validates timestamp (5-minute window for replay protection), upserts client record, inserts report row, and replaces workspace list. Response includes server time and optional skill-auto-updater commands.

**Source:** `src/routes/report.ts`, `src/db.ts`

### 2. Broadcast Fetch and Ack Flow
Clients query `/api/broadcasts` with `since` timestamp to fetch new broadcasts since last check. Server filters by active flag and creation time, excludes already-read broadcasts (via `read_log` table), and returns encrypted response. Clients acknowledge reads via `/api/ack` to prevent re-delivery.

**Source:** `src/routes/broadcast.ts`

### 3. Update Serving Flow
Admin uploads installer files (.exe, .dmg, .zip, .blockmap, .yml) to `/admin/upload`. Server auto-generates `latest.yml` (Windows) or `latest-mac.yml` (macOS) with version, SHA512, size, and release notes. For external URLs, `/admin/publish` creates redirect mapping and yml. Files served from `/updates/sman/` path.

**Source:** `src/routes/admin.ts`

### 4. Admin Dashboard Operations
Bearer token auth required for all `/admin/*` routes. CRUD operations for broadcasts (create, list, soft-delete), client listing with workspace details, stats aggregation, error report/feedback management, and pageview/download analytics.

**Source:** `src/routes/admin.ts`

## Business Rules

- **Replay Protection**: Client requests must include Unix timestamp; server rejects if outside 5-minute window
- **Soft Delete**: Broadcasts use `active` flag instead of actual deletion
- **Encryption**: All client-to-server communication encrypted with AES-256-GCM using 32-char PSK
- **Rate Limiting**: Feedback endpoint limited to 1 submission per IP per 30 seconds
- **PSK Version**: Currently hardcoded to version 1
- **Auto-Generated YML**: Installer uploads trigger automatic yml generation for electron-updater

## References

See `references/` directory for detailed flow documentation.
