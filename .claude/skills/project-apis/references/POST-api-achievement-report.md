# POST /api/achievement-report

Upload achievement score to the leaderboard (encrypted client report).

## Signature

```typescript
POST /api/achievement-report
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
  agentId: string;           // Agent identifier (required)
  agentName: string;         // Agent display name (required)
  totalPoints: number;       // Total achievement points (required)
  totalUnlocked?: number;    // Total unlocked achievements (default: 0)
  level?: string;            // Achievement level: bronze/silver/gold (default: 'bronze')
  tierCounts?: string;       // JSON string of tier counts (default: '{}')
  dimensionScores?: string;  // JSON string of dimension scores (default: '{}')
}
```

## Business Flow

1. **Validate PSK version**: Must be `1`
2. **Check timestamp**: Must be within ±5 minutes of server time
3. **Decrypt payload**: Using AES-256-GCM with pre-shared key
4. **Validate required fields**: `agentId`, `agentName`, `totalPoints` must be present
5. **Upsert achievement entry**: Insert or update in `achievement_leaderboard` table
6. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/routes/report.ts` - `createReportRouter()`

## Error Responses

- `400` - Unsupported PSK version, timestamp out of range, missing required fields, or invalid request
