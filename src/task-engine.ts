import { TaskDB } from './db-tasks.js';
import type { TaskRecord, TaskStatus } from './types.js';

const INFRA_ERROR_PATTERNS = ['runtime_offline', 'runtime_recovery', 'timeout', 'ECONNRESET', 'ETIMEDOUT', 'socket hang up'];
const DEFAULT_MAX_RETRIES = 3;
const MAX_ORIGIN_CHAIN_DEPTH = 5;

export class TaskEngine {
  private taskDB: TaskDB;

  constructor(taskDB: TaskDB) {
    this.taskDB = taskDB;
  }

  createTask(params: {
    roomId: string;
    title: string;
    description?: string;
    createdBy: string;
    priority?: number;
    context?: Record<string, unknown>;
  }): TaskRecord {
    const ctx = params.context ?? {};
    if (ctx.originChain) {
      const chain = ctx.originChain as string[];
      if (chain.length >= MAX_ORIGIN_CHAIN_DEPTH) {
        throw new Error(`Task origin chain too deep (max ${MAX_ORIGIN_CHAIN_DEPTH})`);
      }
    }
    return this.taskDB.createTask(params);
  }

  claimTask(taskId: string, agentId: string, maxConcurrent: number): TaskRecord | null {
    return this.taskDB.claimTask(taskId, agentId, maxConcurrent);
  }

  startTask(taskId: string, agentId: string): TaskRecord | null {
    const task = this.taskDB.getTask(taskId);
    if (!task || task.assigned_to !== agentId) return null;
    return this.taskDB.transitionStatus(taskId, 'running', agentId);
  }

  reportProgress(taskId: string, agentId: string, progress: string): void {
    const task = this.taskDB.getTask(taskId);
    if (!task || task.assigned_to !== agentId) return;
    this.taskDB.insertEvent(taskId, 'progress', agentId, { progress });
  }

  completeTask(taskId: string, agentId: string, result: string): TaskRecord | null {
    const task = this.taskDB.getTask(taskId);
    if (!task || task.assigned_to !== agentId) return null;

    this.taskDB.setResult(taskId, result);
    return this.taskDB.transitionStatus(taskId, 'completed', agentId, { result });
  }

  failTask(taskId: string, agentId: string, error: string): TaskRecord | null {
    const task = this.taskDB.getTask(taskId);
    if (!task || task.assigned_to !== agentId) return null;

    this.taskDB.setError(taskId, error);

    if (this.isInfraError(error) && task.retry_count < (task.max_retries || DEFAULT_MAX_RETRIES)) {
      const retryCount = this.taskDB.incrementRetry(taskId);
      const retried = this.taskDB.transitionStatus(taskId, 'failed', agentId, { error, autoRetry: true });
      if (retried) {
        this.taskDB.transitionStatus(taskId, 'queued', undefined, { retryCount });
        return this.taskDB.getTask(taskId) ?? null;
      }
    }

    return this.taskDB.transitionStatus(taskId, 'failed', agentId, { error });
  }

  cancelTask(taskId: string, cancelledBy: string): TaskRecord | null {
    const task = this.taskDB.getTask(taskId);
    if (!task) return null;
    if (task.status === 'completed' || task.status === 'cancelled') return null;

    return this.taskDB.transitionStatus(taskId, 'cancelled', cancelledBy, { reason: 'user_cancel' });
  }

  getResumableTasks(agentId: string): TaskRecord[] {
    const dispatched = this.taskDB.listRoomTasks('', 'dispatched').filter(t => t.assigned_to === agentId);
    const running = this.taskDB.listRoomTasks('', 'running').filter(t => t.assigned_to === agentId);
    return [...dispatched, ...running];
  }

  getRoomTasks(roomId: string, status?: TaskStatus): TaskRecord[] {
    return this.taskDB.listRoomTasks(roomId, status);
  }

  getTaskDetail(taskId: string): { task: TaskRecord; events: import('./types.js').TaskEventRecord[] } | null {
    const task = this.taskDB.getTask(taskId);
    if (!task) return null;
    const events = this.taskDB.getTaskEvents(taskId);
    return { task, events };
  }

  private isInfraError(error: string): boolean {
    const lower = error.toLowerCase();
    return INFRA_ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase()));
  }
}
