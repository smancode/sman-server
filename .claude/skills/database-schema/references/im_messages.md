# im_messages Table

## Purpose
Stores instant messages for the chat system, supporting room-based messaging with features like mentions, quotes, attachments, message types, and sequence numbers. Implements automatic cleanup of messages older than 7 days.

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
  seq INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_im_msg_room_ts ON im_messages(room_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_im_msg_room_seq ON im_messages(room_id, seq);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique message identifier (UUID)
- **room_id** (TEXT NOT NULL): References rooms.id, groups messages by room
- **sender** (TEXT NOT NULL): Client ID of message sender
- **content** (TEXT NOT NULL): Message text content
- **mentioned_agents** (TEXT | NULL): JSON array of agent IDs mentioned in message
- **quote_id** (TEXT | NULL): ID of quoted message (for reply threads)
- **type** (TEXT NOT NULL DEFAULT 'text'): Message type (text, system, notification, agent_output, etc.)
- **status** (TEXT | NULL): Delivery status (sent, delivered, read, failed, running, completed)
- **attachments** (TEXT | NULL): JSON array of attachment metadata
- **session_id** (TEXT | NULL): Associated session ID for agent context
- **timestamp** (INTEGER NOT NULL): Unix timestamp in milliseconds for ordering
- **seq** (INTEGER DEFAULT 0): Sequence number for message ordering and sync
- **created_at** (DATETIME): Local ISO timestamp of insertion

## Indexes
- **idx_im_msg_room_ts**: Composite index on (room_id, timestamp) for efficient room message queries with time filtering
- **idx_im_msg_room_seq**: Composite index on (room_id, seq) for sequence-based message retrieval

## Foreign Keys
- **room_id** → Logical foreign key to `rooms.id` (not enforced at DB level)

## Relationships
- **Many-to-one** with `rooms` (multiple messages per room)
- **Self-referencing** via `quote_id` (message can quote another message)
- **Many-to-one** with `im_rooms` (logical link via room_id)

## Key Features
- **Message retention**: Automatic cleanup of messages older than 7 days via `deleteOldMessages()`
- **Idempotent inserts**: Uses `INSERT OR IGNORE` to prevent duplicates
- **Message upserts**: `upsertMessage()` updates content/status/type for existing messages (agent lifecycle: running → completed)
- **Sequence ordering**: `seq` field enables reliable message ordering and sync
- **Room-based pagination**: `getMessagesAfter()` retrieves messages since timestamp with limit (default 200)
- **Mentions support**: Stores mentioned agent IDs as JSON array for @mentions
- **Quote/reply threading**: `quote_id` enables message reply chains
- **Rich content**: Supports attachments and multiple message types
- **Session tracking**: Optional `session_id` links messages to agent sessions
- **Prepared statements**: All queries use prepared statements for performance

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
  timestamp: Date.now(),
  seq: 1
});

// Upsert message (for agent lifecycle: running → completed)
imDB.upsertMessage({
  id: 'existing-msg-id',
  room_id: 'room-123',
  sender: 'agent-1',
  content: 'Task result',
  type: 'agent_output',
  status: 'completed',
  timestamp: Date.now(),
  seq: 1
});

// Fetch recent messages for a room
const messages = imDB.getMessagesAfter('room-123', lastTimestamp, 200);

// Cleanup old messages (7 days)
const deleted = imDB.deleteOldMessages();
```

## ⚠️ MIGRATION
**seq column added** - Required for message sync and ordering. Migration handled in code with try-catch:
```sql
ALTER TABLE im_messages ADD COLUMN seq INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_im_msg_room_seq ON im_messages(room_id, seq);
```
**Applied in**: Now part of CREATE TABLE statement in `src/db-im.ts:63`

## Source Location
`src/db-im.ts:50-77` (CREATE TABLE + indexes), `src/db-im.ts:80-107` (prepared statements), `src/db-im.ts:109-154` (CRUD operations)
