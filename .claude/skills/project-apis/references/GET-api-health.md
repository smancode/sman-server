# GET /api/health

Health check endpoint under /api path (no authentication required).

## Signature

```typescript
GET /api/health
```

## Business Flow

1. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/index.ts` - route registration

## Error Responses

None
