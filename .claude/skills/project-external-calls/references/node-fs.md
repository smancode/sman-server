# node:fs

File system operations for update files, redirect mappings, static pages, PSK loading, and database directory creation.

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
- **Database directories**: Created automatically by each DB class constructor

## Call Locations

| File | Purpose |
|------|---------|
| `src/index.ts` | PSK loading, directory creation, friendly download routes |
| `src/routes/admin.ts` | Update file upload, yml generation, redirect mappings, static serving |
| `src/db.ts` | Create hub.db directory if missing |
| `src/db-rooms.ts` | Create rooms.db directory if missing |
| `src/db-tasks.ts` | Create tasks.db directory if missing |
| `src/db-im.ts` | Create im.db directory if missing (NEW) |

## Purpose

**Multi-purpose file system operations**:
- **Update distribution**: Store and serve application updates
- **Static content**: Public pages and redirect mappings
- **Configuration**: PSK loading from file
- **Database initialization**: Create database directories automatically (NEW: im.db)

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

### Database Directories (NEW)
Each database class now creates its parent directory automatically:
- `HubDB` → `data/hub.db`
- `RoomDB` → `data/rooms.db`
- `TaskDB` → `data/tasks.db`
- `IMDB` → `data/im.db` (NEW)

This ensures the server starts correctly even if the `data/` directory doesn't exist.

## Changes in This Update

**NEW**: `src/db-im.ts` now creates `data/im.db` directory automatically, matching the pattern of other database classes.
