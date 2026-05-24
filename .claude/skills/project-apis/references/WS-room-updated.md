# WS im.room.updated

Client → Server message to update IM room membership and metadata. Persists to DB so offline users can discover rooms on reconnect.

## Signature

```typescript
// Client → Server (encrypted)
{
  type: 'im.room.updated',
  roomId: string,
  members: string[],     // Complete member list (replaces old)
  name?: string          // Room name (optional update)
}

// Server → Client (broadcast to all members, encrypted)
// Same format as request
```

## Business Flow

1. **Validate**: Room ID and member array required
2. **Detect New Members**: Compare incoming `members` vs existing `imRoomMembers` set
3. **Update In-Memory**: Replace `imRoomMembers` with new member set
4. **Persist to DB**: Upsert room record for offline discovery
5. **Broadcast Confirmation**: Send encrypted message to all members (including sender)
6. **Invite New Members**: Send `im.room.invited` to newly added members only

## Called Services

- `WsHub.imRoomMembers` - In-memory Set<string> of member IDs
- `IMDB.upsertRoom()` - Persist room to database
- `WsHub.broadcastToImRoom()` - Broadcast to exact member set
- `WsHub.clientIdToWs` - Target newly added members for invites
- `encryptIMMessage()` - Encrypt with PSK before transmission

## Source File

`src/ws-server.ts` - `WsHub.handleImRoomUpdated()`

## Error Responses

- None on success (broadcast confirmation = success)
- Fails silently if roomId/members missing (message ignored)

## Side Effects

- **New Member Discovery**: Added members receive `im.room.invited` immediately
- **Offline Persistence**: Room saved to DB, available on reconnect via `getRoomsForMember()`
- **Presence Sync**: Triggers full presence recalculation on next `im.presence` cycle
