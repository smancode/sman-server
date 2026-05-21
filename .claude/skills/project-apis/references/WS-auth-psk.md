# WS auth.psk

Authenticate WebSocket connection using pre-shared key (PSK).

## Signature

```typescript
// Client → Server
{
  type: 'auth.psk',
  payload: string,           // Base64(IV + ciphertext + authTag)
  timestamp: number,         // Unix timestamp (ms) for replay protection
  pskVersion: number         // PSK version (must be 1)
}

// Server → Client (on success)
// No explicit success message - connection is authenticated
// Subsequent messages from this client will be processed

// Server → Client (on failure)
{
  type: 'error',
  message: string            // Error description
}
```

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| payload | string | Yes | AES-256-GCM encrypted envelope |
| timestamp | number | Yes | Unix timestamp (ms), ±5 min window |
| pskVersion | number | Yes | PSK version identifier |

## Business Flow

1. **Decrypt**: Decrypt payload using PSK (AES-256-GCM)
2. **Extract**: Get clientId and workspace from decrypted data
3. **Validate**: Check timestamp is within ±5 minutes
4. **Authenticate**: Store client info as authenticated
5. **Timeout**: Require auth within 5 seconds or disconnect

## Decrypted Payload Structure

```typescript
{
  clientId: string,
  workspace: string
}
```

## Called Services

- `decrypt(payload, psk)` - AES-256-GCM decryption
- Authentication state management

## Source File

`src/ws-server.ts` - `WsHub.handleAuth()`

## Error Responses

- `error` - Decryption failed (wrong PSK)
- `error` - Invalid timestamp (replay protection)
- `error` - Auth timeout (>5 seconds)
