# tasks Table

## Purpose
Core task tracking with full lifecycle: draft → evaluating → confirmed/rejected → dispatched → running → completed/failed. Supports retry logic, auto-execution, and git branch integration.

## DDL
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'evaluating'
    CHECK(status IN ('draft','evaluating','confirmed','rejected','dispatched','running','completed','failed','cancelled','queued')),
  priority INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  context TEXT DEFAULT '{}',
  result TEXT,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  acceptance_criteria TEXT,
  subtasks TEXT DEFAULT '[]',
  auto_execute INTEGER DEFAULT 0,
  git_branch TEXT,
  version INTEGER DEFAULT 1,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_room_status ON tasks(room_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
```

## Columns
- **id** (TEXT PRIMARY KEY): UUID task identifier
- **room_id** (TEXT NOT NULL): Room where task was created
- **title** (TEXT NOT NULL): Human-readable task title
- **description** (TEXT | NULL): Detailed task description
- **status** (TEXT NOT NULL): Task status with CHECK constraint (10 valid states)
- **priority** (INTEGER DEFAULT 0): Higher number = higher priority
- **created_by** (TEXT NOT NULL): Client ID who created the task
- **assigned_to** (TEXT | NULL): Agent ID assigned to execute
- **context** (TEXT DEFAULT '{}'): JSON object with task metadata
- **result** (TEXT | NULL): Task execution result (on completion)
- **error** (TEXT | NULL): Error message (on failure)
- **retry_count** (INTEGER DEFAULT 0): Current retry attempt count
- **max_retries** (INTEGER DEFAULT 3): Maximum retry attempts allowed
- **acceptance_criteria** (TEXT | NULL): Definition of done
- **subtasks** (TEXT DEFAULT '[]'): JSON array of subtask objects
- **auto_execute** (INTEGER DEFAULT 0): If 1, auto-dispatch on confirmation
- **git_branch** (TEXT | NULL): Git branch name for execution
- **version** (INTEGER DEFAULT 1): Optimistic locking version
- **started_at** (TEXT | NULL): ISO timestamp when task started
- **completed_at** (TEXT | NULL): ISO timestamp when task completed
- **created_at** (TEXT NOT NULL): ISO timestamp of creation
- **updated_at** (TEXT NOT NULL): ISO timestamp of last update

## Indexes
- **idx_tasks_room_status**: Room task lists filtered by status
- **idx_tasks_assigned**: Agent workload queries
- **idx_tasks_created**: Task queries by creation time

## Key Features
- **State machine**: Valid transitions enforced by `VALID_TRANSITIONS` map
- **Retry logic**: Failed tasks can retry via evaluating → confirmed path
- **Auto-execution**: Bypass evaluation if `auto_execute=1`
- **Optimistic locking**: Version field for concurrent updates
- **Subtask support**: Complex tasks can have subtask breakdowns

## Lifecycle States
```
draft → evaluating → confirmed → dispatched → running → completed
                  ↘ rejected           ↘ failed
                                         ↘ cancelled
```

## Usage Patterns
```typescript
// Create task
const task = taskDB.createTask({
  roomId: 'room-123', title: 'Fix bug',
  createdBy: 'client-abc', priority: 10
});

// Transition status
taskDB.transitionStatus('task-id', 'running', 'agent-1');

// Get active task count for agent
const active = taskDB.getActiveTaskCount('agent-1');
```

## ⚠️ MIGRATION
None - new table in TaskDB.

## Source Location
`src/db-tasks.ts:69-93` (CREATE TABLE), `src/db-tasks.ts:147-244` (CRUD)
