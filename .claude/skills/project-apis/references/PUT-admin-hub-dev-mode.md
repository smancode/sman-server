# PUT /admin/hub-dev-mode

Toggle Hub development mode (requires admin bearer token authentication).

## Signature

```typescript
PUT /admin/hub-dev-mode
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  enabled: boolean  // Required: true to enable, false to disable
}
```

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| enabled | boolean | Yes | `true` to enable dev mode, `false` to disable |

## Business Flow

1. **Authenticate**: Verify admin bearer token
2. **Validate request**: `enabled` must be a boolean (400 if missing or invalid type)
3. **Update setting**: Set `hub_dev_mode` to '1' if enabled, '0' if disabled
4. **Return confirmation**: `{ ok: true, enabled: boolean }`

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

- `400` - `enabled` (boolean) required
- `401` - Unauthorized (missing or invalid bearer token)
