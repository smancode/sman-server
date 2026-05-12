import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { TaskRecord, TaskEventRecord, TaskStatus, EvaluationReportRecord, TaskAssignmentRecord } from './types.js';

// New lifecycle: draft → evaluating → confirmed/rejected → dispatched → running → completed/failed
// Legacy states (queued) kept for backward compat
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ['evaluating', 'cancelled'],
  evaluating: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['dispatched', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  dispatched: ['running', 'cancelled', 'failed', 'stopping'],
  running: ['completed', 'failed', 'cancelled', 'stopping'],
  stopping: ['cancelled', 'failed'],
  completed: [],
  failed: ['evaluating'], // retry: re-evaluate
  cancelled: [],
  // Legacy
  queued: ['dispatched', 'cancelled'],
};

export interface CreateTaskParams {
  roomId: string;
  title: string;
  description?: string;
  createdBy: string;
  priority?: number;
  context?: Record<string, unknown>;
  acceptanceCriteria?: string;
  subtasks?: { id: string; name: string; description?: string }[];
  autoExecute?: boolean;
  gitBranch?: string;
}

export interface CreateEvaluationReportParams {
  taskId: string;
  agentId: string;
  workspace: string;
  claimedSubtasks: string[];
  approach: string;
  complexity: string;
  dependencies: string[];
  rawResponse: string;
}

export interface CreateAssignmentParams {
  taskId: string;
  agentId: string;
  workspace: string;
  subtaskIds: string[];
  instructions?: string;
  reportId?: string;
}

export class TaskDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
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

      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        event TEXT NOT NULL,
        actor TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

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

      CREATE INDEX IF NOT EXISTS idx_tasks_room_status ON tasks(room_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, status);
      CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_eval_reports_task ON evaluation_reports(task_id);
      CREATE INDEX IF NOT EXISTS idx_eval_reports_agent ON evaluation_reports(agent_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_agent ON task_assignments(agent_id, status);
    `);
  }

  // ---- Tasks ----

  createTask(params: CreateTaskParams): TaskRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const context = params.context ? JSON.stringify(params.context) : '{}';
    const subtasks = params.subtasks ? JSON.stringify(params.subtasks) : '[]';

    this.db.prepare(`
      INSERT INTO tasks (id, room_id, title, description, priority, created_by, context, acceptance_criteria, subtasks, auto_execute, git_branch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.roomId, params.title, params.description ?? null, params.priority ?? 0, params.createdBy, context, params.acceptanceCriteria ?? null, subtasks, params.autoExecute !== false ? 1 : 0, params.gitBranch ?? null);

    this.insertEvent(id, 'created', params.createdBy, { title: params.title });

    return this.getTask(id)!;
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRecord | undefined;
  }

  listRoomTasks(roomId: string, status?: TaskStatus): TaskRecord[] {
    if (status) {
      return this.db.prepare('SELECT * FROM tasks WHERE room_id = ? AND status = ? ORDER BY priority DESC, created_at ASC').all(roomId, status) as TaskRecord[];
    }
    return this.db.prepare('SELECT * FROM tasks WHERE room_id = ? ORDER BY priority DESC, created_at ASC').all(roomId) as TaskRecord[];
  }

  listAllTasks(): TaskRecord[] {
    return this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as TaskRecord[];
  }

  transitionStatus(taskId: string, newStatus: TaskStatus, actor?: string, metadata?: Record<string, unknown>): TaskRecord | null {
    const task = this.getTask(taskId);
    if (!task) return null;

    const allowed = VALID_TRANSITIONS[task.status as TaskStatus];
    if (!allowed || !allowed.includes(newStatus)) return null;

    const now = new Date().toISOString();
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const values: unknown[] = [newStatus, now];

    if (newStatus === 'running' && !task.started_at) {
      updates.push('started_at = ?');
      values.push(now);
    }
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      updates.push('completed_at = ?');
      values.push(now);
    }

    values.push(taskId);
    this.db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const eventMap: Record<string, string> = {
      evaluating: 'evaluation_started',
      confirmed: 'confirmed',
      rejected: 'rejected',
      dispatched: 'dispatched',
      running: 'started',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
      queued: 'retried',
    };
    this.insertEvent(taskId, eventMap[newStatus] || newStatus, actor, metadata);

    return this.getTask(taskId)!;
  }

  assignTask(taskId: string, agentId: string): TaskRecord | null {
    this.db.prepare('UPDATE tasks SET assigned_to = ?, updated_at = ? WHERE id = ?')
      .run(agentId, new Date().toISOString(), taskId);
    return this.getTask(taskId) ?? null;
  }

  setResult(taskId: string, result: string): void {
    this.db.prepare('UPDATE tasks SET result = ?, updated_at = ? WHERE id = ?')
      .run(result, new Date().toISOString(), taskId);
  }

  setError(taskId: string, error: string): void {
    this.db.prepare('UPDATE tasks SET error = ?, updated_at = ? WHERE id = ?')
      .run(error, new Date().toISOString(), taskId);
  }

  incrementRetry(taskId: string): number {
    this.db.prepare('UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), taskId);
    const task = this.getTask(taskId);
    return task?.retry_count ?? 0;
  }

  getActiveTaskCount(agentId: string): number {
    return (this.db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status IN ('dispatched', 'running')"
    ).get(agentId) as { c: number }).c;
  }

  insertEvent(taskId: string, event: string, actor?: string | null, metadata?: Record<string, unknown>): void {
    this.db.prepare(
      'INSERT INTO task_events (task_id, event, actor, metadata) VALUES (?, ?, ?, ?)'
    ).run(taskId, event, actor ?? null, metadata ? JSON.stringify(metadata) : '{}');
  }

  getTaskEvents(taskId: string): TaskEventRecord[] {
    return this.db.prepare(
      'SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC'
    ).all(taskId) as TaskEventRecord[];
  }

  // ---- Evaluation Reports ----

  createEvaluationReport(params: CreateEvaluationReportParams): EvaluationReportRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO evaluation_reports (id, task_id, agent_id, workspace, claimed_subtasks, approach, complexity, dependencies, raw_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.taskId, params.agentId, params.workspace,
      JSON.stringify(params.claimedSubtasks), params.approach, params.complexity,
      JSON.stringify(params.dependencies), params.rawResponse);

    this.insertEvent(params.taskId, 'evaluation_submitted', params.agentId, { reportId: id });

    return this.getEvaluationReport(id)!;
  }

  getEvaluationReport(reportId: string): EvaluationReportRecord | undefined {
    return this.db.prepare('SELECT * FROM evaluation_reports WHERE id = ?').get(reportId) as EvaluationReportRecord | undefined;
  }

  listEvaluationReports(taskId: string): EvaluationReportRecord[] {
    return this.db.prepare('SELECT * FROM evaluation_reports WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as EvaluationReportRecord[];
  }

  updateReportStatus(reportId: string, status: 'approved' | 'rejected', comment?: string): EvaluationReportRecord | null {
    const report = this.getEvaluationReport(reportId);
    if (!report) return null;

    this.db.prepare('UPDATE evaluation_reports SET status = ?, review_comment = ?, updated_at = ? WHERE id = ?')
      .run(status, comment ?? null, new Date().toISOString(), reportId);

    this.insertEvent(report.task_id, `evaluation_${status}`, undefined, { reportId });

    return this.getEvaluationReport(reportId)!;
  }

  // ---- Task Assignments ----

  createAssignments(taskId: string, assignments: CreateAssignmentParams[]): TaskAssignmentRecord[] {
    const created: TaskAssignmentRecord[] = [];
    const insert = this.db.prepare(`
      INSERT INTO task_assignments (id, task_id, agent_id, workspace, subtask_ids, instructions, report_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const run = this.db.transaction(() => {
      for (const a of assignments) {
        const id = crypto.randomUUID();
        insert.run(id, taskId, a.agentId, a.workspace,
          JSON.stringify(a.subtaskIds), a.instructions ?? null, a.reportId ?? null);
        created.push(this.getAssignment(id)!);
      }
    });

    run();
    this.insertEvent(taskId, 'dispatched', undefined, { assignmentCount: assignments.length });

    return created;
  }

  getAssignment(assignmentId: string): TaskAssignmentRecord | undefined {
    return this.db.prepare('SELECT * FROM task_assignments WHERE id = ?').get(assignmentId) as TaskAssignmentRecord | undefined;
  }

  getAssignments(taskId: string): TaskAssignmentRecord[] {
    return this.db.prepare('SELECT * FROM task_assignments WHERE task_id = ?').all(taskId) as TaskAssignmentRecord[];
  }

  getAgentAssignments(agentId: string): TaskAssignmentRecord[] {
    return this.db.prepare("SELECT * FROM task_assignments WHERE agent_id = ? AND status IN ('assigned', 'running')").all(agentId) as TaskAssignmentRecord[];
  }

  updateAssignmentStatus(assignmentId: string, status: 'assigned' | 'running' | 'completed' | 'failed'): void {
    this.db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(status, assignmentId);
  }

  // ---- Legacy: claim-based task assignment ----

  claimTask(taskId: string, agentId: string, maxConcurrent: number): TaskRecord | null {
    const runningCount = (this.db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status IN ('dispatched', 'running')"
    ).get(agentId) as { c: number }).c;

    if (runningCount >= maxConcurrent) return null;

    const claim = this.db.transaction(() => {
      const task = this.getTask(taskId);
      if (!task || (task.status !== 'queued' && task.status !== 'evaluating')) return null;

      this.db.prepare('UPDATE tasks SET assigned_to = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(agentId, 'dispatched', new Date().toISOString(), taskId);
      this.insertEvent(taskId, 'claimed', agentId);

      return this.getTask(taskId)!;
    });

    return claim();
  }

  // ---- Stats ----

  getStats(roomId?: string): { total: number; evaluating: number; running: number; completed: number; failed: number } {
    const base = roomId ? `WHERE room_id = ?` : '';
    const args = roomId ? [roomId] : [];
    const count = (status: string) => {
      const row = this.db.prepare(`SELECT COUNT(*) as c FROM tasks ${base} AND status = ?`).get(...args, status) as { c: number };
      return row.c;
    };
    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM tasks ${base || ''}`).get(...args) as { c: number }).c;
    return { total, evaluating: count('evaluating'), running: count('running'), completed: count('completed'), failed: count('failed') };
  }

  close(): void {
    this.db.close();
  }
}
