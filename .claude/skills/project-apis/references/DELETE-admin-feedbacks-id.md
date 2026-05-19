# DELETE /admin/feedbacks/:id

Delete a feedback by ID (requires Bearer token auth).

## Signature

```typescript
DELETE /admin/feedbacks/:id
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `id` (path parameter): Numeric ID of the feedback to delete

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Delete feedback**: Remove from `feedback` table where `id=?`
3. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
