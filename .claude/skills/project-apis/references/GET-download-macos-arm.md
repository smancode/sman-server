# GET /download/macos-arm

Friendly macOS ARM download redirect (no authentication required).

## Signature

```typescript
GET /download/macos-arm
```

## Business Flow

1. **Scan for DMG files**: List files in `data/updates/sman/` ending with `.dmg`
2. **If DMGs exist**: Sort by modification time (newest first), redirect to latest DMG
3. **Otherwise**: Fall back to parsing `latest-mac.yml` and redirect to zip

## Response

- `302` redirect to latest DMG or zip

## Source File

`src/index.ts` - route registration

## Error Responses

- `404` - No files found
