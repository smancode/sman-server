# client_workspaces

Many-to-many relationship between clients and their workspace paths.

## DDL
```sql
CREATE TABLE IF NOT EXISTS client_workspaces (
  client_id TEXT NOT NULL,
  workspace TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, workspace)
);
CREATE INDEX IF NOT EXISTS idx_client_workspaces_updated ON client_workspaces(updated_at);
```

## Columns
- `client_id` - Foreign key to clients table
- `workspace` - Workspace path
- `updated_at` - Last association timestamp (indexed)

## Relationships
- Many-to-one with clients (via client_id)
- Composite primary key enforces unique client-workspace pairs

## Usage
- Workspace tracking via `replaceWorkspaces()` (full replace semantic)
- Queried by `getClientWorkspaces()` for client-specific workspaces
- Queried by `getActiveWorkspaces()` with JOIN to clients for online filtering
- Indexed for time-based active workspace detection

## Business Logic
- Replace semantic: DELETE all client workspaces, then insert new set
- Transaction-wrapped for atomicity
- Used to show active workspaces with online clients
- Updated on every client report to reflect current workspace usage
- Supports workspace-based analytics and routing
