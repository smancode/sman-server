# POST /api/hub/hub-dev-mode

Get Hub development mode status (encrypted response for Hub clients).

## Signature

```typescript
POST /api/hub/hub-dev-mode
Content-Type: application/json

{
  payload: string,      // AES-256-GCM encrypted base64 string (can be empty)
  timestamp: number,    // Unix timestamp in seconds
  pskVersion: number    // Must be 1
}
```

## Business Flow

1. **Validate PSK version**: Must be `1`
2. **Check timestamp**: Must be within ±5 minutes of server time
3. **Read setting**: Fetch `hub_dev_mode` from database settings
4. **Return encrypted response**: `{ payload: encrypt({ enabled: boolean }, psk) }`

## Response

```json
{
  "payload": "base64-encoded-encrypted-response"
}
```

Decrypted payload contains:
```json
{
  "enabled": true  // true if hub_dev_mode setting is '1'
}
```

## Source File

`src/routes/hub-api.ts` - `createHubApiRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, or invalid request
