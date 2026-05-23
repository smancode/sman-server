# WsHub - WebSocket Server

## Purpose

Real-time bidirectional communication hub for desktop clients using WebSocket protocol. Handles authentication, room-based pub/sub, instant messaging with encryption, task dispatch, and client search (including offline clients).

## Location

`src/ws-server.ts`

## Constructor Signature

```typescript
constructor(
  server: Server,           // HTTP server instance
  roomDB: RoomDB,           // Room management database
  imDB: IMDB,               // Instant messaging database
  hubDB: HubDBLike | null,  // Hub database for offline client search
  psk: string,              // Pre-shared key for encryption
  taskEngine?: TaskEngine   // Optional task processing engine
)
```

## ⚠️ Breaking Change (commit 1353222)

**Constructor signature changed**:
- **Before**: `new WsHub(server, roomDB, imDB, psk, taskEngine?)`
- **After**: `new WsHub(server, roomDB, imDB, hubDB, psk, taskEngine?)`
- **New Parameter**: `hubDB` (4th parameter) - enables offline client search
- **Interface**: Must implement `HubDBLike` with `getAllClients()` method

## HubDBLike Interface

```typescript
interface HubDBLike {
  getAllClients(): { client_id: string; hostname: string }[];
}
```

Implemented by `HubDB` class in `src/db.ts`.

## Core Features

### Authentication
- **Timeout**: 5 seconds to send auth message
- **Method**: PSK-based encrypted payload
- **Validation**: Timestamp check (±5 minutes), PSK version validation
- **Error Codes**: 4001 (timeout), 4002 (not authenticated), 4003 (timestamp expired), 4004 (invalid payload), 4005 (auth failed)

### Room Management
- Create, join, leave, dissolve rooms
- Room visibility (public/private)
- Room member list and agent list
- Pub/sub messaging to room members

### Instant Messaging
- Encrypted message storage and transmission
- Message sync with timestamp filtering
- Quotes, mentions, attachments support
- Sequence numbers for ordering
- 7-day automatic retention cleanup

### Agent Management
- Register/deregister agents with capabilities
- Heartbeat monitoring (90-second stale threshold)
- Status updates (online/busy/idle/offline)
- Workspace association

### Task Dispatch
- Integration with TaskEngine for background tasks
- Task status updates and broadcasts
- Room-scoped task operations

### Client Search (NEW - enhanced in commit 1353222)
- **Message**: `im.clients.search`
- **Search Scope**:
  1. WebSocket-connected clients (real-time)
  2. Registered clients from HubDB (includes offline clients)
- **Search Fields**: `client_id`, `hostname`
- **Max Results**: 20 clients
- **Matching**: Case-insensitive substring match

## Message Types

### Authentication
- `auth.psk` → `auth.ok` / `error`

### Room Operations
- `room.create` → `room.created`
- `room.join` → `room.joined` / `room.member.joined`
- `room.leave` → `room.left` / `room.member.left`
- `room.list` → `room.list.update`
- `room.dissolve` → `room.dissolved`
- `room.info` → `room.info.update`

### Agent Operations
- `agent.register` → `agent.registered` / `agent.online`
- `agent.deregister` → `agent.deregistered` / `agent.offline`
- `agent.heartbeat` → (no response, updates internal state)
- `agent.list` → `agent.list.update`

### Instant Messaging
- `im.send` → `im.message` (broadcast to room)
- `im.sync` → `im.sync` (with encrypted messages array)
- `im.clients.search` → `im.clients.search` (with results)
- `im.agent_delta`, `im.presence`, `im.typing` → transparent broadcast

### Task Operations
- `task.*`, `evaluation.*` → handled by `ws-task-handler.ts`

## Background Jobs

### Stale Agent Check
- **Interval**: 60 seconds
- **Threshold**: 90 seconds inactivity
- **Action**: Mark agents offline, broadcast `agent.offline` events

### IM Cleanup
- **Interval**: 1 hour
- **Retention**: 7 days
- **Action**: Delete old messages from `im.db`

## Graceful Shutdown

```typescript
wsHub.close(); // Stops timers, closes WebSocket server
```

## Dependencies

- **ws** - WebSocket server implementation
- **node:crypto** - UUID generation for agent IDs
- **crypto.ts** - PSK encryption/decryption
- **im-crypto.ts** - IM message encryption/decryption
- **RoomDB** - Room and agent persistence
- **IMDB** - Message persistence and cleanup
- **HubDB** - Offline client lookup (via HubDBLike interface)
- **TaskEngine** - Background task processing (optional)

## Key Patterns

- **Auth required**: All operations except `auth.psk` require authentication
- **Room isolation**: Messages only broadcast to room subscribers
- **Encryption**: All IM content encrypted via `im-crypto.ts`
- **Idempotency**: Repeated joins/leaves handled gracefully
- **Cleanup**: Automatic stale agent detection and message retention
- **Offline support**: Client search includes database clients, not just connected
