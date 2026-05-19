# GET /admin/broadcasts

List all broadcasts (requires Bearer token auth).

## Signature

```typescript
GET /admin/broadcasts
Authorization: Bearer <ADMIN_TOKEN>
```

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Query broadcasts**: Fetch all rows from `broadcasts` table ordered by `created_at DESC`
3. **Return response**: Array of broadcast objects

## Response

```json
[
  {
    "id": "broadcast-1",
    "title": "New Feature",
    "body": "Description here",
    "created_at": "2026-05-20T03:04:00.000Z",
    "active": 1
  }
]
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
