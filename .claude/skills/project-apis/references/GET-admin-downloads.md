# GET /admin/downloads

Get download statistics and logs (requires Bearer token auth).

## Signature

```typescript
GET /admin/downloads?days=30
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `days` (query param, optional): Number of days to look back (default: 30, min: 1, max: 365)

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate days**: Clamp to range [1, 365]
3. **Query stats**: Calculate total downloads, unique IPs, and version breakdown
4. **Query logs**: Fetch individual download logs
5. **Return response**: Object with stats and logs

## Response

```json
{
  "stats": {
    "total": 500,
    "uniqueIps": 150,
    "byVersion": [
      { "version": "1.2.3", "count": 300 },
      { "version": "1.2.2", "count": 200 }
    ]
  },
  "logs": [
    {
      "ip": "192.168.1.100",
      "filename": "sman-setup-1.2.3.exe",
      "version": "1.2.3",
      "created_at": "2026-05-20T03:04:00.000Z"
    }
  ]
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
