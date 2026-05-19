# POST /admin/broadcast

Create a new broadcast message (requires Bearer token auth).

## Signature

```typescript
POST /admin/broadcast
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  id: string;        // Unique broadcast ID
  title: string;     // Broadcast title
  body: string;      // Broadcast body content
}
```

## Request Parameters

- `id` (string, required): Unique identifier for the broadcast
- `title` (string, required): Title of the broadcast
- `body` (string, required): Body content of the broadcast

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate input**: All fields (id, title, body) are required
3. **Insert broadcast**: Add to `broadcasts` table with `active=1` and current timestamp
4. **Return response**: `{ ok: true }`

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
- `400` - Missing required fields (id, title, body)
