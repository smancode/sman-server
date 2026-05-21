# WS agent.list

Request list of all agents in a room.

## Signature

```typescript
// Client → Server
{
  type: 'agent.list',
  roomId: string              // Room ID to query
}

// Server → Client
{
  type: 'agent.list.update',
  roomId: string,
  agents: AgentRecord[]
}
```

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| roomId | string | Yes | Room ID to list agents from |

## Agent Record Structure

```typescript
{
  id: string,                 // Agent ID (clientId:workspace)
  room_id: string,
  client_id: string,
  workspace: string,
  workspace_name: string | null,
  capabilities: {
    text?: boolean,
    image?: boolean,
    audio?: boolean,
    file?: boolean
  },
  status: 'online' | 'offline',
  max_concurrent: number,
  last_heartbeat: string,     // ISO datetime
  created_at: string          // ISO datetime
}
```

## Business Flow

1. **Query**: Fetch all agents for room from database
2. **Filter**: Return both online and offline agents
3. **Respond**: Send `agent.list.update` to requesting client only

## Called Services

- `RoomDB.getAgentsByRoom(roomId)` - Query agents

## Source File

`src/ws-server.ts` - `WsHub.handleAgentList()`

## Error Responses

- `error` - Database query failed
