# ws (WebSocket)

WebSocket server for real-time communication with desktop clients using the `ws` package.

## Call Methods

### Server Setup
```typescript
import { WebSocketServer } from 'ws';
import type { Server } from 'node:http';

const wss = new WebSocketServer({ server, path: '/ws' });
```

### Message Handling
```typescript
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    // Handle message...
  });

  ws.send(JSON.stringify({ type: 'broadcast', data }));
});
```

### Room Management
```typescript
// Subscribe to room
const room = 'workspace-123';
if (!rooms.has(room)) rooms.set(room, new Set());
rooms.get(room)!.add(ws);

// Broadcast to room
for (const client of rooms.get(room) || []) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
}
```

## Config Source

- **WebSocket path**: `/ws` (hardcoded)
- **Server attachment**: Attached to main HTTP server in `src/index.ts`
- **Dependencies**: Requires HTTP server instance, RoomDB, IMDB, PSK, TaskEngine
- **Initialization**: `src/index.ts` - Creates `WsHub` after server starts listening

## Call Locations

| File | Purpose |
|------|---------|
| `src/ws-server.ts` | WsHub class managing WebSocket connections, auth, rooms, IM, tasks, client search |
| `src/ws-task-handler.ts` | Task-related WebSocket message handling |
| `src/index.ts` | Creates WsHub instance and attaches to HTTP server |

## Purpose

**Real-time bidirectional communication** with desktop clients:
- Authenticated connections (PSK-based)
- Room-based pub/sub for workspace collaboration
- Task status updates and broadcasts
- **Instant messaging with encryption and sync**
- **Agent typing indicators and presence broadcasts**
- **Client search and discovery** (NEW)
- Stale connection cleanup (90-second timeout)
- Automatic IM message cleanup (7-day retention)

## Authentication Flow

1. **Connection timeout**: 5 seconds to send auth message
2. **Auth message**: Encrypted payload with `{ type: 'auth.psk', payload, timestamp, pskVersion: 1 }`
3. **Validation**: Decrypt payload, validate PSK version and timestamp (±5 minutes)
4. **Success**: Mark as authenticated, allow operations
5. **Failure**: Close connection with error code (4001-4005)

## Message Types

### Client → Server

**Authentication**
- `auth.psk` - Authentication (required, first message)

**Room Management**
- `room.create` - Create new room with visibility settings
- `room.join` - Join room (public or private with password)
- `room.leave` - Leave room
- `room.list` - List visible rooms (public + joined)
- `room.dissolve` - Dissolve room (owner only, checks active tasks)
- `room.info` - Get room details, members, agents

**Agent Management**
- `agent.register` - Register agent with capabilities
- `agent.deregister` - Deregister agent
- `agent.heartbeat` - Update agent heartbeat and status
- `agent.list` - List agents in room

**Instant Messaging**
- `im.send` - Send encrypted message to room (with quote, mentions, attachments, seq)
- `im.sync` - Sync encrypted messages after timestamp
- `im.agent_delta` - Agent list change notification (transparent, encrypted)
- `im.presence` - User presence notification (transparent, encrypted)
- `im.typing` - Typing indicator (transparent, encrypted)
- `im.clients.search` - Search connected clients (NEW - commit 5e4e0b4)

**Task Management**
- `task.*` - Task-related messages (handled by ws-task-handler)
- `evaluation.*` - Evaluation-related messages (handled by ws-task-handler)

### Server → Client

**Authentication**
- `auth.ok` - Authentication success
- `error` - Error responses

**Room Events**
- `room.created` - Room created
- `room.joined` - Successfully joined room
- `room.left` - Successfully left room
- `room.dissolved` - Room dissolved
- `room.member.joined` - New member joined
- `room.member.left` - Member left
- `room.list.update` - Room list update
- `room.info.update` - Room info update

**Agent Events**
- `agent.registered` - Agent registered
- `agent.deregistered` - Agent deregistered
- `agent.online` - Agent came online
- `agent.offline` - Agent went offline
- `agent.list.update` - Agent list update

**Instant Messaging**
- `im.message` - New encrypted message broadcast to room
- `im.sync` - Message sync response with encrypted messages array
- `im.clients.search` - Client search results (NEW - commit 5e4e0b4)

## IM Feature

**Purpose**: Real-time encrypted instant messaging within rooms

**Message Encryption** (NEW - commit ef4576e):
- Content and attachments encrypted via `im-crypto.ts`
- Encryption format: `enc:` + base64(AES-256-GCM payload)
- Automatic decryption on receive, encryption on send/broadcast
- Backward compatible with plaintext messages

**Message Storage**:
- Messages stored in `im.db` via IMDB class
- Automatic cleanup of messages older than 7 days
- Supports quotes, mentions, attachments, session tracking
- **Sequence numbers** for ordering and deduplication (NEW - commit 6d235fa)

**Message Sync**:
- `im.sync` returns encrypted messages after specified timestamp
- Default limit: 200 messages
- Ordered by timestamp ascending
- Messages include `seq` field for client-side ordering

**Transparent Messages** (passed through without database storage):
- `im.agent_delta` - Agent list changes (encrypted)
- `im.presence` - User presence updates (encrypted)
- `im.typing` - Typing indicators (encrypted)

## Client Search Feature (NEW - commit 5e4e0b4)

**Purpose**: Real-time client discovery and presence

**Message**: `im.clients.search`
**Parameters**: `{ query: string, seq: number }`
**Response**: `{ type: 'im.clients.search', results: [{ clientId }], seq }`

**Search Logic**:
- Case-insensitive substring match on `clientId`
- Searches all connected WebSocket clients
- Returns max 20 results
- Deduplicates clients with multiple connections
- Use case: Find users to invite to rooms or direct messaging

## Stale Connection Cleanup

- **Check interval**: 60 seconds
- **Threshold**: 90 seconds of inactivity
- **Action**: Mark agents as offline, broadcast offline events

## IM Cleanup

- **Interval**: 1 hour (3600000 ms)
- **Retention**: 7 days
- **Action**: Delete messages older than 7 days from im.db
- **Logging**: Logs count of deleted messages

## Graceful Shutdown

```typescript
process.on('SIGTERM', () => {
  wsHub.close();
  server.close(() => {
    imDB.close();
    roomDB.close();
    // ...
  });
});
```

## Breaking Changes

### IM Message Encryption (commit ef4576e)
- **Before**: IM messages in plaintext
- **After**: IM messages encrypted with `enc:` prefix
- **Impact**: Clients must support decryption of `enc:` prefixed content
- **Backward Compatible**: Non-encrypted fields pass through unchanged

### Message Sequence Numbers (commit 6d235fa)
- **Before**: Messages ordered by timestamp only
- **After**: Messages have explicit `seq` field
- **Database**: Automatic migration (ALTER TABLE with default value 0)
- **Index**: New `idx_im_msg_room_seq` index for efficient queries

### Client Search Feature (commit 5e4e0b4)
- **New Message Type**: `im.clients.search`
- **Use Case**: Client discovery for invitations and direct messaging
- **Max Results**: 20 clients per search
