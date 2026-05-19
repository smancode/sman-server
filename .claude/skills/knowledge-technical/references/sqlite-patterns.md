# SQLite Patterns with better-sqlite3

## Class Structure

```typescript
import Database from 'better-sqlite3';

export class HubDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  // All methods use prepared statements
}
```

## Query Patterns

### Single row (get)
```typescript
getClient(clientId: string): ClientRecord | undefined {
  return this.db.prepare('SELECT * FROM clients WHERE client_id = ?')
    .get(clientId) as ClientRecord | undefined;
}
```

### Multiple rows (all)
```typescript
getAllClients(): ClientRecord[] {
  return this.db.prepare('SELECT * FROM clients ORDER BY last_seen DESC')
    .all() as ClientRecord[];
}
```

### Insert/Update (run)
```typescript
createBroadcast(params: CreateBroadcastParams): void {
  this.db.prepare(
    'INSERT INTO broadcasts (id, title, body, created_at) VALUES (?, ?, ?, ?)'
  ).run(params.id, params.title, params.body, params.createdAt);
}
```

### Upsert Pattern
```typescript
upsertClient(params: UpsertClientParams): void {
  const now = new Date().toISOString();
  this.db.prepare(`
    INSERT INTO clients (client_id, version, hostname, ip, first_seen, last_seen, active_sessions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET
      version = excluded.version,
      hostname = excluded.hostname,
      ip = excluded.ip,
      last_seen = excluded.last_seen,
      active_sessions = excluded.active_sessions
  `).run(params.clientId, params.version, params.hostname, params.ip, now, now, params.activeSessions);
}
```

## Type Safety

Define row interfaces matching table columns:
```typescript
interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  active: number;
}

const row = this.db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(id) as BroadcastRow | undefined;
```

## DateTime Handling

- Store ISO 8601 strings: `new Date().toISOString()`
- SQLite functions: `datetime('now')`, `datetime('now', '-1 hour')`
- Query with comparison: `WHERE created_at >= ?` (pass ISO string)
