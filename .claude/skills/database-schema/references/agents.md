# agents Table

## Purpose
Tracks registered AI agents within rooms, including their capabilities, status, workspace configuration, and heartbeat for online/offline detection. Supports concurrent task limits and stale agent cleanup.

## DDL
```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  workspace TEXT NOT NULL,
  capabilities TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online','offline','busy')),
  max_concurrent INTEGER DEFAULT 2,
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_name TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agents_room ON agents(room_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_client ON agents(client_id);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique agent identifier (UUID)
- **room_id** (TEXT NOT NULL): Room where agent is registered
- **client_id** (TEXT NOT NULL): Owner client ID (who registered this agent)
- **workspace** (TEXT NOT NULL): Filesystem path to agent workspace
- **capabilities** (TEXT DEFAULT '{}'): JSON object describing agent skills/capabilities
- **status** (TEXT NOT NULL DEFAULT 'online'): Agent state - 'online', 'offline', or 'busy' (CHECK constraint)
- **max_concurrent** (INTEGER DEFAULT 2): Maximum parallel tasks agent can handle
- **last_heartbeat** (TEXT NOT NULL): ISO timestamp of last heartbeat (for staleness detection)
- **workspace_name** (TEXT | NULL): Human-readable workspace name (display only)
- **registered_at** (TEXT NOT NULL): ISO timestamp when agent was first registered

## Indexes
- **idx_agents_room**: Fast lookup of all agents in a room
- **idx_agents_status**: Filter agents by status (online/offline/busy)
- **idx_agents_client**: Find all agents owned by a client

## Foreign Keys
- **room_id** → Logical foreign key to `rooms.id` (not enforced at DB level)
- **client_id** → Logical foreign key to `clients.client_id` (not enforced at DB level)

## Relationships
- **Many-to-one** with `rooms` (multiple agents per room)
- **Many-to-one** with `clients` (client can own multiple agents)
- **One-to-many** with `im_messages` (agent can be mentioned in messages)

## Key Features
- **Upsert registration**: Uses `ON CONFLICT(id) DO UPDATE` to re-register with fresh heartbeat
- **Heartbeat tracking**: `last_heartbeat` updated periodically, stale agents marked offline
- **Status management**: Three states - online (available), busy (working), offline (unavailable)
- **Capacity limits**: `max_concurrent` controls parallel task execution
- **Capabilities**: JSON field stores agent skills (e.g., { "canCode": true, "canSearch": false })
- **Workspace**: Tracks both path (`workspace`) and display name (`workspace_name`)
- **Stale detection**: Query for agents with old heartbeats to mark them offline

## Business Logic
```typescript
// Register/re-register agent:
INSERT INTO agents (...) VALUES (...)
ON CONFLICT(id) DO UPDATE SET
  status = 'online',
  last_heartbeat = excluded.last_heartbeat,
  ... (other fields)

// Heartbeat refresh:
UPDATE agents SET last_heartbeat = ? WHERE id = ?

// Find stale agents (for cleanup):
SELECT * FROM agents WHERE status != 'offline' AND last_heartbeat < ?

// Bulk offline:
UPDATE agents SET status = 'offline' WHERE id IN (...)
```

## Usage Patterns
- **Room agents**: `getRoomAgents(roomId)` - list all agents in a room
- **Client agents**: `getClientAgents(clientId)` - list all agents owned by client
- **Online agents**: `getOnlineAgents()` - find available agents for task dispatch
- **Stale detection**: `getStaleAgents(olderThanMs)` - find agents with old heartbeats
- **Recent activity**: `getRecentAgents(cutoffIso)` - agents active since timestamp

## ⚠️ MIGRATION
**workspace_name column** added via ALTER TABLE (line 67-69 in db-rooms.ts):
- Adds human-readable workspace name alongside filesystem path
- Optional field (NULL allowed)
- Non-breaking migration (adds display-only field)

## Source Location
`src/db-rooms.ts:38-48` (CREATE TABLE + indexes), `src/db-rooms.ts:67-69` (migration), `src/db-rooms.ts:199-283` (CRUD operations)
