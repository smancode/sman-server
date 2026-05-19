# PUT /admin/stardom-dev-mode

Toggle Stardom dev mode (requires Bearer token auth).

## Signature

```typescript
PUT /admin/stardom-dev-mode
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  enabled: boolean;  // true to enable, false to disable
}
```

## Request Parameters

- `enabled` (boolean, required): Enable or disable dev mode

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate input**: `enabled` must be a boolean
3. **Update setting**: Set `stardom_dev_mode` to '1' (enabled) or '0' (disabled) in `hub_settings` table
4. **Return response**: `{ ok: true, enabled: boolean }`

## Response

```json
{
  "ok": true,
  "enabled": true
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
- `400` - Invalid `enabled` parameter (must be boolean)
