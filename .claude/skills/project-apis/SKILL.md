---
name: project-apis
description: API endpoint knowledge for sman-server. Contains all HTTP endpoints with signatures, parameters, business flows, and source references.
_scanned:
  commitHash: 5e4e0b43e7ba530e3efcd3e68e9814c38c250ae2
  scannedAt: "2026-05-22T19:08:21Z"
  branch: "master"
---

# API Endpoints

## Client Reporting API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /api/report | Submit encrypted client usage report | `references/POST-api-report.md` |
| POST | /api/error-report | Submit encrypted error report | `references/POST-api-error-report.md` |
| POST | /api/feedback | Submit user feedback with rate limit | `references/POST-api-feedback.md` |
| POST | /api/achievement-report | Upload achievement leaderboard score | `references/POST-api-achievement-report.md` |
| GET | /api/achievement-leaderboard | Get achievement rankings (public) | `references/GET-api-achievement-leaderboard.md` |

## Broadcast API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /api/broadcasts | Fetch new broadcasts since timestamp | `references/POST-api-broadcasts.md` |
| POST | /api/ack | Mark broadcasts as read | `references/POST-api-ack.md` |

## Admin API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /admin/broadcast | Create new broadcast | `references/POST-admin-broadcast.md` |
| GET | /admin/broadcasts | List all broadcasts | `references/GET-admin-broadcasts.md` |
| DELETE | /admin/broadcast/:id | Soft delete broadcast | `references/DELETE-admin-broadcast-id.md` |
| GET | /admin/stats | Get hub statistics | `references/GET-admin-stats.md` |
| GET | /admin/clients | List all clients with workspaces | `references/GET-admin-clients.md` |
| PUT | /admin/upload | Upload update files (.yml, .dmg, .exe, .blockmap) | `references/PUT-admin-upload.md` |
| POST | /admin/publish | Publish update with external URL | `references/POST-admin-publish.md` |
| GET | /admin/latest-yml | Get latest.yml for both platforms | `references/GET-admin-latest-yml.md` |
| GET | /admin/stardom-dev-mode | Get Stardom dev mode status | `references/GET-admin-stardom-dev-mode.md` |
| PUT | /admin/stardom-dev-mode | Toggle Stardom dev mode | `references/PUT-admin-stardom-dev-mode.md` |
| GET | /admin/hub-dev-mode | Get Hub dev mode status | `references/GET-admin-hub-dev-mode.md` |
| PUT | /admin/hub-dev-mode | Toggle Hub dev mode | `references/PUT-admin-hub-dev-mode.md` |
| GET | /admin/error-reports | List error reports with limit | `references/GET-admin-error-reports.md` |
| DELETE | /admin/error-reports/:id | Delete error report | `references/DELETE-admin-error-reports-id.md` |
| GET | /admin/feedbacks | List feedbacks with limit | `references/GET-admin-feedbacks.md` |
| DELETE | /admin/feedbacks/:id | Delete feedback | `references/DELETE-admin-feedbacks-id.md` |
| GET | /admin/pageviews | Get page views by date | `references/GET-admin-pageviews.md` |
| GET | /admin/pageviews/ips | Get page view IPs with counts | `references/GET-admin-pageviews-ips.md` |
| GET | /admin/downloads | Get download stats and logs | `references/GET-admin-downloads.md` |
| GET | /admin/leaderboard | Get paginated achievement leaderboard | `references/GET-admin-leaderboard.md` |

## Rooms API (Admin)

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| GET | /admin/rooms | List all rooms with member counts | `references/GET-admin-rooms.md` |
| GET | /admin/rooms/:id | Get room details with members and agents | `references/GET-admin-rooms-id.md` |
| POST | /admin/rooms | Create new room | `references/POST-admin-rooms.md` |
| POST | /admin/rooms/:id/join | Join a room | `references/POST-admin-rooms-id-join.md` |
| POST | /admin/rooms/:id/leave | Leave a room | `references/POST-admin-rooms-id-leave.md` |
| DELETE | /admin/rooms/:id | Deactivate a room | `references/DELETE-admin-rooms-id.md` |
| GET | /admin/agents | List all agents across all rooms | `references/GET-admin-agents.md` |

## Tasks API (Admin)

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| GET | /admin/tasks | List tasks by room/status | `references/GET-admin-tasks.md` |
| GET | /admin/tasks/:id | Get task details with events | `references/GET-admin-tasks-id.md` |
| GET | /admin/tasks/:id/events | Get task events | `references/GET-admin-tasks-id-events.md` |
| GET | /admin/rooms/:roomId/task-stats | Get task statistics for room | `references/GET-admin-rooms-roomid-task-stats.md` |
| POST | /admin/tasks | Create new task | `references/POST-admin-tasks.md` |
| POST | /admin/tasks/:id/cancel | Cancel a task | `references/POST-admin-tasks-id-cancel.md` |

## Hub API (Encrypted)

All endpoints use PSK encryption with replay protection (5-min window).

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /api/hub/rooms | List or create rooms | `references/POST-api-hub-rooms.md` |
| POST | /api/hub/rooms/:id | Get room details | `references/POST-api-hub-rooms-id.md` |
| POST | /api/hub/rooms/:id/join | Join room with optional password | `references/POST-api-hub-rooms-id-join.md` |
| POST | /api/hub/rooms/:id/leave | Leave room | `references/POST-api-hub-rooms-id-leave.md` |
| POST | /api/hub/rooms/:id/agents | List room agents | `references/POST-api-hub-rooms-id-agents.md` |
| POST | /api/hub/rooms/:id/dissolve | Dissolve room (owner only) | `references/POST-api-hub-rooms-id-dissolve.md` |
| POST | /api/hub/agents | List all agents | `references/POST-api-hub-agents.md` |
| POST | /api/hub/tasks | List or create tasks | `references/POST-api-hub-tasks.md` |
| POST | /api/hub/tasks/:id | Get task details | `references/POST-api-hub-tasks-id.md` |
| POST | /api/hub/tasks/:id/cancel | Cancel task | `references/POST-api-hub-tasks-id-cancel.md` |
| POST | /api/hub/tasks/:id/stop | Stop running task | `references/POST-api-hub-tasks-id-stop.md` |
| POST | /api/hub/tasks/:id/confirm | Confirm task for dispatch | `references/POST-api-hub-tasks-id-confirm.md` |
| POST | /api/hub/tasks/:id/reject | Reject task | `references/POST-api-hub-tasks-id-reject.md` |
| POST | /api/hub/tasks/:id/dispatch | Dispatch task to agents | `references/POST-api-hub-tasks-id-dispatch.md` |
| POST | /api/hub/evaluations | List evaluations | `references/POST-api-hub-evaluations.md` |
| POST | /api/hub/evaluations/submit | Submit evaluation | `references/POST-api-hub-evaluations-submit.md` |
| POST | /api/hub/evaluations/:id/approve | Approve evaluation | `references/POST-api-hub-evaluations-id-approve.md` |
| POST | /api/hub/evaluations/:id/reject | Reject evaluation | `references/POST-api-hub-evaluations-id-reject.md` |
| POST | /api/hub/stardom-dev-mode | Get Stardom dev mode | `references/POST-api-hub-stardom-dev-mode.md` |
| POST | /api/hub/hub-dev-mode | Get Hub dev mode | `references/POST-api-hub-hub-dev-mode.md` |

## Public API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| GET | /health | Health check endpoint | `references/GET-health.md` |
| GET | /api/health | Health check endpoint | `references/GET-api-health.md` |
| POST | /api/pageview | Record public page view | `references/POST-api-pageview.md` |
| GET | /download/:filename | Download update file with redirect support | `references/GET-download-filename.md` |
| GET | /updates/sman/:filename | Download update file (legacy path) | `references/GET-updates-sman-filename.md` |
| GET | /download/windows-x64 | Windows friendly download redirect | `references/GET-download-windows-x64.md` |
| GET | /download/macos-arm | macOS ARM friendly download redirect | `references/GET-download-macos-arm.md` |

## WebSocket API

**Connection**: `ws://host/ws` with 5-second auth timeout.

**Message Types**:

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| auth.psk | Client → Server | Authenticate WebSocket connection with PSK | `references/WS-auth-psk.md` |
| auth.ok | Server → Client | Authentication success | `references/WS-auth-ok.md` |

### Room Management

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| room.create | Client → Server | Create new room | `references/WS-room-create.md` |
| room.created | Server → Client | Room creation confirmation | `references/WS-room-created.md` |
| room.join | Client → Server | Join a room | `references/WS-room-join.md` |
| room.joined | Server → Client | Join confirmation | `references/WS-room-joined.md` |
| room.leave | Client → Server | Leave a room | `references/WS-room-leave.md` |
| room.left | Server → Client | Leave confirmation | `references/WS-room-left.md` |
| room.list | Client → Server | List visible rooms | `references/WS-room-list.md` |
| room.list.update | Server → Client | Room list update | `references/WS-room-list-update.md` |
| room.dissolve | Client → Server | Dissolve a room (owner only) | `references/WS-room-dissolve.md` |
| room.dissolved | Server → Client | Room dissolved notification | `references/WS-room-dissolved.md` |
| room.info | Client → Server | Get room details | `references/WS-room-info.md` |
| room.info.update | Server → Client | Room info update | `references/WS-room-info-update.md` |
| room.member.joined | Server → Client | Member joined broadcast | `references/WS-room-member-joined.md` |
| room.member.left | Server → Client | Member left broadcast | `references/WS-room-member-left.md` |

### Agent Management

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| agent.register | Client → Server | Register agent in room | `references/WS-agent-register.md` |
| agent.registered | Server → Client | Agent registration confirmation | `references/WS-agent-registered.md` |
| agent.unregister | Client → Server | Unregister agent | `references/WS-agent-unregister.md` |
| agent.deregistered | Server → Client | Agent deregistered confirmation | `references/WS-agent-deregistered.md` |
| agent.heartbeat | Client → Server | Update agent heartbeat | `references/WS-agent-heartbeat.md` |
| agent.list | Client → Server | List room agents | `references/WS-agent-list.md` |
| agent.list.update | Server → Client | Agent list update | `references/WS-agent-list-update.md` |
| agent.online | Server → Client | Agent came online | `references/WS-agent-online.md` |
| agent.offline | Server → Client | Agent went offline | `references/WS-agent-offline.md` |

### Instant Messaging

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| im.send | Client → Server | Send IM message (encrypted payload) | `references/WS-im-send.md` |
| im.sync | Client → Server | Request message sync since timestamp | `references/WS-im-sync.md` |
| im.message | Server → Client | Broadcast IM message (encrypted) | `references/WS-im-message.md` |
| im.agent_delta | Bidirectional | Agent presence delta (transparent) | `references/WS-im-agent-delta.md` |
| im.presence | Bidirectional | Presence status (transparent) | `references/WS-im-presence.md` |
| im.typing | Bidirectional | Typing indicator (transparent) | `references/WS-im-typing.md` |
| im.room.dissolved | Bidirectional | Room dissolved notification | `references/WS-im-room-dissolved.md` |
| im.clients.search | Client → Server | Search online clients | `references/WS-im-clients-search.md` |

### Task System

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| task.* | Bidirectional | Task lifecycle messages | `references/WS-task-system.md` |
| evaluation.* | Bidirectional | Evaluation messages | `references/WS-evaluation-system.md` |

### Error Handling

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| error | Server → Client | Error response | `references/WS-error.md` |

**Close Codes**:
- 4001: Auth timeout
- 4002: Not authenticated
- 4003: Timestamp expired
- 4004: Invalid payload
- 4005: Auth failed

## Summary of Changes (Since 312f64fb)

### New Features

#### IM Message Encryption
**Impact**: Enhanced security for IM content transmission.
- Added `im-crypto.ts` with `encryptIMMessage()` and `decryptIMMessage()` functions
- IM message content now encrypted in WebSocket transmission using PSK
- Plaintext stored in database for querying, encrypted for wire transfer

#### IM Message Sequence Numbering
**Impact**: Improved message ordering and sync reliability.
- Added `seq INTEGER` column to `im_messages` table
- Added index `idx_im_msg_room_seq` for efficient sequence-based queries
- Migration handled automatically in `db-im.ts`

#### Client Search Capability
**Impact**: Enable agents to discover and connect with other online clients.
- Added `im.clients.search` WebSocket message type
- Returns list of online clients matching query (max 20 results)
- Searches by clientId with case-insensitive matching

### Database Schema Changes

| Table | Change | Migration |
|-------|--------|-----------|
| `im_messages` | Added `seq INTEGER` column | ⚠️ MIGRATION (handled) |
| `achievement_leaderboard` | Added `dimension_scores TEXT` column | ⚠️ MIGRATION (handled) |

### Code Refactoring

#### PSK Loading Extraction
**Impact**: Improved code organization and reusability.
- Extracted PSK loading logic from `index.ts` to `crypto.ts`
- Added `loadPSK()` function with validation
- Centralized PSK version handling

### Endpoint Counts

- **HTTP endpoints**: 60 (no change from previous version)
- **WebSocket message types**: 39 (added 1 new: `im.clients.search`)

### Breaking Changes

None - all changes are backward compatible with proper migration handling.

### Migration Requirements

All migrations are handled automatically via try-catch blocks in database initialization:
- `im_messages.seq` column added in `src/db-im.ts`
- `achievement_leaderboard.dimension_scores` column added in `src/db.ts`
