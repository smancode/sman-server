# WS im.send

Send IM message to a room with persistence and broadcast. Supports agent lifecycle (running→completed) via upsert.

## Signature

```typescript
// Client → Server (encrypted)
{
  type: 'im.send',
  id?: string,                   // Message UUID (auto-generated if missing)
  roomId: string,                // Target room ID
  sender?: string,               // Sender ID (validated against client)
  content?: string,              // Message text (empty allowed for agent status)
  mentionedAgents?: string[],    // Array of mentioned agent IDs
  quoteId?: string,              // ID of quoted message
  msgType?: string,              // Message type (default: 'text')
  seq?: number,                  // Sequence number (default: 0)
}

// Encrypted payload fields
{
  content: string,               // Decrypted content
  type?: string,                 // Decrypted message type
  status?: string,               // Agent status (running/completed)
  attachments?: object,          // Attachment metadata (JSON)
  sessionId?: string             // Session identifier
}

// Server → Client (broadcast to room members, encrypted)
{
  type: 'im.message',
  id: string,
  roomId: string,
  sender: string,
  content: string,
  msgType: string,
  timestamp: number,
  seq: number,
  mentionedAgents?: string[],
  quoteId?: string,
  status?: string,
  sessionId?: string
}
```

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| roomId | string | Yes | - | Target room ID |
| content | string | No | '' | Message text (empty for agent status) |
| id | string | No | UUID v4 | Unique message ID |
| sender | string | No | Client ID | Sender (validated) |
| msgType | string | No | 'text' | Message type |
| seq | number | No | 0 | Sequence number |
| mentionedAgents | string[] | No | - | Mentioned agent IDs |
| quoteId | string | No | - | Quoted message ID |

## Business Flow

1. **Decrypt**: Extract content from encrypted payload
2. **Validate Sender**: Must match clientId or be client's agent (clientId/*)
3. **Track Membership**: Add sender (real client, not agent) to room membership
4. **Upsert**: Insert new or update existing (for agent lifecycle: running→completed)
5. **Broadcast**: Send to room members only (excludes sender) via `broadcastToImRoom`

## Called Services

- `decryptIMMessage()` - Decrypt payload with PSK
- `IMDB.upsertMessage()` - Insert or update message in database
- `WsHub.addImRoomMember()` - Track sender as room member
- `WsHub.broadcastToImRoom()` - Targeted broadcast to exact member set
- `encryptIMMessage()` - Encrypt broadcast payload with PSK

## Source File

`src/ws-server.ts` - `WsHub.handleImSend()`

## Error Responses

- `error` - Missing `roomId`
- `error` - Server busy (max 20 concurrent IM operations)

## Side Effects

- **Membership Tracking**: Sender auto-added to `imRoomMembers` Set
- **Agent Lifecycle**: Same ID can update content/status (running→completed)
- **Room Persistence**: Room implicitly created if not exists
