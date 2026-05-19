# Route Module Factory Pattern

All routes follow the factory pattern for dependency injection:

```typescript
// src/routes/report.ts
export function createReportRouter(db: HubDB, psk: string): Router {
  const router = Router();

  router.post('/report', (req: Request, res: Response) => {
    try {
      const { payload, timestamp, pskVersion } = req.body as EncryptedRequest;

      if (pskVersion !== 1) {
        res.status(400).json({ error: 'Unsupported PSK version' });
        return;
      }

      const data = decrypt(payload, psk) as ReportPayload;
      db.upsertClient({ /* ... */ });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  return router;
}

// src/index.ts
app.use('/api', createReportRouter(db, PSK));
```

**Key points:**
- Dependencies injected as parameters (no globals)
- Return Express `Router` instance
- Early returns on error (don't use else)
- Type assertions with `as` for request body
