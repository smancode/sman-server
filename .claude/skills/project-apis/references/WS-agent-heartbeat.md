# WS agent.heartbeat

Update agent heartbeat timestamp to keep agent alive.

## Signature

```typescript
// Client → Server
{
  type: 'agent.heartbeat',
  agentId: string              // Agent ID
}
```

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentId | string | Yes | Agent ID to update |

## Business Flow

1. **Verify**: Check agentId belongs to authenticated client
2. **Update**: Set last_heartbeat = now in database
3. **Stale Check**: Agents with heartbeat >90s ago are marked offline

## Called Services

- `RoomDB.updateAgentHeartbeat()` - Update timestamp

## Source File

`src/ws-server.ts` - `WsHub.handleAgentHeartbeat()`

## Background Process

- Stale agent check runs every 60 seconds
- Agents with last_heartbeat >90 seconds ago are marked offline
- `checkStaleAgents()` method

## Error Responses

- `error` - Agent ID does not belong to client
