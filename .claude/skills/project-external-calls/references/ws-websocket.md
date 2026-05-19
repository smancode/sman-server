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
- **Dependencies**: Requires HTTP server instance, RoomDB, PSK, TaskEngine
- **Initialization**: `src/index.ts` - Creates `WsHub` after server starts listening

## Call Locations

| File | Purpose |
|------|---------|
| `src/ws-server.ts` | WsHub class managing WebSocket connections, auth, rooms |
| `src/index.ts` | Creates WsHub instance and attaches to HTTP server |
| `src/ws-task-handler.ts` | Task-related WebSocket message handling |

## Purpose

**Real-time bidirectional communication** with desktop clients:
- Authenticated connections (PSK-based)
- Room-based pub/sub for workspace collaboration
- Task status updates and broadcasts
- Stale connection cleanup (90-second timeout)

## Authentication Flow

1. **Connection timeout**: 5 seconds to send auth message
2. **Auth message**: Encrypted payload with `{ type: 'auth', clientId, pskVersion: 1 }`
3. **Validation**: Decrypt payload, validate PSK version and timestamp
4. **Success**: Mark as authenticated, allow operations
5. **Failure**: Close connection with error code

## Message Types

### Client → Server
- `auth` - Authentication (required, first message)
- `subscribe` - Subscribe to room
- `unsubscribe` - Unsubscribe from room
- `task:update` - Task status updates

### Server → Client
- `broadcast` - Room broadcasts
- `task:status` - Task status notifications

## Stale Connection Cleanup

- **Check interval**: 60 seconds
- **Threshold**: 90 seconds of inactivity
- **Action**: Close stale connections with code 4000
