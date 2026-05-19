# PUT /admin/upload

Upload update files (.yml, .dmg, .exe, .blockmap, .zip) with auto-generated yml (requires Bearer token auth).

## Signature

```typescript
PUT /admin/upload?filename=sman-setup-1.2.3.exe&releaseNotes=Bug+fixes
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/octet-stream
Body: <binary file data>
```

## Request Parameters

- `filename` (query param, required): Name of the file being uploaded
- `releaseNotes` (query param, optional): Release notes for the update
- Body: Raw binary file data

## Supported File Types

- `.yml` - Update manifest
- `.dmg` - macOS disk image
- `.exe` - Windows installer
- `.blockmap` - Binary differential update file
- `.zip` - macOS archive for electron-updater

## Business Flow

1. **Authenticate**: Verify Bearer token matches `ADMIN_TOKEN`
2. **Validate filename**: Check file extension against whitelist
3. **Save file**: Write to `data/updates/sman/{filename}`
4. **Auto-generate yml** (for .exe and .zip only):
   - Extract version from filename using regex `\d+\.\d+\.\d+`
   - Calculate SHA512 hash of file
   - Generate `latest.yml` (Windows) or `latest-mac.yml` (macOS)
   - For .exe: Execute `update-download-links.sh` to update nginx links
5. **Return response**: File metadata

## Response

```json
{
  "ok": true,
  "path": "/updates/sman/sman-setup-1.2.3.exe",
  "size": 12345678,
  "yml": "latest.yml",
  "ymlName": "latest.yml",
  "sha512": "base64-encoded-sha512-hash",
  "version": "1.2.3"
}
```

## Source File

`src/routes/admin.ts` - `createAdminRouter()`

## Error Responses

- `401` - Unauthorized (invalid or missing Bearer token)
- `400` - Missing filename or unsupported file type
- `500` - Upload failed (stream error)
