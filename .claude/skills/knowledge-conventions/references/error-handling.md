# Error Handling Patterns

## 1. Authentication Middleware

```typescript
router.use((req: Request, res: Response, next) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});
```

## 2. Input Validation

```typescript
if (!id || !title || !body) {
  res.status(400).json({ error: 'id, title, body required' });
  return;
}
```

## 3. Decryption Failures

```typescript
try {
  const data = decrypt(payload, psk) as ReportPayload;
  // process data...
} catch {
  res.status(400).json({ error: 'Invalid request' });
}
```

## 4. Parameter Bounds Checking

```typescript
const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 100, 1), 500);
```

**Rules:**
- Never throw for auth/validation errors — always return status code
- Use `return` after `res.status().json()` to prevent double-sends
- Catch crypto errors and return generic "Invalid request"
