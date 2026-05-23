---
name: project-apis
description: API endpoint knowledge for sman-server. Contains all HTTP endpoints with signatures, parameters, business flows, and source references.
_scanned:
  commitHash: 135322221a07233e556d6b6aa887e121c9b3d358
  scannedAt: "2026-05-24T00:00:00Z"
  branch: "master"
---

# API Endpoints

## Client Reporting API
POST /api/report | POST /api/error-report | POST /api/feedback | POST /api/achievement-report | GET /api/achievement-leaderboard

## Broadcast API
POST /api/broadcasts | POST /api/ack

## Admin API
POST /admin/broadcast | GET /admin/broadcasts | DELETE /admin/broadcast/:id | GET /admin/stats | GET /admin/clients | PUT /admin/upload | POST /admin/publish | GET /admin/latest-yml | GET|PUT /admin/stardom-dev-mode | GET|PUT /admin/hub-dev-mode | GET|DELETE /admin/error-reports/:id | GET|DELETE /admin/feedbacks/:id | GET /admin/pageviews | GET /admin/pageviews/ips | GET /admin/downloads | GET /admin/leaderboard

## Rooms API (Admin)
GET|POST /admin/rooms | GET /admin/rooms/:id | POST /admin/rooms/:id/join | POST /admin/rooms/:id/leave | DELETE /admin/rooms/:id | GET /admin/agents

## Tasks API (Admin)
GET /admin/tasks | GET /admin/tasks/:id | GET /admin/tasks/:id/events | GET /admin/rooms/:roomId/task-stats | POST /admin/tasks | POST /admin/tasks/:id/cancel

## Hub API (Encrypted - PSK with 5-min replay protection)
POST /api/hub/rooms | POST /api/hub/rooms/:id | POST /api/hub/rooms/:id/join | POST /api/hub/rooms/:id/leave | POST /api/hub/rooms/:id/agents | POST /api/hub/rooms/:id/dissolve | POST /api/hub/agents | POST /api/hub/tasks | POST /api/hub/tasks/:id | POST /api/hub/tasks/:id/cancel | POST /api/hub/tasks/:id/stop | POST /api/hub/tasks/:id/confirm | POST /api/hub/tasks/:id/reject | POST /api/hub/tasks/:id/dispatch | POST /api/hub/evaluations | POST /api/hub/evaluations/submit | POST /api/hub/evaluations/:id/approve | POST /api/hub/evaluations/:id/reject | POST /api/hub/stardom-dev-mode | POST /api/hub/hub-dev-mode

## Public API
GET /health | GET /api/health | POST /api/pageview | GET /download/:filename | GET /updates/sman/:filename | GET /download/windows-x64 | GET /download/macos-arm

## WebSocket API (ws://host/ws, 5s auth timeout)
auth.psk/auth.ok | room.* | agent.* | im.send/im.sync/im.message/im.agent_delta/im.presence/im.typing/im.room.dissolved/im.clients.search | task.* | evaluation.* | error
Close codes: 4001-4005

## Summary of Changes (Since 312f64fb)

### New Features
- **IM Encryption**: `im-crypto.ts` for PSK-encrypted WebSocket transmission
- **IM Sequence Numbers**: `seq` column in `im_messages` for ordering/sync
- **Client Search Enhanced**: `im.clients.search` now includes offline clients from DB (max 20, matches clientId/hostname)
- **Hub API WebSocket Integration**: `createHubApiRouter()` accepts optional `wsHub` for real-time task broadcasts

### Bug Fixes
- **IM Field Reading**: Fixed `type`, `status`, `attachments`, `sessionId` to read from decrypted payload (`src/ws-server.ts:427-430`)

### Schema Changes
- `im_messages`: Added `seq INTEGER` ⚠️ MIGRATION (handled in `db-im.ts`)
- `achievement_leaderboard`: Added `dimension_scores TEXT` ⚠️ MIGRATION (handled in `db.ts`)

### Breaking Changes
None - all backward compatible with automatic migrations.
