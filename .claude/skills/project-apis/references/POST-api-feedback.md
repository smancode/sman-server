# POST /api/feedback

Submit user feedback with IP-based rate limiting (30 seconds).

## Signature

```typescript
POST /api/feedback
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
  message: string;           // Feedback message (required, non-empty)
  workspace?: string;        // Workspace context
  llmModel?: string;         // LLM model used
  llmBaseUrl?: string;       // LLM base URL
  osInfo?: string;           // Operating system info
}
```

## Business Flow

1. **Rate limit check**: Same IP can only submit once per 30 seconds (429 if exceeded)
2. **Validate PSK version**: Must be `1`
3. **Check timestamp**: Must be within ±5 minutes of server time
4. **Decrypt payload**: Using AES-256-GCM with pre-shared key
5. **Validate message**: Must be non-empty string (400 if missing or empty)
6. **Insert feedback**: Add to `feedback` table
7. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/routes/report.ts` - `createReportRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, message required, or invalid request
- `429` - Too many requests (IP rate limit exceeded)
