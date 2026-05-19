# GET /admin/stats

Get hub statistics (requires Bearer token auth).

## Signature

```typescript
GET /admin/stats
Authorization: Bearer <ADMIN_TOKEN>
```

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Query stats**: Calculate various statistics from database
3. **Return response**: Statistics object

## Response

```json
{
  "totalClients": 150,
  "onlineClients": 42,
  "totalReports24h": 1250,
  "activeBroadcasts": 3
}
```

## Statistics

- `totalClients`: Total number of unique clients in database
- `onlineClients`: Clients seen within last 1 hour
- `totalReports24h`: Number of reports received in last 24 hours
- `activeBroadcasts`: Number of broadcasts with `active=1`

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
