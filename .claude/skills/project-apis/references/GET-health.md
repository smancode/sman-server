# GET /health

Health check endpoint (no authentication required).

## Signature

```typescript
GET /health
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
