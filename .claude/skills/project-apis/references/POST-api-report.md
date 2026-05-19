# POST /api/report

Submit encrypted client usage report to the hub.

## Signature

```typescript
POST /api/report
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
  clientId: string;           // Unique client identifier
  version: string;            // Sman version
  hostname: string;           // Client hostname
  ip: string;                 // Client IP address
  reportTime: string;         // ISO 8601 timestamp
  activeSessions: number;     // Number of active sessions
  workspaces?: string[];      // Optional list of workspace IDs
}
```

## Business Flow

1. **Validate PSK version**: Must be `1`
2. **Check timestamp**: Must be within ±5 minutes of server time (replay protection)
3. **Decrypt payload**: Using AES-256-GCM with pre-shared key
4. **Upsert client record**: Insert or update `clients` table with latest info
5. **Insert report row**: Add to `reports` table for historical tracking
6. **Replace workspaces**: Delete and re-insert client's workspace list
7. **Check skill commands**: Query skill-scheduler for pending commands for this client
8. **Return response**: `{ ok: true, serverTime: string, commands: string[] }`

## Response

```json
{
  "ok": true,
  "serverTime": "2026-05-20T03:04:00.000Z",
  "commands": ["skill:update", "config:reload"]
}
```

## Source File

`src/routes/report.ts` - `createReportRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, or invalid request
