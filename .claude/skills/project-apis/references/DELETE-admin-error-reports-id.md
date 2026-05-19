# DELETE /admin/error-reports/:id

Delete an error report by ID (requires Bearer token auth).

## Signature

```typescript
DELETE /admin/error-reports/:id
Authorization: Bearer <ADMIN_TOKEN>
```

## Request Parameters

- `id` (path parameter): Numeric ID of the error report to delete

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Delete report**: Remove from `error_reports` table where `id=?`
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
