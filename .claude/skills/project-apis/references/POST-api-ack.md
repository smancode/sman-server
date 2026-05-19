# POST /api/ack

Mark broadcasts as read for a client.

## Signature

```typescript
POST /api/ack
Content-Type: application/json

{
  payload: string,      // AES-256-GCM encrypted base64 string
  timestamp: number,    // Unix timestamp in seconds
  pskVersion: number    // Must be 1
}
```

## Request Parameters (encrypted payload)

```typescript
{
  clientId: string;           // Client identifier
  broadcastIds: string[];     // List of broadcast IDs to mark as read
}
```

## Business Flow

1. **Validate PSK version**: Must be `1`
2. **Check timestamp**: Must be within ±5 minutes of server time
3. **Decrypt payload**: Using AES-256-GCM with pre-shared key
4. **Mark as read**: Insert into `read_log` table (INSERT OR IGNORE to avoid duplicates)
5. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/routes/broadcast.ts` - `createBroadcastRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, or invalid request
