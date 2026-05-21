# IM System - Real-time Instant Messaging

## Purpose

Real-time instant messaging system integrated into the WebSocket infrastructure, providing persistent message storage, transparent message routing, and automatic cleanup of old messages.

## Architecture

The IM system consists of three layers:
1. **Persistence Layer**: `IMDB` class (`src/db-im.ts`) - SQLite-based message storage
2. **Transport Layer**: `WsHub` (`src/ws-server.ts`) - WebSocket message routing
3. **Client Layer**: Desktop clients send/receive IM messages via WebSocket

## Key Components

### IMDB (`src/db-im.ts`)

**Purpose**: Persistent storage for instant messages with automatic cleanup.

**Table Schema**:
```sql
CREATE TABLE im_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  mentioned_agents TEXT,        -- JSON array of agent IDs
  quote_id TEXT,                -- ID of quoted message
  type TEXT NOT NULL DEFAULT 'text',
  status TEXT,
  attachments TEXT,             -- JSON array of attachment metadata
  session_id TEXT,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_im_msg_room_ts ON im_messages(room_id, timestamp);
```

**Key Methods**:
- `insertMessage(msg)` - Store a new message (INSERT OR IGNORE to prevent duplicates)
- `getMessagesAfter(roomId, afterTimestamp, limit)` - Sync messages since last timestamp
- `deleteOldMessages()` - Delete messages older than 7 days (called hourly)
- `close()` - Clean database shutdown

**Data Retention**: 7 days (configurable via `deleteOldMessages()` cutoff)

### WebSocket Message Types (`src/ws-server.ts`)

**IM-Specific Handlers**:

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `im.send` | Client → Server | Send a message to a room |
| `im.sync` | Client → Server | Request messages after a timestamp |
| `im.message` | Server → Client | Broadcast message to room members |
| `im.agent_delta` | Transparent | Pass-through agent state changes |
| `im.presence` | Transparent | Pass-through presence updates |
| `im.typing` | Transparent | Pass-through typing indicators |

**Message Flow**:
1. Client sends `im.send` with `{ roomId, content, sender, mentionedAgents?, quoteId?, type?, status?, attachments?, sessionId?, timestamp? }`
2. Server stores message in `im_messages` table via `IMDB.insertMessage()`
3. Server broadcasts `im.message` to all clients in the room via `broadcastToRoom()`
4. Clients can request missed messages via `im.sync` with `{ roomId, afterTimestamp }`

### Transparent Message Routing

Messages of types `im.agent_delta`, `im.presence`, and `im.typing` are routed transparently:
- No database storage
- No validation beyond `roomId` presence
- Direct broadcast to room members via `broadcastToRoom()`

**Use Case**: Real-time presence/typing indicators that don't need persistence

## Integration Points

### Initialization (`src/index.ts`)
```typescript
const imDB = new IMDB(path.join(DATA_DIR, 'im.db'));
const wsHub = new WsHub(server, roomDB, imDB, PSK, taskEngine);
```

### Cleanup Job (`src/ws-server.ts`)
```typescript
const IM_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

this.imCleanupTimer = setInterval(() => {
  const deleted = this.imDB.deleteOldMessages();
  if (deleted > 0) {
    console.log(`[IM] Cleaned up ${deleted} messages older than 7 days`);
  }
}, IM_CLEANUP_INTERVAL_MS);
```

### Shutdown Hooks (`src/index.ts`)
```typescript
process.on('SIGTERM', () => {
  server.close(() => {
    imDB.close();  // Clean shutdown
    process.exit(0);
  });
});
```

## Dependencies

- **better-sqlite3** - Message persistence
- **ws** (WebSocket) - Message transport
- **RoomDB** - Room membership validation (indirect via WsHub)

## Key Patterns

- **INSERT OR IGNORE**: Prevent duplicate message storage if client retries
- **Timestamp-based sync**: Efficient delta sync via `getMessagesAfter()`
- **Transparent routing**: Presence/typing messages bypass storage
- **Automatic cleanup**: Hourly job prevents unbounded database growth
- **Room-based broadcasting**: Messages only sent to room members

## Performance Considerations

- Index on `(room_id, timestamp)` for efficient sync queries
- 7-day retention keeps database size bounded
- Transparent routing avoids unnecessary database writes
- Default limit of 200 messages per sync request
