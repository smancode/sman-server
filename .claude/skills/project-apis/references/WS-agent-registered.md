# WS agent.registered

Confirm agent registration with assigned agent ID (server → client only).

## Signature

```typescript
// Server → Client
{
  type: 'agent.registered',
  agent: {
    id: string,                 // Generated agent ID (format: clientId:workspace)
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
}
```

## Description

Sent by server after successful `agent.register` request. Contains the complete agent record including the generated agent ID (format: `clientId:workspace`).

The `workspace_name` field was added in v312f64f for human-readable workspace display.

## Source File

`src/ws-server.ts` - `WsHub.handleAgentRegister()`
