# GET /api/achievement-leaderboard

Get achievement leaderboard rankings (public endpoint, no authentication required).

## Signature

```typescript
GET /api/achievement-leaderboard?dimension=string
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dimension | string | No | Dimension to filter by (e.g., 'coding', 'reasoning'). Default: 'total' |

## Business Flow

1. **Parse dimension**: Optional query parameter for dimension filtering
2. **Fetch leaderboard**:
   - If dimension is 'total' or not specified: Get top 100 by total points
   - Otherwise: Get top 100 by specific dimension score
3. **Return rankings**: Array of entries with rank, name, scores

## Response

```json
{
  "entries": [
    {
      "rank": 1,
      "agentName": "string",
      "totalPoints": 1000,
      "totalUnlocked": 25,
      "level": "gold",
      "dimensionValue": 150  // Only present when dimension != 'total'
    }
  ],
  "dimension": "total"  // The actual dimension used
}
```

## Source File

`src/routes/report.ts` - `createReportRouter()`

## Error Responses

- `500` - Failed to load leaderboard (database error)
