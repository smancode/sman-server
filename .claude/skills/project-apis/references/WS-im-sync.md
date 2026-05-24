# WS im.sync

Request IM message synchronization since a given timestamp. Validates membership before returning messages.

## Signature

```typescript
// Client → Server
{
  type: 'im.sync',
  roomId: string,              // Room ID to sync
  afterTimestamp?: number      // Sync messages after this timestamp (default: 0)
}

// Server → Client
{
  type: 'im.sync',
  data: {
    roomId: string,
    messages: object[]         // Encrypted message array
  }
}
```

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| roomId | string | Yes | - | Room ID to fetch messages from |
| afterTimestamp | number | No | 0 | Unix timestamp (ms), only return messages after this |

## Business Flow

1. **Validate Membership**: Check in-memory `imRoomMembers` first
2. **Fallback to DB**: If not in memory, query `im_rooms` table for membership
3. **Re-register**: Add client to in-memory set if found in DB
4. **Query Messages**: Fetch messages where `timestamp > afterTimestamp`
5. **Encrypt**: Encrypt each message with PSK for transmission
6. **Respond**: Send encrypted array to requesting client only

## Called Services

- `WsHub.imRoomMembers` - In-memory membership check
- `IMDB.getRoom()` - Fallback DB membership check
- `IMDB.getMessagesAfter()` - Query message history
- `WsHub.addImRoomMember()` - Re-register in-memory on DB fallback
- `encryptIMMessage()` - Encrypt messages with PSK

## Source File

`src/ws-server.ts` - `WsHub.handleImSync()`

## Error Responses

- `error` - Missing `roomId`
- `error` - Not a member of this room (neither in-memory nor DB)

## Side Effects

- **Membership Repair**: Clients with valid DB membership but missing in-memory tracking are automatically re-registered
- **No Broadcast**: Sync responses are unicast to requester only
