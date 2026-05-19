# GET /admin/pageviews

Get page views grouped by date (requires Bearer token auth).

## Signature

```typescript
GET /admin/pageviews?days=30
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `days` (query param, optional): Number of days to look back (default: 30, min: 1, max: 365)

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate days**: Clamp to range [1, 365]
3. **Query page views**: Fetch from `page_views` table where date >= cutoff
4. **Return response**: Object with days array

## Response

```json
{
  "days": [
    { "date": "2026-05-20", "views": 150 },
    { "date": "2026-05-19", "views": 142 }
  ]
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
