# Broadcast Fetch and Ack Flow

## Fetch Broadcasts Endpoint
`POST /api/broadcasts`

## Request Structure
```json
{
  "payload": "<base64 encrypted blob with { clientId, since }>",
  "timestamp": 1716200000,
  "pskVersion": 1
}
```

## Fetch Process
1. **Validation**: Check pskVersion and timestamp
2. **Decryption**: Decrypt payload to extract `{ clientId, since }`
3. **Query**: `getBroadcastsSince(since)` - active broadcasts created after `since`
4. **Filter**: Exclude already-read broadcasts using `read_log` table
5. **Response**: Encrypt `{ messages: Broadcast[], hasMore: false }` with PSK

## Ack Broadcasts Endpoint
`POST /api/ack`

## Ack Process
1. **Validation**: Same pskVersion/timestamp check
2. **Decryption**: Extract `{ clientId, broadcastIds[] }`
3. **Mark Read**: Insert rows into `read_log` (client_id, broadcast_id) with `INSERT OR IGNORE`

## Key Business Rules
- `read_log` table tracks many-to-many client↔broadcast read status
- Soft delete via `active` flag (deleted broadcasts never returned)
- `since` parameter enables incremental polling
- Ack prevents re-delivery of same broadcasts

## Source
`src/routes/broadcast.ts:18-53`, `src/db.ts:234-251`
