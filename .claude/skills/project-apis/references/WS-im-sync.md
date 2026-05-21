# WS im.sync

Request IM message synchronization since a given timestamp.

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
    messages: IMMessageRow[]   // Up to 200 messages
  }
}

// IMMessageRow structure
{
  id: string,
  room_id: string,
  sender: string,
  content: string,
  mentioned_agents: string | null,    // JSON string
  quote_id: string | null,
  type: string,
  status: string | null,
  attachments: string | null,         // JSON string
  session_id: string | null,
  timestamp: number,
  created_at: string                  // ISO datetime
}
```

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| roomId | string | Yes | - | Room ID to fetch messages from |
| afterTimestamp | number | No | 0 | Unix timestamp (ms), only return messages after this |

## Business Flow

1. **Validate**: Check `roomId` is present
2. **Query**: Fetch messages from `im_messages` where `timestamp > afterTimestamp`
3. **Limit**: Return max 200 messages, ordered by `timestamp ASC`
4. **Respond**: Send message array to requesting client only (not broadcast)

## Called Services

- `IMDB.getMessagesAfter(roomId, afterTimestamp, 200)` - Query database

## Source File

`src/ws-server.ts` - `WsHub.handleImSync()`

## Error Responses

- `error` - Missing `roomId`
