# evaluation_reports Table

## Purpose
Stores agent evaluation reports for tasks. Agents analyze task requirements and submit proposed approaches with complexity estimates and subtask breakdowns for human review before assignment.

## DDL
```sql
CREATE TABLE IF NOT EXISTS evaluation_reports (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  workspace TEXT NOT NULL,
  claimed_subtasks TEXT DEFAULT '[]',
  approach TEXT,
  complexity TEXT,
  dependencies TEXT DEFAULT '[]',
  raw_response TEXT,
  status TEXT DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')),
  review_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eval_reports_task ON evaluation_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_eval_reports_agent ON evaluation_reports(agent_id);
```

## Columns
- **id** (TEXT PRIMARY KEY): Unique report identifier (UUID)
- **task_id** (TEXT NOT NULL): Reference to tasks.id being evaluated
- **agent_id** (TEXT NOT NULL): Agent submitting the evaluation
- **workspace** (TEXT NOT NULL): Agent's workspace directory
- **claimed_subtasks** (TEXT DEFAULT '[]'): JSON array of subtask IDs agent claims
- **approach** (TEXT | NULL): Agent's proposed implementation approach
- **complexity** (TEXT | NULL): Complexity assessment (e.g., "low", "medium", "high")
- **dependencies** (TEXT DEFAULT '[]'): JSON array of dependency descriptions
- **raw_response** (TEXT | NULL): Full agent response (for audit/debugging)
- **status** (TEXT DEFAULT 'pending'): Review status (pending/approved/rejected)
- **review_comment** (TEXT | NULL): Human reviewer's feedback
- **created_at** (TEXT NOT NULL): ISO timestamp of report submission
- **updated_at** (TEXT NOT NULL): ISO timestamp of last update

## Indexes
- **idx_eval_reports_task**: Find all evaluations for a task
- **idx_eval_reports_agent**: Find evaluation history for an agent

## Foreign Keys
- **task_id** → Logical reference to `tasks.id` (not enforced)
- **agent_id** → Logical reference to `agents.id` (not enforced)

## Relationships
- **Many-to-one** with `tasks` (multiple evaluations per task)
- **Many-to-one** with `agents` (agent can submit multiple evaluations)
- **One-to-one** with `task_assignments` (approved report → assignment)

## Key Features
- **Multi-agent evaluation**: Multiple agents can evaluate the same task
- **Human-in-the-loop**: Status requires human approval before execution
- **Subtask claiming**: Agents can claim specific subtasks they're best suited for
- **Audit trail**: Raw response preserved for debugging and learning
- **Review feedback**: Reviewers can provide comments on rejections

## Workflow
```
1. Task created (status='evaluating')
2. Agents submit evaluation reports (status='pending')
3. Human reviews reports:
   - Approve → status='approved', create task_assignments
   - Reject → status='rejected', add review_comment
4. Task status transitions to 'confirmed' or 'rejected'
```

## Usage Patterns
```typescript
// Agent submits evaluation
const report = taskDB.createEvaluationReport({
  taskId: 'task-123',
  agentId: 'agent-1',
  workspace: '/path/to/workspace',
  claimedSubtasks: ['sub-1', 'sub-2'],
  approach: 'Use React Hook Form for validation...',
  complexity: 'medium',
  dependencies: ['Review API spec first'],
  rawResponse: 'Full LLM response...'
});

// Human reviews
taskDB.updateReportStatus('report-1', 'approved', 'Looks good, proceed');

// Get all evaluations for a task
const reports = taskDB.listEvaluationReports('task-123');
```

## ⚠️ MIGRATION
None - this is a new table in TaskDB.

## Source Location
`src/db-tasks.ts:104-119` (CREATE TABLE), `src/db-tasks.ts:260-294` (CRUD operations)
