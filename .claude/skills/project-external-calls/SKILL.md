---
name: project-external-calls
description: External dependency knowledge for sman-server. Contains local system calls (database, file system, crypto, WebSocket) with call methods, config sources, and usage locations.
_scanned:
  commitHash: d76da6e33a1c2c5e5c8f7c9e5e3e8e5e8e5e8e5e
  scannedAt: "2026-05-25T14:30:00Z"
  branch: master
---

# External Dependencies

## Local System Services

| Service | Type | Purpose | Reference |
|---------|------|---------|-----------|
| better-sqlite3 | SQLite Database | Persistent storage for clients, reports, broadcasts, settings, error reports, feedback, analytics, achievement leaderboard, IM messages, room management, task management | [better-sqlite3.md](references/better-sqlite3.md) |
| node:crypto | Cryptographic Operations | AES-256-GCM encryption/decryption for client communication, UUID generation for rooms and IM messages, PSK loading and validation, IM message encryption | [node-crypto.md](references/node-crypto.md) |
| node:fs | File System | Update file serving, redirect mappings, static pages, PSK loading from `data/hub.key`, database directory creation | [node-fs.md](references/node-fs.md) |
| ws (WebSocket) | Real-time Communication | Desktop client connections, room subscriptions, task broadcasts, instant messaging with encryption, agent presence, client search, IM room management with membership tracking | [ws-websocket.md](references/ws-websocket.md) |

## ⚠️ Breaking Changes

### IM Room Management (commit d76da6e)
- **New Table**: `im_rooms` in IMDB for room metadata persistence
- **New Methods**:
  - `upsertRoom(roomId, name, members, lastMessageTime)` - Persist room to DB
  - `getRoomsForMember(clientId)` - Get rooms where client is member
  - `getRoom(roomId)` - Get single room details
  - `deleteRoom(roomId)` - Remove room from DB
- **Enhanced Membership**: In-memory `imRoomMembers` Map tracks online/offline members
- **New Message Types**:
  - `im.room.invited` - Sent when user added to room (on reconnect or new member)
  - `im.room.updated` - Broadcast room metadata changes (name, members)
  - `im.room.dissolved` - Forward to all members before cleanup
- **Concurrency Control**: MAX_IM_CONCURRENCY limit (20) for IM operations
- **Presence Debouncing**: 150ms batch window for presence broadcasts

### IM Message Upsert (commit ffd397b)
- **New Method**: `upsertMessage()` in IMDB
- **Purpose**: Support agent lifecycle messages (running → completed)
- **Behavior**: INSERT new message or UPDATE content/status/type for existing ID
- **Use Case**: Agent messages start as `running` (empty content), later updated to `completed` with full content
- **Conflict Resolution**: `ON CONFLICT(id) DO UPDATE SET content = excluded.content, status = excluded.status, type = excluded.type`

### Enhanced IM Broadcasting (commit 23391ba)
- **New Method**: `broadcastToImRoom(imRoomId, msg, excludeClientId)` - Targeted broadcast to room members only
- **Reverse Index**: `clientIdToWs` Map for O(1) WebSocket lookup by clientId
- **Performance**: Replaced global room broadcast with membership-based routing
- **Membership Tracking**: Real-time tracking of online/offline room members
- **Disconnect Handling**: Automatic cleanup of IM room membership on disconnect

### Structured Logging (commit e8a210e)
- **New Constant**: `LOG` function for consistent WebSocket hub logging
- **Format**: `[HubWS]` prefix for all hub events
- **Coverage**: Auth, disconnect, IM routing, room updates, member changes
- **Debug**: Track message flow, connection state, membership changes

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
// WsHub requires HubDB for offline client search and IM room management
const wsHub = new WsHub(server, roomDB, imDB, hubDB, PSK, taskEngine);

// IM message handling with upsert (agent lifecycle)
handleImSend(client, msg) {
  const decrypted = decryptIMMessage(msg, this.psk);

  // Upsert: insert new or update existing (for agent running → completed)
  this.imDB.upsertMessage({
    id, room_id: roomId, sender, content,
    status, type, timestamp, seq
  });

  // Broadcast encrypted to room members only
  const encrypted = encryptIMMessage({ ...msg, content }, this.psk);
  this.broadcastToImRoom(roomId, encrypted, sender);
}

// IM room management with membership tracking
handleImRoomUpdated(client, msg) {
  const { roomId, members, name } = msg;

  // Update in-memory membership
  this.imRoomMembers.set(roomId, new Set(members));

  // Persist to DB for offline users
  this.imDB.upsertRoom(roomId, name, members);

  // Broadcast to all members
  this.broadcastToImRoom(roomId, encrypted);

  // Send invites to new members
  for (const newMember of addedMembers) {
    const ws = this.clientIdToWs.get(newMember);
    if (ws) ws.send(invitedMsg);
  }
}

// Client disconnect: cleanup IM membership
handleDisconnect(ws) {
  // Remove from clientIdToWs index
  this.clientIdToWs.delete(client.clientId);

  // Remove from all IM rooms
  for (const [roomId, members] of this.imRoomMembers) {
    if (members.has(client.clientId)) {
      members.delete(client.clientId);
      this.schedulePresenceBroadcast(roomId); // Debounced presence
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
- `data/im.db` - IMDB (instant messages, **NEW: room metadata**)

## Key Patterns

- **Encryption**: All client communication and IM messages encrypted via AES-256-GCM
- **PSK Caching**: PSK loaded once and cached in-memory
- **IM Encryption**: Content and attachments encrypted with `enc:` prefix
- **Message Upsert**: Agent lifecycle support (running → completed) via upsert
- **Room Persistence**: IM room metadata persisted to DB for offline recovery
- **Membership Tracking**: Real-time in-memory + DB-backed membership
- **Targeted Broadcasting**: Messages routed only to room members, not global
- **Presence Debouncing**: 150ms batch window for rapid presence changes
- **Concurrency Control**: Max 20 concurrent IM operations to prevent overload
- **Structured Logging**: Consistent `[HubWS]` prefix for debugging
- **Reverse Index**: O(1) WebSocket lookup by clientId
