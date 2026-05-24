# Integration Tests - IM End-to-End Message Flow

## Purpose

Comprehensive end-to-end tests for instant messaging functionality, covering complete data flows from client send through Hub processing to client receive.

## Location

`tests/im-integration.test.ts` (954 lines)

## Test Framework
- **Runner**: Vitest with temporary SQLite databases per test
- **Encryption**: Real AES-256-GCM encryption/decryption
- **Isolation**: Fresh database instances per test

## Key Test Scenarios

### 1. Basic Message Flow (Agent → Hub → Client)
Validates: Message encryption, Hub storage, broadcast encryption, client decryption, complete field roundtrip

### 2. Agent Lifecycle (running → completed)
Validates: Message upsert (INSERT vs ON CONFLICT DO UPDATE), final DB state has completed content

### 3. Message Persistence and Sync
Validates: Message persistence across connections, timestamp-based sync ordering

### 4. Empty Content Handling
Validates: Empty content (`content: ''`) is not skipped, stored in Hub and Client DB

### 5. Message Deduplication
Validates: INSERT OR IGNORE prevents duplicate storage, idempotent handling

### 6. Encrypted Payload Format
Validates: Encryption/decryption roundtrip preserves all fields, types, and values

### 7. Field Type Consistency
Validates: Type preservation through encryption/decryption (strings, arrays, optional fields)

### 8. Client Reconnect with Sync
Validates: Sync retrieves messages sent while offline, correct ordering

### 9. Message Sequence Numbers
Validates: Seq field preserved through processing, ordering by seq vs timestamp

### 10. Room Membership and Presence
Validates: Presence updates reflect room membership changes, debounced broadcasts

## Test Utilities

- `createTestDB()` - Creates temporary IMDB with unique path
- `cleanupDB(dbPath, imdb)` - Closes DB and deletes temp file
- `simulateHubImSend()` - Simulates Hub flow: decrypt → upsert → broadcast
- `simulateClientReceive()` - Simulates client receive: decrypt → insert
- `simulateClientSync()` - Simulates client sync: query → decrypt → return

## Data Flow Validated

**Send Flow**: Client → Encrypt → Hub → Decrypt → Upsert → Broadcast (encrypted)
**Receive Flow**: Hub Broadcast → Client Decrypt → Insert → UI Render
**Sync Flow**: Client Request → Hub Query → Encrypt Response → Client Decrypt → Insert

## Key Assertions
- Field completeness and correctness
- Type consistency (no coercion)
- Empty content handling
- Deduplication
- Ordering by timestamp/seq
- Encryption format: `enc:` + base64(AES-256-GCM)
- Persistence across connections

## Running Tests
```bash
pnpm test im-integration           # Run IM integration tests
pnpm test:watch im-integration     # Watch mode
```

## Coverage
✅ Message encryption/decryption, Hub processing, Client receive/sync, Agent lifecycle, Empty content, Deduplication, Type consistency, Reconnect, Sequence numbers, Room presence
