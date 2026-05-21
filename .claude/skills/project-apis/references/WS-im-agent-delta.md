# WS im.agent_delta

Transparent forward of agent presence delta updates (client → server → client).

## Signature

```typescript
// Client → Server → Client (broadcast within room)
{
  type: 'im.agent_delta',
  roomId: string,
  // ... other agent delta fields (opaque payload)
}
```

## Description

Transparently forwards agent presence delta updates to all clients in the room. The server does not process or store the payload - it simply validates `roomId` and broadcasts to all connected clients in that room.

Use case: Real-time agent status updates (online/offline, capability changes, etc.) without server-side logic.

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| roomId | string | Yes | Target room for broadcast |

## Business Flow

1. **Validate**: Check `roomId` exists
2. **Broadcast**: Forward entire message to all clients in room (including sender)

## Called Services

- `broadcastToRoom(roomId, msg)` - WebSocket broadcast

## Source File

`src/ws-server.ts` - `WsHub.handleImTransparent()`
