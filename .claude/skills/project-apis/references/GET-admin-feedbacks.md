# GET /admin/feedbacks

List user feedback with optional limit (requires Bearer token auth).

## Signature

```typescript
GET /admin/feedbacks?limit=100
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `limit` (query param, optional): Number of feedbacks to return (default: 100, min: 1, max: 500)

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate limit**: Clamp to range [1, 500]
3. **Query feedbacks**: Fetch from `feedback` table ordered by `created_at DESC`
4. **Return response**: Array of feedback objects

## Response

```json
[
  {
    "id": 1,
    "client_id": "client-123",
    "message": "Great feature!",
    "workspace": "workspace-1",
    "llm_model": "claude-3-5-sonnet",
    "llm_base_url": "https://api.anthropic.com",
    "os_info": "macOS 14.0",
    "created_at": "2026-05-20T03:04:00.000Z"
  }
]
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
