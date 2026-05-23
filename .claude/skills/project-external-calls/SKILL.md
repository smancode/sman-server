---
name: project-external-calls
description: External dependency knowledge for sman-server. Contains local system calls (database, file system, crypto, WebSocket) with call methods, config sources, and usage locations.
_scanned:
  commitHash: 135322221a07233e556d6b6aa887e121c9b3d358
  scannedAt: "2026-05-24T14:20:00Z"
  branch: master
---

# External Dependencies

## Local System Services

| Service | Type | Purpose | Reference |
|---------|------|---------|-----------|
| better-sqlite3 | SQLite Database | Persistent storage for clients, reports, broadcasts, settings, error reports, feedback, analytics, achievement leaderboard, IM messages, room management, task management | [better-sqlite3.md](references/better-sqlite3.md) |
| node:crypto | Cryptographic Operations | AES-256-GCM encryption/decryption for client communication, UUID generation for rooms and IM messages, PSK loading and validation, IM message encryption | [node-crypto.md](references/node-crypto.md) |
| node:fs | File System | Update file serving, redirect mappings, static pages, PSK loading from `data/hub.key`, database directory creation | [node-fs.md](references/node-fs.md) |
| ws (WebSocket) | Real-time Communication | Desktop client connections, room subscriptions, task broadcasts, instant messaging with encryption, agent presence, client search (includes offline clients via HubDB) | [ws-websocket.md](references/ws-websocket.md) |

## ⚠️ Breaking Changes

### PSK Loading (commit 6f685b9)
- **New Function**: `loadPsk()` in `src/crypto.ts`
- **Environment Variable**: `SMAN_PSK` (32-character key)
- **File Location**: `data/hub.key` (fallback if env var not set)
- **Caching**: PSK cached in-memory after first load
- **Error Handling**: Process exits if PSK not found or invalid length

### IM Message Encryption (commit ef4576e)
- **New Module**: `src/im-crypto.ts`
- **New Functions**:
  - `encryptField(plaintext, psk)` - Encrypt single field
  - `decryptField(ciphertext, psk)` - Decrypt single field
  - `encryptIMMessage(msg, psk)` - Encrypt message content and attachments
  - `decryptIMMessage(msg, psk)` - Decrypt message content and attachments
- **Encryption Format**: `enc:` + base64(AES-256-GCM encrypted payload)
- **Backward Compatible**: Non-encrypted fields pass through unchanged

### Enhanced Client Search (commit 1353222)
- **New Dependency**: WsHub now requires HubDBLike interface
- **New Interface**: `HubDBLike` with `getAllClients()` method
- **Enhanced Search**: Client search now includes offline clients from database
- **Search Fields**: Matches against both `client_id` and `hostname`
- **Breaking**: WsHub constructor signature changed

## Integration Points

### Crypto Module (`src/crypto.ts`)
```typescript
import { loadPsk, encrypt, decrypt } from './crypto.js';

// Load PSK from environment or file
const PSK = loadPsk();

// Encrypt/decrypt data
const encrypted = encrypt(data, PSK);
const decrypted = decrypt(encrypted, PSK);
```

### IM Crypto Module (`src/im-crypto.ts`)
```typescript
import { encryptIMMessage, decryptIMMessage } from './im-crypto.js';

// Encrypt message for transmission
const encryptedMsg = encryptIMMessage({ content: "hello", attachments: "..." }, PSK);

// Decrypt received message
const decryptedMsg = decryptIMMessage(receivedMsg, PSK);
```

### WebSocket Server (`src/ws-server.ts`)
```typescript
// WsHub now requires HubDB for offline client search
const wsHub = new WsHub(server, roomDB, imDB, hubDB, PSK, taskEngine);

// All IM messages are encrypted/decrypted automatically
handleImSend(client, msg) {
  const decrypted = decryptIMMessage(msg, this.psk);
  // Store decrypted content in DB
  this.imDB.insertMessage({ content: decrypted.content, ... });

  // Broadcast encrypted content
  const encrypted = encryptIMMessage({ ...msg, content }, this.psk);
  this.broadcastToRoom(roomId, encrypted);
}

// Client search now queries HubDB for offline clients
handleClientsSearch(client, msg) {
  // Search WS-connected clients
  for (const [, c] of this.clients) {
    // Add connected clients...
  }

  // Also search registered clients from DB (includes offline clients)
  if (this.hubDB) {
    for (const dbClient of this.hubDB.getAllClients()) {
      // Match against both clientId and hostname
      if (!query || cid.toLowerCase().includes(query) || dbClient.hostname.toLowerCase().includes(query)) {
        results.push({ clientId: cid });
      }
    }
  }
}
```

## Configuration Sources

### PSK Configuration
1. **Environment Variable**: `SMAN_PSK` (32 characters)
2. **File**: `data/hub.key` (32 characters, trimmed)
3. **Priority**: Env var > file
4. **Error**: Process exits if neither found or invalid length

### Database Files
- `data/hub.db` - HubDB (clients, reports, broadcasts)
- `data/rooms.db` - RoomDB (rooms, members, agents)
- `data/tasks.db` - TaskDB (tasks, assignments, evaluations)
- `data/im.db` - IMDB (instant messages)

## Key Patterns

- **Encryption**: All client communication and IM messages encrypted via AES-256-GCM
- **PSK Caching**: PSK loaded once and cached in-memory
- **IM Encryption**: Content and attachments encrypted with `enc:` prefix
- **Transparent Routing**: Some IM messages (presence, typing) bypass storage
- **Automatic Cleanup**: IM messages deleted after 7 days
- **Message Sequencing**: IM messages have `seq` field for ordering
- **Offline Client Search**: WebSocket server can query HubDB for registered clients
