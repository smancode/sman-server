# DELETE /admin/broadcast/:id

Soft delete a broadcast by setting active=0 (requires Bearer token auth).

## Signature

```typescript
DELETE /admin/broadcast/:id
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `id` (path parameter): Broadcast ID to deactivate

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Soft delete**: Update `broadcasts` table set `active=0` where `id=?`
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
