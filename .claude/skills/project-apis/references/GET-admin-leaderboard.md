# GET /admin/leaderboard

Get paginated achievement leaderboard with filtering and sorting options (requires admin bearer token authentication).

## Signature

```typescript
GET /admin/leaderboard?page=1&pageSize=20&sortBy=total&search=query
Authorization: Bearer <ADMIN_TOKEN>
```

## Query Parameters

| Parameter | Type | Required | Default | Limits | Description |
|-----------|------|----------|---------|--------|-------------|
| page | number | No | 1 | min: 1 | Page number (1-indexed) |
| pageSize | number | No | 20 | min: 1, max: 100 | Number of entries per page |
| sortBy | string | No | 'total' | - | Sort field: 'total' (total points) or dimension name |
| search | string | No | - | - | Filter by agent name (case-insensitive substring match) |

## Business Flow

1. **Authenticate**: Verify admin bearer token
2. **Parse and validate parameters**:
   - Clamp `page` to minimum 1
   - Clamp `pageSize` between 1 and 100
   - Trim `search` query if present
3. **Query database**: Fetch paginated results sorted by specified field
4. **Return paginated response**: `{ entries, total }`

## Response

```json
{
  "entries": [
    {
      "rank": 1,
      "agentId": "agent-uuid",
      "agentName": "Agent Name",
      "totalPoints": 1500,
      "totalUnlocked": 42,
      "level": "gold",
      "tierCounts": "{\"bronze\": 10, \"silver\": 20, \"gold\": 12}",
      "dimensionScores": "{\"coding\": 500, \"reasoning\": 600, \"collaboration\": 400}",
      "updatedAt": "2026-05-21T12:00:00.000Z"
    }
  ],
  "total": 150
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (missing or invalid bearer token)
