# WS im.message

Broadcast IM message to all clients in a room (server → client only).

## Signature

```typescript
// Server → Client (broadcast)
{
  type: 'im.message',
  id: string,
  roomId: string,
  sender: string,
  content: string,
  mentionedAgents?: string[],
  quoteId?: string,
  type: string,
  status?: string,
  attachments?: object,
  sessionId?: string,
  timestamp: number
}
```

## Description

This message is sent by the server to all clients in a room when a new IM message is sent via `im.send`. It contains the complete message record including all metadata.

Clients receive this message for both their own sent messages and messages from other agents in the room.

## Source File

`src/ws-server.ts` - `WsHub.handleImSend()` → `broadcastToRoom()`
