# POST /api/broadcasts

Fetch new broadcasts since given timestamp (encrypted response).

## Signature

```typescript
POST /api/broadcasts
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
  clientId: string;      // Client identifier
  since: string;         // ISO 8601 timestamp to filter broadcasts
}
```

## Business Flow

1. **Validate PSK version**: Must be `1`
2. **Check timestamp**: Must be within ±5 minutes of server time
3. **Decrypt payload**: Using AES-256-GCM with pre-shared key
4. **Fetch broadcasts**: Query `broadcasts` table where `active=1` and `created_at > since`
5. **Get read IDs**: Query `read_log` table for this client's read broadcast IDs
6. **Filter unread**: Exclude broadcasts already read by this client
7. **Encrypt response**: Encrypt messages array with AES-256-GCM
8. **Return response**: `{ payload: string }` (encrypted)

## Response (encrypted)

```json
{
  "payload": "base64-encrypted-response"
}
```

Decrypted payload:
```json
{
  "messages": [
    {
      "id": "broadcast-1",
      "title": "New Feature",
      "body": "Description here",
      "createdAt": "2026-05-20T03:04:00.000Z"
    }
  ],
  "hasMore": false
}
```

## Source File

`src/routes/broadcast.ts` - `createBroadcastRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, or invalid request
