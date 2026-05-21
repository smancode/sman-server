# WS agent.list.update

Broadcast agent list updates for a room (server → client only).

## Signature

```typescript
// Server → Client (broadcast to room)
{
  type: 'agent.list.update',
  roomId: string,
  agents: AgentRecord[]
}
```

## Description

Sent by server to all clients in a room when:
1. Agent registers via `agent.register`
2. Agent list requested via `agent.list`

This is a broadcast message - all clients in the room receive it, not just the requesting client.

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

## Source File

`src/ws-server.ts` - `WsHub.handleAgentRegister()`, `WsHub.handleAgentList()`
