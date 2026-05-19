# node:fs

File system operations for update files, redirect mappings, static pages, and PSK loading.

## Call Methods

### File Reading
```typescript
import fs from 'node:fs';

// PSK loading
const key = fs.readFileSync(KEY_FILE, 'utf-8').trim();

// yml parsing
const yml = fs.readFileSync(ymlPath, 'utf-8');

// Redirect mapping
const targetUrl = fs.readFileSync(redirectFile, 'utf-8').trim();

// Directory listing
const files = fs.readdirSync(updatesDir);
```

### File Writing
```typescript
// Update file upload
fs.writeFileSync(targetPath, data);

// Auto-generated yml
fs.writeFileSync(path.join(updatesDir, 'latest.yml'), yml, 'utf-8');

// Redirect mapping
fs.writeFileSync(path.join(redirectDir, safeName), url, 'utf-8');
```

### Directory Operations
```typescript
// Create directories
fs.mkdirSync(updatesDir, { recursive: true });
fs.mkdirSync(pagesDir, { recursive: true });

// Check existence
if (fs.existsSync(filePath)) { /* ... */ }

// File stats
const mtime = fs.statSync(path.join(updatesDir, f)).mtime;
```

## Config Source

- **Updates directory**: `data/updates/sman/` (from `DATA_DIR` or `cwd/data`)
- **Pages directory**: `data/pages/` (public static pages)
- **PSK file**: `hub.key` in project root (optional, fallback if env var not set)
- **Redirect directory**: `data/updates/sman/_redirects/` (created on demand)

## Call Locations

| File | Purpose |
|------|---------|
| `src/index.ts` | PSK loading, directory creation, friendly download routes |
| `src/routes/admin.ts` | Update file upload, yml generation, redirect mappings, static serving |
| `src/db.ts` | Create database directory if missing |

## Purpose

**Update distribution system** - serve application updates and installer files:
- Store uploaded `.exe`, `.dmg`, `.zip`, `.yml`, `.blockmap` files
- Auto-generate `latest.yml` for Windows and macOS
- Create redirect mappings for external URLs
- Serve static pages for landing pages
- Load PSK from file if environment variable not set

## File Types

### Update Files
- `.exe` - Windows installer
- `.dmg` - macOS disk image
- `.zip` - macOS archive for electron-updater
- `.yml` - Update manifest (auto-generated)
- `.blockmap` - Binary differential update

### Redirect Files
- Stored in `_redirects/` subdirectory
- Format: plain text with external URL
- Purpose: Allow external CDNs while maintaining local yml

### Static Pages
- Stored in `data/pages/`
- Served at `/pages/*` (no auth required)
- Usage: Landing pages, download pages
