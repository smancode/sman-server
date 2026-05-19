# GET /download/windows-x64

Friendly Windows download redirect (no authentication required).

## Signature

```typescript
GET /download/windows-x64
```

## Business Flow

1. **Read latest.yml**: Parse `data/updates/sman/latest.yml`
2. **Extract filename**: Find `url` field in files section
3. **Check if external URL**: If URL starts with `http://` or `https://`, redirect directly
4. **Otherwise**: Redirect to `/download/{filename}`

## Response

- `302` redirect to download URL

## Source File

`src/index.ts` - `makeFriendlyDownloadRoute()`

## Error Responses

- `404` - Installer filename not found in yml
