# WS im.presence

Request or broadcast online user presence for an IM room. Server aggregates connected clients and broadcasts complete user list.

## Signature

```typescript
// Client → Server (request presence update)
{
  type: 'im.presence',
  roomId: string
}

// Server → Client (broadcast to room members, encrypted)
{
  type: 'im.presence',
  roomId: string,
  users: string[]    // Complete list of online user IDs
}
```

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| roomId | string | Yes | Target room for presence broadcast |

## Business Flow

1. **Schedule Broadcast**: Debounce rapid requests (150ms window)
2. **Aggregate Online Users**: Iterate `imRoomMembers`, check which have active WebSocket connections
3. **Broadcast**: Send complete online user list to all room members (encrypted)

## Called Services

- `WsHub.schedulePresenceBroadcast()` - Debounce mechanism (150ms)
- `WsHub.imRoomMembers` - In-memory member Set
- `WsHub.clientIdToWs` - Reverse index for O(1) connection checks
- `WsHub.broadcastToImRoom()` - Targeted broadcast
- `encryptIMMessage()` - Encrypt payload with PSK

## Source File

`src/ws-server.ts` - `WsHub.handleImPresence()`, `WsHub.broadcastImPresence()`

## Error Responses

None - missing `roomId` is silently ignored

## Side Effects

- **Debounced**: Multiple rapid calls collapse into single broadcast
- **Auto-triggered**: Presence broadcast triggered on client join/leave (via `schedulePresenceBroadcast`)
- **Complete State**: Each broadcast contains full online user list (not deltas)

## Performance

- **Debouncing**: 150ms delay prevents flooding on rapid joins/leaves
- **Efficient Lookup**: `clientIdToWs` Map enables O(1) connection checks vs O(n) iteration
- **Batch Broadcast**: Single broadcast per room vs per-user update
