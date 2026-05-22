# node:crypto

Cryptographic operations for AES-256-GCM encryption/decryption, UUID generation, hash calculation, and PSK loading.

## Call Methods

### PSK Loading (NEW)
```typescript
import { loadPsk } from './crypto.js';

// Load PSK from environment variable or file
const PSK = loadPsk();

// Priority: SMAN_PSK env var > data/hub.key file
// PSK is cached in-memory after first load
// Process exits if PSK not found or invalid length
```

### Encryption
```typescript
import crypto from 'node:crypto';
import { encrypt } from './crypto.js';

// Encrypt data using cached PSK
const encrypted = encrypt(data, PSK);
// Or: const encrypted = encrypt(data); // uses cached PSK
```

### Decryption
```typescript
import { decrypt } from './crypto.js';

// Decrypt data using cached PSK
const decrypted = decrypt(encrypted, PSK);
// Or: const decrypted = decrypt(encrypted); // uses cached PSK
```

### IM Message Encryption (NEW)
```typescript
import { encryptIMMessage, decryptIMMessage } from './im-crypto.js';

// Encrypt IM message content and attachments
const encrypted = encryptIMMessage({ content: "hello", attachments: "..." }, PSK);

// Decrypt IM message content and attachments
const decrypted = decryptIMMessage(encrypted, PSK);

// Field-level encryption
import { encryptField, decryptField } from './im-crypto.js';
const encryptedField = encryptField("sensitive data", PSK);
const decryptedField = decryptField(encryptedField, PSK);
```

### UUID Generation
```typescript
const id = crypto.randomUUID();
```

### Hash Calculation (for agent IDs)
```typescript
const hash = crypto.createHash('sha256').update(`${clientId}:${workspace}`).digest('hex').slice(0, 12);
const agentId = `${hostname}:${hash}`;
```

### SHA512 Calculation (for uploads)
```typescript
const sha512 = crypto.createHash('sha512').update(fileData).digest('base64');
```

## Config Source

### PSK Configuration (NEW - commit 6f685b9)
- **Environment Variable**: `SMAN_PSK` (32 characters) - **Priority**
- **File**: `data/hub.key` (32 characters, trimmed) - **Fallback**
- **Caching**: PSK cached in-memory after first load
- **Error Handling**: Process exits if PSK not found or invalid length
- **Loading Location**: `src/crypto.ts` - `loadPsk()` function

## Call Locations

| File | Purpose |
|------|---------|
| `src/crypto.ts` | ⚠️ NEW: PSK loading with caching and environment variable support |
| `src/im-crypto.ts` | ⚠️ NEW: IM message encryption utilities |
| `src/routes/report.ts` | Decrypt client reports, error reports, feedback |
| `src/routes/broadcast.ts` | Decrypt broadcast queries, encrypt broadcast responses |
| `src/routes/admin.ts` | Calculate SHA512 for uploaded files |
| `src/ws-server.ts` | Decrypt WebSocket auth messages, encrypt/decrypt IM messages |
| `src/db-rooms.ts` | Generate UUID for room creation |
| `src/db-im.ts` | Generate UUID for IM message IDs |

## Purpose

**End-to-end encryption**, **unique ID generation**, and **secure key management**:
- **Encryption**: Confidentiality of usage data with integrity verification
- **IM Encryption**: Message content and attachments encrypted with `enc:` prefix
- **UUID generation**: Unique identifiers for IM messages, rooms
- **Hash calculation**: Deterministic agent IDs from client+workspace
- **Replay protection**: Timestamp validation (±5 minutes)
- **PSK management**: Centralized loading with caching and flexible configuration

## Wire Format

### Standard Encryption
Base64-encoded concatenation:
```
[12 bytes IV] [variable ciphertext] [16 bytes auth tag]
```

### IM Encryption (NEW)
```
enc: + base64([12 bytes IV] [variable ciphertext] [16 bytes auth tag])
```

## Algorithm

- **Cipher**: AES-256-GCM (authenticated encryption)
- **Key derivation**: Direct UTF-8 bytes from PSK (32 chars = 256 bits)
- **IV length**: 12 bytes (96 bits) - GCM standard
- **Auth tag length**: 16 bytes (128 bits)

## Breaking Changes

### PSK Loading Refactor (commit 6f685b9)
- **Before**: PSK loaded inline in `src/index.ts`
- **After**: PSK loaded via `loadPsk()` in `src/crypto.ts`
- **New Feature**: Environment variable support (`SMAN_PSK`)
- **New Feature**: PSK caching via internal `cachedPsk` variable
- **New Feature**: Flexible file location (`data/hub.key` with `HUB_DATA_DIR` env var support)

### IM Message Encryption (commit ef4576e)
- **Before**: IM messages in plaintext
- **After**: IM messages encrypted with `enc:` prefix
- **Backward Compatible**: Non-encrypted fields pass through unchanged
- **New Module**: `src/im-crypto.ts` with field and message-level encryption

## New in This Update

**IM Crypto Module** (commit ef4576e):
- `encryptField()` / `decryptField()` - Field-level encryption
- `encryptIMMessage()` / `decryptIMMessage()` - Message-level encryption
- Encryption format: `enc:` + base64(AES-256-GCM payload)
- Automatic encryption of `content` and `attachments` fields

**PSK Loading Refactor** (commit 6f685b9):
- `loadPsk()` function with environment variable support
- PSK caching for performance
- Flexible configuration (env var OR file)
- Better error handling and validation
