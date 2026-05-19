---
name: knowledge-technical
description: Technical architecture for sman-server: AES-256-GCM encryption, SQLite patterns with better-sqlite3, file serving, and update distribution
_scanned:
  commitHash: 6a87529d7c30fef9a812f0d1b6bbfa87c5870fed
  scannedAt: 2026-05-20T03:04:00Z
  branch: master
---

# Sman-Server Technical Architecture

## Crypto System (AES-256-GCM)

### Wire Format
```
base64(IV[12 bytes] + ciphertext + authTag[16 bytes])
```

- **Algorithm**: `aes-256-gcm`
- **IV length**: 12 bytes (random per encryption)
- **Auth tag**: 16 bytes (appended to ciphertext)
- **Key derivation**: PSK (32-char string) converted directly to UTF-8 buffer

### Usage
```typescript
import { encrypt, decrypt } from './crypto.js';

const encrypted = encrypt({ data: 'secret' }, psk); // returns base64 string
const decrypted = decrypt(encrypted, psk);          // returns original object
```

### Security Features
- Random IV per encryption (non-deterministic ciphertext)
- Auth tag verification (throws if tampered)
- PSK version negotiation (currently only version 1)
- 5-minute replay protection window on `/api/report`

## Database (better-sqlite3)

### Configuration
```typescript
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Enable WAL mode for concurrency
```

### Patterns

**Upsert (INSERT ... ON CONFLICT DO UPDATE):**
```sql
INSERT INTO clients (client_id, version, ...)
VALUES (?, ?, ...)
ON CONFLICT(client_id) DO UPDATE SET
  version = excluded.version,
  last_seen = excluded.last_seen
```

**Soft delete via flag:**
```typescript
db.prepare('UPDATE broadcasts SET active = 0 WHERE id = ?').run(id);
```

**Transaction wrapper:**
```typescript
db.transaction(() => {
  db.prepare('DELETE FROM client_workspaces WHERE client_id = ?').run(clientId);
  const insert = db.prepare('INSERT INTO client_workspaces (...) VALUES (...)');
  for (const ws of workspaces) {
    insert.run(clientId, ws, now);
  }
})();
```

### Prepared Statements
All queries use prepared statements (`.prepare()`). `.all()` for multiple rows, `.get()` for single, `.run()` for writes.

## File Serving Architecture

### Update Files
- Served from `data/updates/sman/`
- Routes: `/updates/sman/:filename`, `/download/:filename`
- Friendly routes: `/download/windows-x64` → parses `latest.yml`, redirects to actual file
- Redirect mappings: `data/updates/sman/_redirects/<filename>` contains external URL

### Auto-generated yml
When uploading `.exe` or `.zip`, automatically generate `latest.yml` or `latest-mac.yml`:
```yaml
version: 1.2.3
files:
  - url: Sman-Setup-1.2.3.exe
    sha512: <base64 hash>
    size: 123456
releaseDate: '2026-05-20T10:00:00.000Z'
```

## Request/Response Encryption

### Client → Server (POST /api/report)
```typescript
// Request body (encrypted)
{
  payload: "<base64 blob>",  // encrypt({ clientId, version, ... }, psk)
  timestamp: 1716192000,     // Unix seconds (replay protection)
  pskVersion: 1
}

// Response (plain JSON)
{
  ok: true,
  serverTime: "2026-05-20T10:00:00.000Z",
  commands: []  // skill-auto-updater commands
}
```

### Server → Client (POST /api/broadcasts)
Response payload is encrypted before sending: `encrypt(messages, psk)`

## SPA Fallback Pattern

Static files served from `dist/public/`. In production, SPA fallback only works for `localhost` requests:
```typescript
app.use(express.static(publicDir));
app.use((req, res) => {
  if (req.method === 'GET' && req.accepts('html')) {
    res.sendFile(path.join(publicDir, 'index.html'));
    return;
  }
  res.status(404).json({ error: 'Not found' });
});
```
