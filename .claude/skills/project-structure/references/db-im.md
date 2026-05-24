# IMDB - Instant Messaging Database

## Purpose

Persistent storage for instant messages and IM room metadata with support for message upserts, room membership tracking, and automatic cleanup.

## Location

`src/db-im.ts` (188 lines)

## Database Schema

### im_messages Table
```sql
CREATE TABLE im_messages (
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
```
**Indexes**: `idx_im_msg_room_ts` on `(room_id, timestamp)`, `idx_im_msg_room_seq` on `(room_id, seq)`

### im_rooms Table (NEW in commit d76da6e)
```sql
CREATE TABLE im_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  members TEXT NOT NULL DEFAULT '[]',
  last_message_time INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);
```
**Purpose**: Track IM room membership for presence broadcasts and reconnection scenarios.

## Key Methods

### Message Operations
- `insertMessage(msg)` - Insert new message, ignore duplicates (INSERT OR IGNORE)
- `upsertMessage(msg)` - Insert or update existing message (ON CONFLICT UPDATE content, status, type)
- `getMessagesAfter(roomId, afterTimestamp, limit?)` - Query messages after timestamp, ordered ASC

### Room Operations
- `upsertRoom(roomId, name, members, lastMessageTime?)` - Create/update room metadata
- `getRoom(roomId)` - Get room by ID
- `getRoomsForMember(clientId)` - Get all rooms where client is a member (LIKE query on members JSON)
- `deleteRoom(roomId)` - Delete room (messages remain)

### Maintenance
- `deleteOldMessages()` - Delete messages older than 7 days
- `close()` - Close database connection

## Type Definitions
```typescript
interface IMMessageRow {
  id: string; room_id: string; sender: string; content: string;
  mentioned_agents: string | null; quote_id: string | null;
  type: string; status: string | null; attachments: string | null;
  session_id: string | null; timestamp: number; seq: number;
  created_at: string;
}

interface IMRoomRow {
  id: string; name: string; members: string; last_message_time: number | null;
}
```

## Key Patterns
- **Prepared Statements**: All queries prepared in constructor for performance
- **JSON Storage**: Arrays stored as TEXT (mentioned_agents, attachments, members)
- **Upsert Pattern**: Room updates use ON CONFLICT to merge membership changes
- **Message Lifecycle**: `insertMessage` for new, `upsertMessage` for agent lifecycle updates
- **Retention**: 7-day automatic cleanup via `deleteOldMessages()`

## ⚠️ Breaking Changes (commit d76da6e)
- **NEW**: `im_rooms` table for room persistence
- **NEW**: `upsertMessage()` for agent lifecycle (running → completed)
- **NEW**: Prepared statements for all queries (performance)
- **Migration**: Automatic table creation, no manual migration needed
