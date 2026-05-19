# POST /api/error-report

Submit encrypted error report from client sessions.

## Signature

```typescript
POST /api/error-report
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
  clientId?: string;         // Client identifier
  sessionId?: string;        // Session identifier
  errorCode?: string;        // Error code
  errorMessage?: string;     // Error message
  rawError?: string;         // Raw error details
  workspace?: string;        // Workspace context
  lastUserMessage?: string;  // Last user message
  llmModel?: string;         // LLM model used
  llmBaseUrl?: string;       // LLM base URL
  osInfo?: string;           // Operating system info
}
```

## Business Flow

1. **Validate PSK version**: Must be `1`
2. **Check timestamp**: Must be within ±5 minutes of server time
3. **Decrypt payload**: Using AES-256-GCM with pre-shared key
4. **Insert error report**: Add to `error_reports` table with all fields (nullable)
5. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/routes/report.ts` - `createReportRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, or invalid request
