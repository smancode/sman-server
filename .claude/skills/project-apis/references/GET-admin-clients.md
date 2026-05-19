# GET /admin/clients

List all clients with their workspaces (requires Bearer token auth).

## Signature

```typescript
GET /admin/clients
Authorization: Bearer <ADMIN_TOKEN>
```

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Query clients**: Fetch all clients from `clients` table ordered by `last_seen DESC`
3. **Fetch workspaces**: For each client, query `client_workspaces` table
4. **Return response**: Array of client objects with workspaces

## Response

```json
[
  {
    "client_id": "client-123",
    "version": "1.2.3",
    "hostname": "user-desktop",
    "ip": "192.168.1.100",
    "first_seen": "2026-05-01T10:00:00.000Z",
    "last_seen": "2026-05-20T03:04:00.000Z",
    "active_sessions": 3,
    "workspaces": ["workspace-1", "workspace-2"]
  }
]
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
