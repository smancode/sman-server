# WS im.send

Send IM message to a room with persistence and broadcast.

## Signature

```typescript
// Client → Server
{
  type: 'im.send',
  id: string,                    // Message UUID (optional, auto-generated if missing)
  roomId: string,                // Target room ID
  sender?: string,               // Sender ID (defaults to client's clientId)
  content: string,               // Message text content
  mentionedAgents?: string[],    // Array of mentioned agent IDs
  quoteId?: string,              // ID of quoted message
  type?: string,                 // Message type (default: 'text')
  status?: string,               // Optional status field
  attachments?: object,          // Optional attachment metadata
  sessionId?: string,            // Optional session ID
  timestamp?: number             // Message timestamp (default: Date.now())
}

// Server → Client (broadcast to room)
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

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| roomId | string | Yes | - | Target room ID |
| content | string | Yes | - | Message text |
| id | string | No | UUID v4 | Unique message ID |
| sender | string | No | Client ID | Sender identifier |
| mentionedAgents | string[] | No | - | Agent IDs mentioned in message |
| quoteId | string | No | - | ID of quoted message |
| type | string | No | 'text' | Message type |
| status | string | No | - | Optional status |
| attachments | object | No | - | Attachment metadata (JSON) |
| sessionId | string | No | - | Session identifier |
| timestamp | number | No | Date.now() | Unix timestamp (ms) |

## Business Flow

1. **Validate**: Check `roomId` and `content` are present
2. **Generate ID**: Use provided `id` or generate UUID v4
3. **Store**: Insert message into `im_messages` table (INSERT OR IGNORE)
4. **Broadcast**: Send `im.message` to all clients in room (including sender)

## Called Services

- `IMDB.insertMessage()` - Persist message to database
- `broadcastToRoom()` - Send to all WebSocket clients in room

## Source File

`src/ws-server.ts` - `WsHub.handleImSend()`

## Error Responses

- `error` - Missing `roomId` or `content`
- `error` - Database insert failure (silent, logged)
