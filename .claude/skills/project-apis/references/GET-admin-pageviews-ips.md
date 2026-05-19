# GET /admin/pageviews/ips

Get page view IPs with counts (requires Bearer token auth).

## Signature

```typescript
GET /admin/pageviews/ips?days=30
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `days` (query param, optional): Number of days to look back (default: 30, min: 1, max: 365)

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate days**: Clamp to range [1, 365]
3. **Query IP stats**: Group page view logs by IP with counts and last seen
4. **Return response**: Object with ips array

## Response

```json
{
  "ips": [
    { "ip": "192.168.1.100", "count": 50, "last_seen": "2026-05-20T03:04:00.000Z" },
    { "ip": "192.168.1.101", "count": 25, "last_seen": "2026-05-19T12:00:00.000Z" }
  ]
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
