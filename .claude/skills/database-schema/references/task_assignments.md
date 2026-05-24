# task_assignments Table

## Purpose
Maps tasks to specific agents with subtask allocations. Created after evaluation approval, tracks execution status of each agent's assigned portion of a task.

## DDL
```sql
CREATE TABLE IF NOT EXISTS task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  workspace TEXT NOT NULL,
  subtask_ids TEXT DEFAULT '[]',
  instructions TEXT,
  report_id TEXT,
  status TEXT DEFAULT 'assigned'
    CHECK(status IN ('assigned','running','completed','failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_agent ON task_assignments(agent_id, status);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique assignment identifier (UUID)
- **task_id** (TEXT NOT NULL): Reference to tasks.id being assigned
- **agent_id** (TEXT NOT NULL): Agent responsible for this assignment
- **workspace** (TEXT NOT NULL): Agent's workspace directory for execution
- **subtask_ids** (TEXT DEFAULT '[]'): JSON array of subtask IDs assigned to this agent
- **instructions** (TEXT | NULL): Custom instructions for this agent's portion
- **report_id** (TEXT | NULL): Reference to approved evaluation_reports.id
- **status** (TEXT DEFAULT 'assigned'): Assignment status (assigned/running/completed/failed)
- **created_at** (TEXT NOT NULL): ISO timestamp of assignment creation

## Indexes
- **idx_assignments_task**: Find all agent assignments for a task
- **idx_assignments_agent**: Find active/pending assignments for an agent

## Foreign Keys
- **task_id** → Logical reference to `tasks.id` (not enforced)
- **agent_id** → Logical reference to `agents.id` (not enforced)
- **report_id** → Logical reference to `evaluation_reports.id` (not enforced)

## Relationships
- **Many-to-one** with `tasks` (task split into multiple assignments)
- **Many-to-one** with `agents` (agent can have multiple assignments)
- **Many-to-one** with `evaluation_reports` (assignment from approved report)

## Key Features
- **Task splitting**: One task can have multiple agent assignments (parallel execution)
- **Subtask allocation**: Each agent gets specific subtasks via subtask_ids
- **Custom instructions**: Per-agent instructions for their portion
- **Status tracking**: Independent status per assignment (one can fail while others succeed)
- **Linked to evaluation**: Optional report_id links assignment to approved evaluation

## Workflow
```
1. Evaluation approved → create assignments (one per agent)
2. Task status → 'dispatched'
3. Agent picks up assignment → status='running'
4. Agent completes → status='completed' or 'failed'
5. When all assignments done → task status='completed' or 'failed'
```

## Usage Patterns
```typescript
// Create assignments from approved evaluations
const assignments = taskDB.createAssignments('task-123', [
  {
    agentId: 'agent-1',
    workspace: '/workspace/agent-1',
    subtaskIds: ['sub-1', 'sub-2'],
    instructions: 'Focus on UI components',
    reportId: 'eval-1'
  },
  {
    agentId: 'agent-2',
    workspace: '/workspace/agent-2',
    subtaskIds: ['sub-3'],
    instructions: 'Handle API integration',
    reportId: 'eval-2'
  }
]);

// Agent claims assignment
taskDB.updateAssignmentStatus('assign-1', 'running');

// Agent completes
taskDB.updateAssignmentStatus('assign-1', 'completed');

// Get active assignments for agent
const active = taskDB.getAgentAssignments('agent-1');
```

## ⚠️ MIGRATION
None - this is a new table in TaskDB.

## Source Location
`src/db-tasks.ts:121-132` (CREATE TABLE), `src/db-tasks.ts:298-334` (CRUD operations)
