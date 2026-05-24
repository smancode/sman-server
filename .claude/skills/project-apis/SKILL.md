---
name: project-apis
description: API endpoint knowledge for sman-server. Contains all HTTP endpoints with signatures, parameters, business flows, and source references.
_scanned:
  commitHash: d76da6e3c86e5e8d9228943c9fa88312e8cf3a1c
  scannedAt: "2026-05-25T00:00:00Z"
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
auth.psk/auth.ok | room.* | agent.* | im.send/im.sync/im.message/im.agent_delta/im.presence/im.typing/im.room.dissolved/im.room.updated/im.room.invited/im.clients.search | task.* | evaluation.* | error
Close codes: 4001-4005

## Summary of Changes (Since 1353222)

### New Features
- **IM Room Membership Tracking**: Hub now tracks IM room membership in-memory (`imRoomMembers` Map) for efficient presence broadcasts
- **IM Presence Broadcasting**: Debounced presence broadcasts (150ms) to avoid flooding on rapid joins/leaves
- **IM Room Invitation Flow**: `im.room.invited` message sent to newly added members, persists to DB for offline discovery
- **IM Room Dissolution**: `im.room.dissolved` broadcast before deleting membership, prevents orphaned state
- **IM Message Upsert**: Changed from INSERT to upsert for agent lifecycle (running→completed updates)
- **IM Concurrency Guard**: Max 20 concurrent IM operations to prevent server overload
- **ClientID Reverse Index**: O(1) WebSocket lookup by clientId for targeted broadcasts

### Bug Fixes
- **IM Field Validation**: Allow empty content for agent status updates (running state), validate sender field
- **IM Broadcast Targeting**: Changed from `broadcastToRoom` to `broadcastToImRoom` for precise member-only delivery
- **IM Message Fields**: Read `type`, `status`, `attachments`, `sessionId` from decrypted payload, not wrapper

### Breaking Changes
None - all backward compatible with graceful fallbacks (DB lookup on membership check failures).

### Performance Improvements
- **Debounced Presence**: Rapid joins/leaves batched into single broadcast per room
- **Efficient Lookups**: clientId→WebSocket Map eliminates O(n) client iteration
- **IM Cleanup**: Hourly deletion of messages >7 days old (configurable)
