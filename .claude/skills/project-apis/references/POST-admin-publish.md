# POST /admin/publish

Publish update with external URL (creates redirect file and yml) (requires Bearer token auth).

## Signature

```typescript
POST /admin/publish
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  version: string;        // Version number (e.g., "1.2.3")
  url: string;            // External download URL
  filename?: string;      // Optional safe filename
  sha512?: string;        // Optional SHA512 hash
  size?: number;          // Optional file size
  releaseDate?: string;   // Optional ISO 8601 date
  releaseNotes?: string;  // Optional release notes
}
```

## Request Parameters

- `version` (string, required): Semantic version number
- `url` (string, required): Valid URL pointing to external file
- `filename` (string, optional): Safe filename for local redirect
- `sha512` (string, optional): SHA512 hash of the file
- `size` (number, optional): File size in bytes
- `releaseDate` (string, optional): ISO 8601 release date
- `releaseNotes` (string, optional): Release notes

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate inputs**: Check version and URL are present and valid
3. **Determine safe filename**: Use provided filename or extract from URL, or default to `Sman-Setup-{version}.exe`
4. **Create redirect mapping**: Save URL to `data/updates/sman/_redirects/{filename}`
5. **Generate yml**: Create `latest.yml` with redirect filename
6. **Return response**: Yml content and path

## Response

```json
{
  "ok": true,
  "path": "/updates/sman/latest.yml",
  "yml": "version: 1.2.3\nfiles:\n  - url: sman-setup-1.2.3.exe\n..."
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
- `400` - Missing version/url or invalid URL
