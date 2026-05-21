# im_messages Table

## Purpose
Stores instant messages for the chat system, supporting room-based messaging with features like mentions, quotes, attachments, and message types. Implements automatic cleanup of messages older than 7 days.

## DDL
```sql
CREATE TABLE IF NOT EXISTS im_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  mentioned_agents TEXT,
  quote_id TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  status TEXT DEFAULT NULL,
  attachments TEXT,
  session_id TEXT,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_im_msg_room_ts ON im_messages(room_id, timestamp);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique message identifier (UUID)
- **room_id** (TEXT NOT NULL): References rooms.id, groups messages by room
- **sender** (TEXT NOT NULL): Client ID of message sender
- **content** (TEXT NOT NULL): Message text content
- **mentioned_agents** (TEXT | NULL): JSON array of agent IDs mentioned in message
- **quote_id** (TEXT | NULL): ID of quoted message (for reply threads)
- **type** (TEXT NOT NULL DEFAULT 'text'): Message type (text, system, notification, etc.)
- **status** (TEXT | NULL): Delivery status (sent, delivered, read, failed)
- **attachments** (TEXT | NULL): JSON array of attachment metadata
- **session_id** (TEXT | NULL): Associated session ID for context
- **timestamp** (INTEGER NOT NULL): Unix timestamp in milliseconds for ordering
- **created_at** (DATETIME): Local ISO timestamp of insertion

## Indexes
- **idx_im_msg_room_ts**: Composite index on (room_id, timestamp) for efficient room message queries with time filtering

## Foreign Keys
- **room_id** → Logical foreign key to `rooms.id` (not enforced at DB level)

## Relationships
- **Many-to-one** with `rooms` (multiple messages per room)
- **Self-referencing** via `quote_id` (message can quote another message)

## Key Features
- **Message retention**: Automatic cleanup of messages older than 7 days via `deleteOldMessages()`
- **Idempotent inserts**: Uses `INSERT OR IGNORE` to prevent duplicates
- **Room-based pagination**: `getMessagesAfter()` retrieves messages since timestamp with limit (default 200)
- **Mentions support**: Stores mentioned agent IDs as JSON array for @mentions
- **Quote/reply threading**: `quote_id` enables message reply chains
- **Rich content**: Supports attachments and multiple message types
- **Session tracking**: Optional `session_id` links messages to agent sessions

## Usage Patterns
```typescript
// Insert message (idempotent)
imDB.insertMessage({
  id: crypto.randomUUID(),
  room_id: 'room-123',
  sender: 'client-abc',
  content: 'Hello @agent-1',
  mentioned_agents: '["agent-1"]',
  type: 'text',
  timestamp: Date.now()
});

// Fetch recent messages for a room
const messages = imDB.getMessagesAfter('room-123', lastTimestamp, 200);

// Cleanup old messages (7 days)
const deleted = imDB.deleteOldMessages();
```

## ⚠️ MIGRATION
None - this is a new table with no migration needed.

## Source Location
`src/db-im.ts` (entire file)
