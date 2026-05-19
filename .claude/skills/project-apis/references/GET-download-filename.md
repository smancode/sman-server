# GET /download/:filename

Download update file with redirect support (no authentication required).

## Signature

```typescript
GET /download/:filename
```

## Request Parameters

- `filename` (path parameter): Name of the file to download

## Business Flow

1. **Check redirect mapping**: Read from `data/updates/sman/_redirects/{filename}`
2. **If redirect exists**: Return 302 redirect to external URL
3. **If local file exists**: Send file and record download in database (for binary files)
4. **Otherwise**: Return 404

## Response

- `302` redirect to external URL (if redirect mapping exists)
- `200` with file content (if local file exists)
- `404` if file not found

## Source File

`src/index.ts` - `handleDownload()`

## Error Responses

- `404` - File not found
