# WS im.clients.search

Search for clients by clientId or hostname, including both online WebSocket clients and offline registered clients from database.

## Signature

```typescript
// Client → Server
{
  type: 'im.clients.search',
  query?: string,    // Search query (optional, empty = return all)
  seq: number        // Sequence number for response matching
}

// Server → Client
{
  type: 'im.clients.search',
  results: { clientId: string }[],  // Array of matching clients (max 20)
  seq: number                       // Request sequence number
}
```

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| query | string | No | - | Search query (case-insensitive) |
| seq | number | Yes | - | Sequence number for response matching |

## Business Flow

1. **Search Online**: First search WebSocket-connected clients (max 20 results)
2. **Search Offline**: If < 20 results, search database for registered clients
3. **Deduplicate**: Use `Set` to remove duplicates
4. **Match Logic**: Case-insensitive match on `clientId` OR `hostname`
5. **Limit**: Return maximum 20 results total

## Called Services

- `WsHub.clients` - Map of online WebSocket connections
- `HubDB.getAllClients()` - Fetch all registered clients from database

## Source File

`src/ws-server.ts` - `WsHub.handleImClientsSearch()`

## Error Responses

None - always returns results array (may be empty)
