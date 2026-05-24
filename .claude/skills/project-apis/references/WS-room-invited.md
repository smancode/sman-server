# WS im.room.invited

Server → Client message sent when a user is added to an IM room. Triggered by `im.room.updated` when new members are detected, or on authentication when pending rooms are discovered.

## Signature

```typescript
// Server → Client (encrypted)
{
  type: 'im.room.invited',
  roomId: string,
  members: string[],     // All room member IDs
  name: string           // Room name
}
```

## Business Flow

**Scenario 1: New member added via im.room.updated**
1. Client A sends `im.room.updated` with new member list
2. Hub detects which members are new (not in old `imRoomMembers` set)
3. Hub broadcasts `im.room.updated` to all members (confirmation)
4. Hub sends `im.room.invited` to newly added members (excluding sender)
5. New members fetch room data and message history via `im.sync`

**Scenario 2: Reconnection with pending rooms**
1. Client authenticates with Hub
2. Hub queries DB for rooms where clientId is a member
3. For each room: merge in-memory membership, send `im.room.invited`
4. Batch presence broadcasts per affected room

## Called Services

- `IMDB.getRoomsForMember()` - Fetch rooms from DB for offline discovery
- `WsHub.imRoomMembers` - In-memory membership tracking
- `WsHub.clientIdToWs` - Reverse index for targeted WebSocket lookup
- `encryptIMMessage()` - Encrypt message payload with PSK

## Source File

`src/ws-server.ts` - `WsHub.sendPendingImInvitations()`, `WsHub.handleImRoomUpdated()`

## Error Responses

None - this is a server-initiated notification. Clients that miss this message (offline) will receive it on next authentication.
