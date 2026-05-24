# WS im.room.dissolved

Client → Server message to dissolve an IM room and notify all members. Removes room from Hub DB and in-memory tracking.

## Signature

```typescript
// Client → Server (encrypted)
{
  type: 'im.room.dissolved',
  roomId: string
}

// Server → Client (broadcast to remaining members, encrypted)
// Same format as request
```

## Business Flow

1. **Forward Broadcast**: Send encrypted dissolution message to all members (except sender)
2. **Delete from DB**: Remove room record from `im_rooms` table
3. **Clear In-Memory**: Delete from `WsHub.imRoomMembers` Map
4. **Client Cleanup**: Clients remove room locally and stop syncing

## Called Services

- `WsHub.broadcastToImRoom()` - Broadcast to exact member set (before deletion)
- `IMDB.deleteRoom()` - Remove room from database
- `WsHub.imRoomMembers.delete()` - Clear in-memory membership tracking
- `encryptIMMessage()` - Encrypt with PSK before transmission

## Source File

`src/ws-server.ts` - `WsHub.handleImRoomDissolved()`

## Error Responses

None - dissolution is fire-and-forget. If roomId invalid, message is silently ignored.

## Side Effects

- **Immediate Broadcast**: All online members receive notification before deletion
- **Offline Members**: DB deletion means they won't see room on reconnect (intended)
- **History Loss**: Room and message history remain in DB but room metadata deleted

## Usage Context

Called when room owner closes room, or when last member leaves. Unlike `room.dissolved` (task room API), this is IM-specific and doesn't check active tasks.
