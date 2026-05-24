# WsHub - WebSocket Server

## Purpose
Real-time bidirectional communication hub for desktop clients. Handles authentication, room-based pub/sub, instant messaging with encryption, task dispatch, client search, IM room management, and presence broadcasts.

## Location
`src/ws-server.ts` (853 lines)

## Constructor Signature
```typescript
constructor(
  server: Server, roomDB: RoomDB, imDB: IMDB,
  hubDB: HubDBLike | null, psk: string, taskEngine?: TaskEngine
)
```

## ⚠️ Breaking Change (commit 1353222)
**Constructor**: Added `hubDB` parameter (4th) for offline client search
**Interface**: Must implement `HubDBLike` with `getAllClients()` method

## Core Features
- **Authentication**: 5-second timeout, PSK-based encrypted payload, timestamp validation (±5 min)
- **Room Management**: Create, join, leave, dissolve rooms with pub/sub messaging
- **Instant Messaging**: Encrypted storage, sync, quotes, mentions, attachments, sequence numbers, 7-day cleanup
- **Agent Management**: Register/deregister, heartbeat (90s stale threshold), status updates
- **Task Dispatch**: TaskEngine integration for background tasks
- **Client Search**: WebSocket + HubDB (includes offline), case-insensitive substring match
- **NEW IM Room Management**: Room persistence, membership tracking, presence broadcasts, invitations on reconnect
- **NEW Concurrency Control**: Max 20 concurrent IM operations
- **NEW Performance**: Reverse index, debounced presence (150ms), structured logging

## Internal Data Structures
```typescript
private clients = Map<WebSocket, AuthedClient>
private clientIdToWs = Map<string, WebSocket>  // O(1) reverse lookup
private rooms = Map<string, Set<WebSocket>>
private imRoomMembers = Map<string, Set<string>>  // Room → member clientIds
private pendingPresenceBroadcasts = Map<string, Timer>  // Debounced presence
private imActiveCount = number  // Concurrency guard (max 20)
```

## Message Types
**Auth**: `auth.psk` → `auth.ok` / `error`
**Rooms**: `room.create/join/leave/list/dissolve/info` → corresponding responses
**Agents**: `agent.register/deregister/heartbeat/list` → status updates
**IM**: `im.send` → `im.message`, `im.sync` → sync response, `im.clients.search` → results, `im.agent_delta`, `im.typing`, `im.room.dissolved`, `im.presence`, `im.room.updated`
**Tasks**: `task.*`, `evaluation.*` → handled by `ws-task-handler.ts`

## Background Jobs
- **Stale Agent Check**: Every 60s, mark agents offline after 90s inactivity
- **IM Cleanup**: Every 1 hour, delete messages older than 7 days

## ⚠️ New Features (commit d76da6e)
- **Room Persistence**: `im_rooms` table with members, name, last_message_time
- **Membership Tracking**: In-memory `imRoomMembers` Map tracks room membership
- **Room Invitations**: On auth, clients receive `im.room.invited` for all their rooms
- **Presence Broadcasts**: `im.presence` messages show online members (debounced 150ms)
- **Room Updates**: `im.room.updated` syncs membership changes
- **Concurrency**: Max 20 concurrent `im.send/sync/room.updated` operations
- **Logging**: `LOG()` function with `[HubWS]` prefix for debugging

## Key Patterns
- Auth required for all operations except `auth.psk`
- Room isolation (messages only to subscribers)
- All IM content encrypted via `im-crypto.ts`
- Automatic stale agent detection and message retention cleanup
- Client search includes database clients (not just connected)
- Real-time presence awareness for room members
- Concurrency safety for IM operations
