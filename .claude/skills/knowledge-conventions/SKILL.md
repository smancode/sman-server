---
name: knowledge-conventions
description: Development conventions for sman-server: TypeScript patterns, error handling, naming rules, route module structure, and testing practices
_scanned:
  commitHash: 6a87529d7c30fef9a812f0d1b6bbfa87c5870fed
  scannedAt: 2026-05-20T03:04:00Z
  branch: master
---

# Sman-Server Coding Conventions

## TypeScript Patterns

- **ESM imports with `.js` extensions**: Always use `.js` in import paths (e.g., `import { foo } from './db.js'`)
- **Type annotations**: Explicit parameter types, return types can be inferred
- **Interface naming**: Use `Interface` suffix for records (e.g., `ClientRecord`, `BroadcastRow`)
- **String literal types**: Use union types for constants (e.g., `'info' | 'warning' | 'update'`)

## Route Module Structure

All route modules export factory functions: `createXRouter(dependencies, ...)` returning `Router`. No global state.

```typescript
export function createReportRouter(db: HubDB, psk: string): Router {
  const router = Router();
  router.post('/endpoint', (req, res) => { /* ... */ });
  return router;
}
```

## Error Handling

- **Auth**: Return 401 with `{ error: 'Unauthorized' }` — never throw
- **Validation**: Return 400 with error message
- **Decryption failures**: Wrap in try-catch, return 400 "Invalid request"
- **Database errors**: Let them bubble (Express handles 500)

## Naming Conventions

- **Database tables**: snake_case (e.g., `client_id`, `first_seen`)
- **TypeScript interfaces**: camelCase (e.g., `clientId`, `firstName`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `REPLAY_WINDOW_MS`)
- **Private methods**: prefix with `_` (if needed) or keep as class private

## Testing (Vitest)

- Test files: `src/__tests__/*.test.ts`
- Use `describe` blocks for grouping
- Test setup: create temp DB in `os.tmpdir()` per test file
- Mock PSK: `'0123456789abcdef0123456789abcdef'` (exactly 32 bytes)

## Security Patterns

- **Bearer token auth**: Middleware checks `Authorization: Bearer ${token}` on all `/admin/*` routes
- **Replay protection**: 5-minute timestamp window for encrypted requests
- **IP-based rate limiting**: In-memory Map with periodic cleanup

## File Organization

- `src/index.ts` — App entry, Express setup, route mounting
- `src/types.ts` — All shared TypeScript interfaces
- `src/db.ts` — `HubDB` class (all SQLite operations)
- `src/routes/*.ts` — Route modules (factory pattern)
- `src/crypto.ts` — Encryption utilities (no dependencies on rest of codebase)
