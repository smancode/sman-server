# Update Serving Flow

## Upload Endpoint
`PUT /admin/upload?filename=installer.exe&releaseNotes=...`

## Supported File Types
- `.yml` - Update metadata
- `.exe` - Windows installer
- `.dmg` - macOS disk image
- `.blockmap` - Differential update file
- `.zip` - macOS archive

## Upload Process
1. **Validation**: Check file extension against whitelist
2. **Save**: Write file to `data/updates/sman/<filename>`
3. **Auto-Generate YML** (for .exe and .zip):
   - Extract version from filename (regex `/\d+\.\d+\.\d+/`)
   - Calculate SHA512 hash
   - Generate `latest.yml` (Windows) or `latest-mac.yml` (macOS)
   - Include version, url, sha512, size, releaseDate, releaseNotes
4. **Update Links** (Windows .exe only):
   - Execute `update-download-links.sh` to update nginx download page

## Publish Endpoint (External URLs)
`POST /admin/publish`

## Publish Process
1. **Validation**: Check version and URL format
2. **Safe Filename**: Generate or extract filename (must end in .exe or .dmg)
3. **Redirect Mapping**: Save `data/updates/sman/_redirects/<filename>` containing real URL
4. **Generate YML**: Create `latest.yml` pointing to redirect filename

## File Serving
All files served via static route `/updates/sman/*`

## Key Business Rules
- Auto-generated YML for electron-updater compatibility
- Redirect files enable CDN/external hosting
- Windows uploads trigger download page updates
- Version extracted from filename pattern matching

## Source
`src/routes/admin.ts:53-165`
