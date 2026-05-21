# room_members Table

## Purpose
Junction table managing room membership with roles (owner/member). Enforces capacity limits via max_agents on parent room and prevents non-owners from leaving.

## DDL
```sql
CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (room_id, client_id)
);
```

## Columns
- **room_id** (TEXT NOT NULL): References rooms.id, part of composite primary key
- **client_id** (TEXT NOT NULL): References clients.client_id, part of composite primary key
- **display_name** (TEXT NOT NULL): Human-readable name for the member in this room
- **role** (TEXT NOT NULL DEFAULT 'member'): Either 'owner' or 'member' (CHECK constraint)
- **joined_at** (TEXT NOT NULL): ISO timestamp of when member joined

## Indexes
- **Composite primary key** on (room_id, client_id) automatically indexed
- **Implicit index** supports queries: "get all members in room" and "check if client is member"

## Foreign Keys
- **room_id** → Logical foreign key to `rooms.id` (not enforced at DB level)
- **client_id** → Logical foreign key to `clients.client_id` (not enforced at DB level)

## Relationships
- **Many-to-one** with `rooms` (many members per room)
- **Many-to-one** with `clients` (client can be member of multiple rooms)

## Key Features
- **Composite primary key**: Prevents duplicate membership, ensures one member per room
- **Role-based access**: CHECK constraint enforces only 'owner' or 'member' roles
- **Capacity enforcement**: Application checks member count against room.max_agents before join
- **Owner protection**: Room owners cannot leave their own room (business logic in leaveRoom())
- **Automatic owner assignment**: Room creator auto-inserted with role='owner' during room creation

## Business Logic
```typescript
// Join validation:
// 1. Check room exists and is active
// 2. Check not already a member
// 3. Check member count < room.max_agents
// 4. Insert with role='member' (unless specified)

// Leave validation:
// 1. Check room exists
// 2. Owner cannot leave (return false)
// 3. Delete member record

// Member count query:
SELECT COUNT(*) as c FROM room_members WHERE room_id = ?
```

## Usage Patterns
- **List members**: `SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC`
- **Check membership**: `SELECT 1 FROM room_members WHERE room_id = ? AND client_id = ?`
- **Get member count**: `SELECT COUNT(*) as c FROM room_members WHERE room_id = ?`

## ⚠️ MIGRATION
None - table schema is stable.

## Source Location
`src/db-rooms.ts:29-36` (CREATE TABLE), `src/db-rooms.ts:144-196` (CRUD operations)
