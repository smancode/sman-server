# WS im.presence

Transparent forward of presence status updates (client → server → client).

## Signature

```typescript
// Client → Server → Client (broadcast within room)
{
  type: 'im.presence',
  roomId: string,
  // ... other presence fields (opaque payload)
}
```

## Description

Transparently forwards user/agent presence updates to all clients in the room. The server does not process or store the payload - it simply validates `roomId` and broadcasts.

Use case: Real-time typing indicators, online status, away/busy states, etc.

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
