import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { TaskRecord, TaskEventRecord, TaskStatus } from './types.js';

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ['dispatched', 'cancelled'],
  dispatched: ['running', 'cancelled', 'failed'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['queued'],
  cancelled: [],
};

export interface CreateTaskParams {
  roomId: string;
  title: string;
  description?: string;
  createdBy: string;
  priority?: number;
  context?: Record<string, unknown>;
}

export class TaskDB {
  private db: Database.Database;
  private roomsWithQueued = new Set<string>();

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
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK(status IN ('queued','dispatched','running','completed','failed','cancelled')),
        priority INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        context TEXT DEFAULT '{}',
        result TEXT,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
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

      CREATE INDEX IF NOT EXISTS idx_tasks_room_status ON tasks(room_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, status);
      CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
    `);
  }

  createTask(params: CreateTaskParams): TaskRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const context = params.context ? JSON.stringify(params.context) : '{}';

    this.db.prepare(`
      INSERT INTO tasks (id, room_id, title, description, priority, created_by, context)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.roomId, params.title, params.description ?? null, params.priority ?? 0, params.createdBy, context);

    this.insertEvent(id, 'created', params.createdBy, { title: params.title });
    this.roomsWithQueued.add(params.roomId);

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

  getQueuedTasks(roomId: string): TaskRecord[] {
    return this.db.prepare(
      "SELECT * FROM tasks WHERE room_id = ? AND status = 'queued' ORDER BY priority DESC, created_at ASC"
    ).all(roomId) as TaskRecord[];
  }

  hasQueuedTasks(roomId: string): boolean {
    if (!this.roomsWithQueued.has(roomId)) return false;
    const row = this.db.prepare(
      "SELECT 1 FROM tasks WHERE room_id = ? AND status = 'queued' LIMIT 1"
    ).get(roomId);
    if (!row) {
      this.roomsWithQueued.delete(roomId);
      return false;
    }
    return true;
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
      dispatched: 'claimed',
      running: 'started',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
      queued: 'retried',
    };
    this.insertEvent(taskId, eventMap[newStatus] || newStatus, actor, metadata);

    if (newStatus === 'queued') {
      this.roomsWithQueued.add(task.room_id);
    }

    return this.getTask(taskId)!;
  }

  assignTask(taskId: string, agentId: string): TaskRecord | null {
    this.db.prepare('UPDATE tasks SET assigned_to = ?, updated_at = ? WHERE id = ?')
      .run(agentId, new Date().toISOString(), taskId);
    return this.getTask(taskId) ?? null;
  }

  claimTask(taskId: string, agentId: string, maxConcurrent: number): TaskRecord | null {
    const runningCount = (this.db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status IN ('dispatched', 'running')"
    ).get(agentId) as { c: number }).c;

    if (runningCount >= maxConcurrent) return null;

    const claim = this.db.transaction(() => {
      const task = this.getTask(taskId);
      if (!task || task.status !== 'queued') return null;

      this.db.prepare('UPDATE tasks SET assigned_to = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(agentId, 'dispatched', new Date().toISOString(), taskId);
      this.insertEvent(taskId, 'claimed', agentId);

      const updated = this.getTask(taskId)!;
      const remaining = this.db.prepare("SELECT 1 FROM tasks WHERE room_id = ? AND status = 'queued' LIMIT 1").get(task.room_id);
      if (!remaining) this.roomsWithQueued.delete(task.room_id);

      return updated;
    });

    return claim();
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

  getStats(roomId?: string): { total: number; queued: number; running: number; completed: number; failed: number } {
    const base = roomId ? `WHERE room_id = ?` : '';
    const args = roomId ? [roomId] : [];
    const count = (status: string) => {
      const row = this.db.prepare(`SELECT COUNT(*) as c FROM tasks ${base} AND status = ?`).get(...args, status) as { c: number };
      return row.c;
    };
    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM tasks ${base || ''}`).get(...args) as { c: number }).c;
    return { total, queued: count('queued'), running: count('running'), completed: count('completed'), failed: count('failed') };
  }

  close(): void {
    this.db.close();
  }
}
