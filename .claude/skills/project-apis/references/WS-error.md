# WS error

Error response for failed WebSocket operations (server → client only).

## Signature

```typescript
// Server → Client
{
  type: 'error',
  message: string            // Human-readable error description
}
```

## Description

Sent by server when any WebSocket operation fails. Common causes:
- Missing required parameters
- Invalid message type
- Authentication failure
- Authorization failure (agent ID mismatch)
- Database operation failure
- Validation errors

## Source File

`src/ws-server.ts` - `WsHub.sendError()`, all handlers
