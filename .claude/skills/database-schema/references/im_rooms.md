# im_rooms Table

## Purpose
Stores IM room metadata including member list and last message timestamp. Supports room-based messaging with member tracking for sync and notification routing.

## DDL
```sql
CREATE TABLE IF NOT EXISTS im_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  members TEXT NOT NULL DEFAULT '[]',
  last_message_time INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique room identifier (UUID)
- **name** (TEXT NOT NULL DEFAULT ''): Human-readable room name
- **members** (TEXT NOT NULL DEFAULT '[]'): JSON array of client IDs who are members
- **last_message_time** (INTEGER | NULL): Unix timestamp of most recent message
- **created_at** (DATETIME): Local ISO timestamp of room creation

## Indexes
None - queries use primary key or LIKE pattern matching on members JSON

## Foreign Keys
- **id** → Logical reference to `rooms.id` (not enforced at DB level)

## Relationships
- **One-to-many** with `im_messages` (room contains many messages)
- **Logical link** to `rooms` table (same room ID in both systems)

## Key Features
- **Member tracking**: JSON array stores all member client IDs for sync
- **Last message time**: Supports room ordering by activity
- **Upsert support**: Room info updated on `im.room.updated` events
- **Member queries**: `getRoomsForMember()` uses LIKE pattern matching to find rooms containing a client

## Usage Patterns
```typescript
// Upsert room info (called on im.room.updated)
imDB.upsertRoom('room-123', 'Chat Room', ['client-1', 'client-2'], Date.now());

// Get all rooms for a client
const rooms = imDB.getRoomsForMember('client-1'); // Uses LIKE '%"client-1"%'

// Get specific room
const room = imDB.getRoom('room-123');

// Delete room (on dissolve)
imDB.deleteRoom('room-123');
```

## ⚠️ MIGRATION
None - this is a new table added since commit 1353222.

## Source Location
`src/db-im.ts:67-73` (CREATE TABLE), `src/db-im.ts:160-176` (CRUD operations)
