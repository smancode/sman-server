---
name: project-apis
description: API endpoint knowledge for sman-server. Contains all HTTP endpoints with signatures, parameters, business flows, and source references.
_scanned:
  commitHash: 312f64fbef5f2cd1acae067c829101d7e6203a92
  scannedAt: 2026-05-21T19:16:04Z
  branch: master
---

# API Endpoints

## Client Reporting API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /api/report | Submit encrypted client usage report | [POST-api-report.md](references/POST-api-report.md) |
| POST | /api/error-report | Submit encrypted error report | [POST-api-error-report.md](references/POST-api-error-report.md) |
| POST | /api/feedback | Submit user feedback with rate limit | [POST-api-feedback.md](references/POST-api-feedback.md) |
| POST | /api/achievement-report | Upload achievement leaderboard score | [POST-api-achievement-report.md](references/POST-api-achievement-report.md) |
| GET | /api/achievement-leaderboard | Get achievement rankings (public) | [GET-api-achievement-leaderboard.md](references/GET-api-achievement-leaderboard.md) |

## Broadcast API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /api/broadcasts | Fetch new broadcasts since timestamp | [POST-api-broadcasts.md](references/POST-api-broadcasts.md) |
| POST | /api/ack | Mark broadcasts as read | [POST-api-ack.md](references/POST-api-ack.md) |

## Admin API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /admin/broadcast | Create new broadcast | [POST-admin-broadcast.md](references/POST-admin-broadcast.md) |
| GET | /admin/broadcasts | List all broadcasts | [GET-admin-broadcasts.md](references/GET-admin-broadcasts.md) |
| DELETE | /admin/broadcast/:id | Soft delete broadcast | [DELETE-admin-broadcast-id.md](references/DELETE-admin-broadcast-id.md) |
| GET | /admin/stats | Get hub statistics | [GET-admin-stats.md](references/GET-admin-stats.md) |
| GET | /admin/clients | List all clients with workspaces | [GET-admin-clients.md](references/GET-admin-clients.md) |
| PUT | /admin/upload | Upload update files (.yml, .dmg, .exe, .blockmap) | [PUT-admin-upload.md](references/PUT-admin-upload.md) |
| POST | /admin/publish | Publish update with external URL | [POST-admin-publish.md](references/POST-admin-publish.md) |
| GET | /admin/latest-yml | Get latest.yml for both platforms | [GET-admin-latest-yml.md](references/GET-admin-latest-yml.md) |
| GET | /admin/stardom-dev-mode | Get Stardom dev mode status | [GET-admin-stardom-dev-mode.md](references/GET-admin-stardom-dev-mode.md) |
| PUT | /admin/stardom-dev-mode | Toggle Stardom dev mode | [PUT-admin-stardom-dev-mode.md](references/PUT-admin-stardom-dev-mode.md) |
| GET | /admin/hub-dev-mode | Get Hub dev mode status | [GET-admin-hub-dev-mode.md](references/GET-admin-hub-dev-mode.md) |
| PUT | /admin/hub-dev-mode | Toggle Hub dev mode | [PUT-admin-hub-dev-mode.md](references/PUT-admin-hub-dev-mode.md) |
| GET | /admin/error-reports | List error reports with limit | [GET-admin-error-reports.md](references/GET-admin-error-reports.md) |
| DELETE | /admin/error-reports/:id | Delete error report | [DELETE-admin-error-reports-id.md](references/DELETE-admin-error-reports-id.md) |
| GET | /admin/feedbacks | List feedbacks with limit | [GET-admin-feedbacks.md](references/GET-admin-feedbacks.md) |
| DELETE | /admin/feedbacks/:id | Delete feedback | [DELETE-admin-feedbacks-id.md](references/DELETE-admin-feedbacks-id.md) |
| GET | /admin/pageviews | Get page views by date | [GET-admin-pageviews.md](references/GET-admin-pageviews.md) |
| GET | /admin/pageviews/ips | Get page view IPs with counts | [GET-admin-pageviews-ips.md](references/GET-admin-pageviews-ips.md) |
| GET | /admin/downloads | Get download stats and logs | [GET-admin-downloads.md](references/GET-admin-downloads.md) |
| GET | /admin/leaderboard | Get paginated achievement leaderboard | [GET-admin-leaderboard.md](references/GET-admin-leaderboard.md) |

## Hub API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| POST | /api/hub/stardom-dev-mode | Get Stardom dev mode status (encrypted) | [POST-api-hub-stardom-dev-mode.md](references/POST-api-hub-stardom-dev-mode.md) |
| POST | /api/hub/hub-dev-mode | Get Hub dev mode status (encrypted) | [POST-api-hub-hub-dev-mode.md](references/POST-api-hub-hub-dev-mode.md) |

## Public API

| Method | Path | Description | Reference |
|--------|------|-------------|-----------|
| GET | /health | Health check endpoint | [GET-health.md](references/GET-health.md) |
| GET | /api/health | Health check endpoint | [GET-api-health.md](references/GET-api-health.md) |
| POST | /api/pageview | Record public page view | [POST-api-pageview.md](references/POST-api-pageview.md) |
| GET | /download/:filename | Download update file with redirect support | [GET-download-filename.md](references/GET-download-filename.md) |
| GET | /updates/sman/:filename | Download update file (legacy path) | [GET-updates-sman-filename.md](references/GET-updates-sman-filename.md) |
| GET | /download/windows-x64 | Windows friendly download redirect | [GET-download-windows-x64.md](references/GET-download-windows-x64.md) |
| GET | /download/macos-arm | macOS ARM friendly download redirect | [GET-download-macos-arm.md](references/GET-download-macos-arm.md) |

## WebSocket API

| Message Type | Direction | Description | Reference |
|--------------|-----------|-------------|-----------|
| auth.psk | Client → Server | Authenticate WebSocket connection with PSK | [WS-auth-psk.md](references/WS-auth-psk.md) |
| agent.register | Client → Server | Register agent in a room with capabilities | [WS-agent-register.md](references/WS-agent-register.md) |
| agent.unregister | Client → Server | Unregister agent from room | [WS-agent-unregister.md](references/WS-agent-unregister.md) |
| agent.heartbeat | Client → Server | Update agent heartbeat timestamp | [WS-agent-heartbeat.md](references/WS-agent-heartbeat.md) |
| agent.list | Client → Server | List all agents in a room | [WS-agent-list.md](references/WS-agent-list.md) |
| agent.registered | Server → Client | Confirm agent registration with agent ID | [WS-agent-registered.md](references/WS-agent-registered.md) |
| agent.list.update | Server → Client | Broadcast agent list updates for room | [WS-agent-list-update.md](references/WS-agent-list-update.md) |
| im.send | Client → Server | Send IM message to room | [WS-im-send.md](references/WS-im-send.md) |
| im.sync | Client → Server | Request IM message sync since timestamp | [WS-im-sync.md](references/WS-im-sync.md) |
| im.message | Server → Client | Broadcast IM message to room | [WS-im-message.md](references/WS-im-message.md) |
| im.agent_delta | Client → Server → Client | Transparent forward agent presence delta | [WS-im-agent-delta.md](references/WS-im-agent-delta.md) |
| im.presence | Client → Server → Client | Transparent forward presence status | [WS-im-presence.md](references/WS-im-presence.md) |
| im.typing | Client → Server → Client | Transparent forward typing indicator | [WS-im-typing.md](references/WS-im-typing.md) |
| error | Server → Client | Error response for any failed operation | [WS-error.md](references/WS-error.md) |

## Summary of Changes (v6068753 → v312f64f)

### New WebSocket IM Feature
**Purpose**: Enable real-time instant messaging between agents in rooms with message persistence and sync.

**Changes**:
- Added `IMDB` class (`src/db-im.ts`) for message storage with 7-day retention
- Added 3 IM message handlers to `WsHub`:
  - `im.send` - Store and broadcast messages (supports quotes, mentions, attachments)
  - `im.sync` - Fetch messages after timestamp with 200-message limit
  - Transparent forwarding for `im.agent_delta`, `im.presence`, `im.typing`
- Background cleanup job deletes messages older than 7 days (hourly interval)

### Database Schema Changes
**Breaking**: Added `workspace_name` column to `agents` table in `db-rooms.ts` (migration on startup)

### Endpoint Counts
- **HTTP endpoints**: 36 (no change)
- **WebSocket message types**: 17 (added 7 IM-related messages)
