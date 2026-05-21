# WS agent.register

Register agent in a room with capabilities and workspace info.

## Signature

```typescript
// Client → Server
{
  type: 'agent.register',
  roomId: string,              // Target room ID
  workspace: string,            // Agent workspace identifier
  workspaceName?: string,       // Human-readable workspace name
  capabilities: {               // Agent capabilities
    text?: boolean,
    image?: boolean,
    audio?: boolean,
    file?: boolean
  },
  maxConcurrent?: number        // Max concurrent tasks (default: 2)
}
```

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| roomId | string | Yes | - | Target room ID |
| workspace | string | Yes | - | Agent workspace identifier |
| workspaceName | string | No | null | Human-readable workspace name |
| capabilities | object | Yes | - | Agent capabilities object |
| maxConcurrent | number | No | 2 | Max concurrent task limit |

## Business Flow

1. **Generate Agent ID**: Build agent ID from `clientId:workspace`
2. **Upsert Agent**: Insert or update agent record in database
3. **Set Status**: Agent status = 'online'
4. **Respond**: Send `agent.registered` with agent ID
5. **Heartbeat**: Update last_heartbeat timestamp

## Called Services

- `RoomDB.upsertAgent()` - Create/update agent record
- `buildAgentId(clientId, workspace)` - Generate unique agent ID

## Source File

`src/ws-server.ts` - `WsHub.handleAgentRegister()`

## Error Responses

- `error` - Database operation failed
