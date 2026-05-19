# GET /admin/stardom-dev-mode

Get Stardom dev mode status (requires Bearer token auth).

## Signature

```typescript
GET /admin/stardom-dev-mode
Authorization: Bearer <ADMIN_TOKEN>
```

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Query setting**: Fetch `stardom_dev_mode` from `hub_settings` table
3. **Return response**: `{ enabled: boolean }` (true if value is '1')

## Response

```json
{
  "enabled": false
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
