# GET /admin/latest-yml

Get latest.yml contents for both Windows and macOS (requires Bearer token auth).

## Signature

```typescript
GET /admin/latest-yml
Authorization: Bearer <ADMIN_TOKEN>
```

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Read Windows yml**: Try to read `data/updates/sman/latest.yml`
3. **Read macOS yml**: Try to read `data/updates/sman/latest-mac.yml`
4. **Return response**: Object with yml contents (404 if neither exists)

## Response

```json
{
  "win": "version: 1.2.3\nfiles:\n  - url: sman-setup-1.2.3.exe\n...",
  "mac": "version: 1.2.3\nfiles:\n  - url: sman-1.2.3.zip\n..."
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
- `404` - No yml files found
