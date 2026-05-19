# node:crypto

Cryptographic operations for AES-256-GCM encryption/decryption of client communication.

## Call Methods

### Encryption
```typescript
import crypto from 'node:crypto';

const iv = crypto.randomBytes(12);
const key = Buffer.from(psk, 'utf-8');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
const authTag = cipher.getAuthTag();
const result = Buffer.concat([iv, encrypted, authTag]).toString('base64');
```

### Decryption
```typescript
const buf = Buffer.from(encoded, 'base64');
const iv = buf.subarray(0, 12);
const authTag = buf.subarray(buf.length - 16);
const ciphertext = buf.subarray(12, buf.length - 16);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
decipher.setAuthTag(authTag);
const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
```

### Hash Calculation (for uploads)
```typescript
const sha512 = crypto.createHash('sha512').update(fileData).digest('base64');
```

## Config Source

- **PSK (Pre-Shared Key)**: 32-character string loaded from:
  - Environment variable `SMAN_PSK` (priority)
  - File `hub.key` in project root (fallback)
- **Validation**: Server refuses to start if PSK is missing or not exactly 32 characters
- **Loading**: `src/index.ts` - `loadPsk()` function

## Call Locations

| File | Purpose |
|------|---------|
| `src/crypto.ts` | Encryption/decryption utility functions |
| `src/routes/report.ts` | Decrypt client reports, error reports, feedback |
| `src/routes/broadcast.ts` | Decrypt broadcast queries, encrypt broadcast responses |
| `src/routes/admin.ts` | Calculate SHA512 for uploaded files |
| `src/ws-server.ts` | Decrypt WebSocket auth messages |

## Purpose

**End-to-end encryption** for all client-to-server communication. Ensures:
- Confidentiality of usage data
- Integrity verification via authentication tags
- Replay protection via timestamp validation (±5 minutes)

## Wire Format

Base64-encoded concatenation:
```
[12 bytes IV] [variable ciphertext] [16 bytes auth tag]
```

## Algorithm

- **Cipher**: AES-256-GCM (authenticated encryption)
- **Key derivation**: Direct UTF-8 bytes from PSK (32 chars = 256 bits)
- **IV length**: 12 bytes (96 bits) - GCM standard
- **Auth tag length**: 16 bytes (128 bits)
