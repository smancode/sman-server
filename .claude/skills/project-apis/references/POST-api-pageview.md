# POST /api/pageview

Record public page view (no authentication required).

## Signature

```typescript
POST /api/pageview
Content-Type: application/json
```

## Business Flow

1. **Extract IP**: From `req.ip` or `x-forwarded-for` header
2. **Record page view**: Increment daily counter and log IP with timestamp
3. **Return response**: `{ ok: true }`

## Response

```json
{
  "ok": true
}
```

## Source File

`src/index.ts` - route registration

## Error Responses

None (errors are silently ignored)
