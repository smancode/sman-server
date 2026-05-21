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
| `src/ws-server.ts` | WsHub class managing WebSocket connections, auth, rooms, IM, tasks |
| `src/ws-task-handler.ts` | Task-related WebSocket message handling |
| `src/index.ts` | Creates WsHub instance and attaches to HTTP server |

## Purpose

**Real-time bidirectional communication** with desktop clients:
- Authenticated connections (PSK-based)
- Room-based pub/sub for workspace collaboration
- Task status updates and broadcasts
- **NEW**: Instant messaging with sync and presence
- **NEW**: Agent typing indicators and presence broadcasts
- Stale connection cleanup (90-second timeout)
- **NEW**: Automatic IM message cleanup (7-day retention)

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

**Instant Messaging (NEW)**
- `im.send` - Send message to room (with optional quote, mentions, attachments)
- `im.sync` - Sync messages after timestamp
- `im.agent_delta` - Agent list change notification (transparent)
- `im.presence` - User presence notification (transparent)
- `im.typing` - Typing indicator (transparent)

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

**Instant Messaging (NEW)**
- `im.message` - New message broadcast to room
- `im.sync` - Message sync response with messages array

## IM Feature (NEW)

**Purpose**: Real-time instant messaging within rooms

**Message Storage**:
- Messages stored in `im.db` via IMDB class
- Automatic cleanup of messages older than 7 days
- Supports quotes, mentions, attachments, session tracking

**Message Sync**:
- `im.sync` returns messages after specified timestamp
- Default limit: 200 messages
- Ordered by timestamp ascending

**Transparent Messages** (passed through without database storage):
- `im.agent_delta` - Agent list changes
- `im.presence` - User presence updates
- `im.typing` - Typing indicators

## Stale Connection Cleanup

- **Check interval**: 60 seconds
- **Threshold**: 90 seconds of inactivity
- **Action**: Mark agents as offline, broadcast offline events

## IM Cleanup (NEW)

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
