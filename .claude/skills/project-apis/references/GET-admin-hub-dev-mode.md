# GET /admin/hub-dev-mode

Get Hub development mode status (requires admin bearer token authentication).

## Signature

```typescript
GET /admin/hub-dev-mode
Authorization: Bearer <ADMIN_TOKEN>
```

## Business Flow

1. **Authenticate**: Verify admin bearer token
2. **Read setting**: Fetch `hub_dev_mode` from database settings
3. **Return status**: `{ enabled: boolean }` where `true` if value is '1'

## Response

```json
{
  "enabled": true
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (missing or invalid bearer token)
