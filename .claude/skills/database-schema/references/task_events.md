# task_events Table

## Purpose
Audit log for task lifecycle events. Tracks every status transition, assignment, and state change with timestamps and actors for debugging and analytics.

## DDL
```sql
CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  event TEXT NOT NULL,
  actor TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
```

## Columns
- **id** (INTEGER PRIMARY KEY AUTOINCREMENT): Auto-incrementing event ID
- **task_id** (TEXT NOT NULL): Reference to tasks.id
- **event** (TEXT NOT NULL): Event type (created, evaluation_started, confirmed, etc.)
- **actor** (TEXT | NULL): Client/agent ID who triggered the event
- **metadata** (TEXT DEFAULT '{}'): JSON object with event-specific data
- **created_at** (TEXT NOT NULL): ISO timestamp of event

## Indexes
- **idx_task_events_task**: Efficient retrieval of all events for a task

## Foreign Keys
- **task_id** → Logical reference to `tasks.id` (not enforced)

## Relationships
- **Many-to-one** with `tasks` (multiple events per task)

## Key Features
- **Immutable audit trail**: Events never deleted, only inserted
- **Rich metadata**: JSON field stores event-specific context
- **Actor tracking**: Records who/what triggered each transition
- **Temporal ordering**: Auto-increment ID + created_at for sequencing

## Event Types
- `created` - Task created
- `evaluation_started` - Evaluation phase began
- `confirmed` - Task approved for execution
- `rejected` - Task evaluation rejected
- `dispatched` - Task assigned to agent(s)
- `started` - Task began running
- `completed` - Task finished successfully
- `failed` - Task execution failed
- `cancelled` - Task cancelled
- `claimed` - Agent claimed task (legacy)
- `evaluation_submitted` - Agent submitted evaluation
- `evaluation_approved` - Evaluation approved
- `evaluation_rejected` - Evaluation rejected

## Usage Patterns
```typescript
// Get task history
const events = taskDB.getTaskEvents('task-id');
// Returns: [
//   { event: 'created', actor: 'client-1', created_at: '...' },
//   { event: 'evaluation_started', actor: null, created_at: '...' },
//   { event: 'confirmed', actor: 'client-1', created_at: '...' },
//   ...
// ]

// Events auto-inserted on status transitions
taskDB.transitionStatus('task-id', 'running', 'agent-1');
// Creates: { event: 'started', actor: 'agent-1', ... }
```

## ⚠️ MIGRATION
None - this is a new table in TaskDB.

## Source Location
`src/db-tasks.ts:95-102` (CREATE TABLE), `src/db-tasks.ts:246-250` (insertEvent), `src/db-tasks.ts:252-256` (getTaskEvents)
