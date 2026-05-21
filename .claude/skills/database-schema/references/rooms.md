# rooms Table

## Purpose
Manages collaboration rooms (chat rooms, workspaces) where agents and users interact. Supports public/private visibility, password protection, and soft-delete via active flag.

## DDL
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  max_agents INTEGER DEFAULT 10,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private')),
  password TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(active);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique room identifier (UUID)
- **name** (TEXT NOT NULL): Human-readable room name
- **description** (TEXT | NULL): Optional room description/purpose
- **owner_id** (TEXT NOT NULL): Client ID of room owner (also in room_members as owner)
- **active** (INTEGER DEFAULT 1): Soft-delete flag (1=active, 0=deactivated)
- **max_agents** (INTEGER DEFAULT 10): Maximum agent capacity for the room
- **visibility** (TEXT NOT NULL DEFAULT 'private'): Access control - 'public' or 'private' (CHECK constraint)
- **password** (TEXT | NULL): Optional password for private room access
- **created_at** (TEXT NOT NULL): ISO timestamp of room creation

## Indexes
- **idx_rooms_active**: Supports filtering active rooms efficiently

## Foreign Keys
- **owner_id** → Logical reference to clients (not enforced at DB level)
- **Referenced by** `room_members.room_id` (many-to-one)
- **Referenced by** `agents.room_id` (many-to-one)
- **Referenced by** `im_messages.room_id` (many-to-one)

## Relationships
- **One-to-many** with `room_members` (room has many members)
- **One-to-many** with `agents` (room hosts multiple agents)
- **One-to-many** with `im_messages` (room contains many messages)

## Key Features
- **Soft delete**: Uses `active` flag instead of DELETE to preserve data
- **Visibility control**: Public rooms discoverable by all, private rooms require membership
- **Password protection**: Optional password field for private rooms
- **Capacity limits**: `max_agents` enforced during member joins
- **Owner tracking**: Owner is auto-added as room member with role='owner'
- **Search**: Room listing supports search by name/owner_id with pagination

## Access Control Logic
```sql
-- Rooms visible to a client:
SELECT r.* FROM rooms r
WHERE r.active = 1
  AND (r.visibility = 'public'
       OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.client_id = ?))
```
- Public rooms: visible to all active clients
- Private rooms: visible only to members

## ⚠️ MIGRATION
Two ALTER TABLE migrations (lines 56-64 in db-rooms.ts):
1. **visibility column**: Adds 'public'/'private' with CHECK constraint
2. **password column**: Adds optional password for private rooms

## Source Location
`src/db-rooms.ts:18-27` (CREATE TABLE), `src/db-rooms.ts:56-64` (migrations)
