# WS agent.unregister

Unregister agent from room (set status to offline).

## Signature

```typescript
// Client → Server
{
  type: 'agent.unregister',
  agentId: string              // Agent ID to unregister
}
```

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentId | string | Yes | Agent ID (format: clientId:workspace) |

## Business Flow

1. **Verify**: Check agentId belongs to authenticated client
2. **Update**: Set agent status = 'offline' in database
3. **Cleanup**: Remove client from room tracking

## Called Services

- `RoomDB.updateAgentStatus()` - Set status to offline
- Room tracking cleanup

## Source File

`src/ws-server.ts` - `WsHub.handleAgentUnregister()`

## Error Responses

- `error` - Agent ID does not belong to client
- `error` - Agent not found
