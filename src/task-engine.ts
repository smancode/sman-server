import { TaskDB } from './db-tasks.js';
import type { CreateEvaluationReportParams, CreateAssignmentParams } from './db-tasks.js';
import type { TaskRecord, TaskStatus, EvaluationReportRecord, TaskAssignmentRecord } from './types.js';
import type { RoomDB } from './db-rooms.js';

const INFRA_ERROR_PATTERNS = ['runtime_offline', 'runtime_recovery', 'timeout', 'ECONNRESET', 'ETIMEDOUT', 'socket hang up'];
const DEFAULT_MAX_RETRIES = 3;

export class TaskEngine {
  private taskDB: TaskDB;

  constructor(taskDB: TaskDB) {
    this.taskDB = taskDB;
  }

  // ---- Task CRUD ----

  createTask(params: {
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
  }): TaskRecord {
    return this.taskDB.createTask(params);
  }

  cancelTask(taskId: string, cancelledBy: string): TaskRecord | null {
    const task = this.taskDB.getTask(taskId);
    if (!task) return null;
    if (task.status === 'completed' || task.status === 'cancelled') return null;
    return this.taskDB.transitionStatus(taskId, 'cancelled', cancelledBy, { reason: 'user_cancel' });
  }

  stopTask(taskId: string, actor: string): TaskRecord | null {
    const task = this.taskDB.getTask(taskId);
    if (!task) return null;
    if (task.status !== 'dispatched' && task.status !== 'running') return null;
    return this.taskDB.transitionStatus(taskId, 'stopping', actor);
  }

  // ---- Status Transitions ----

  rejectTask(taskId: string, actor: string, reason?: string): TaskRecord | null {
    return this.taskDB.transitionStatus(taskId, 'rejected', actor, { reason });
  }

  confirmTask(taskId: string, actor: string): TaskRecord | null {
    return this.taskDB.transitionStatus(taskId, 'confirmed', actor);
  }

  // ---- Legacy: direct claim/start/complete ----

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
    if (!task) return null;
    // Allow any assigned agent to fail when stopping
    if (task.status !== 'stopping' && task.assigned_to !== agentId) return null;

    this.taskDB.setError(taskId, error);

    if (this.isInfraError(error) && task.retry_count < (task.max_retries || DEFAULT_MAX_RETRIES)) {
      const retryCount = this.taskDB.incrementRetry(taskId);
      const retried = this.taskDB.transitionStatus(taskId, 'failed', agentId, { error, autoRetry: true });
      if (retried) {
        this.taskDB.transitionStatus(taskId, 'evaluating', undefined, { retryCount });
        return this.taskDB.getTask(taskId) ?? null;
      }
    }

    return this.taskDB.transitionStatus(taskId, 'failed', agentId, { error });
  }

  // ---- Evaluation Reports ----

  submitEvaluationReport(params: CreateEvaluationReportParams): EvaluationReportRecord {
    return this.taskDB.createEvaluationReport(params);
  }

  listEvaluationReports(taskId: string): EvaluationReportRecord[] {
    return this.taskDB.listEvaluationReports(taskId);
  }

  approveReport(reportId: string): EvaluationReportRecord | null {
    return this.taskDB.updateReportStatus(reportId, 'approved');
  }

  rejectReport(reportId: string, comment?: string): EvaluationReportRecord | null {
    return this.taskDB.updateReportStatus(reportId, 'rejected', comment);
  }

  // ---- Dispatch (publisher assigns work) ----

  dispatchTask(taskId: string, assignments: CreateAssignmentParams[], actor: string): { task: TaskRecord; assignments: TaskAssignmentRecord[] } | null {
    const task = this.taskDB.getTask(taskId);
    if (!task || task.status !== 'confirmed') return null;

    const created = this.taskDB.createAssignments(taskId, assignments);

    // Assign first agent as primary assignee
    if (created.length > 0) {
      this.taskDB.assignTask(taskId, created[0].agent_id);
    }

    const updated = this.taskDB.transitionStatus(taskId, 'dispatched', actor, {
      assignmentCount: created.length,
      agents: assignments.map(a => a.agentId),
    });

    return updated ? { task: updated, assignments: created } : null;
  }

  getAssignments(taskId: string): TaskAssignmentRecord[] {
    return this.taskDB.getAssignments(taskId);
  }

  getAgentAssignments(agentId: string): TaskAssignmentRecord[] {
    return this.taskDB.getAgentAssignments(agentId);
  }

  updateAssignmentStatus(assignmentId: string, status: 'assigned' | 'running' | 'completed' | 'failed'): void {
    this.taskDB.updateAssignmentStatus(assignmentId, status);
  }

  // ---- Queries ----

  getRoomTasks(roomId: string, status?: TaskStatus): TaskRecord[] {
    return this.taskDB.listRoomTasks(roomId, status);
  }

  getTaskDetail(taskId: string): { task: TaskRecord; events: import('./types.js').TaskEventRecord[]; evaluations: EvaluationReportRecord[]; assignments: TaskAssignmentRecord[] } | null {
    const task = this.taskDB.getTask(taskId);
    if (!task) return null;
    const events = this.taskDB.getTaskEvents(taskId);
    const evaluations = this.taskDB.listEvaluationReports(taskId);
    const assignments = this.taskDB.getAssignments(taskId);
    return { task, events, evaluations, assignments };
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.taskDB.getTask(taskId);
  }

  private isInfraError(error: string): boolean {
    const lower = error.toLowerCase();
    return INFRA_ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase()));
  }

  // ---- Auto-confirm & Auto-dispatch ----

  tryAutoConfirmAndDispatch(taskId: string, roomDB: RoomDB, force?: boolean): { task: TaskRecord; assignments: TaskAssignmentRecord[] } | null {
    const task = this.taskDB.getTask(taskId);
    if (!task || task.auto_execute !== 1) return null;
    if (task.status !== 'evaluating') return null;

    const agents = roomDB.getRoomAgents(task.room_id);
    const reports = this.taskDB.listEvaluationReports(taskId);

    // Check if all agents have submitted (or force for timeout fallback)
    if (!force) {
      const uniqueReporters = new Set(reports.map(r => r.agent_id));
      if (uniqueReporters.size < agents.length) return null;
    }

    // Need at least one evaluation to proceed
    if (reports.length === 0) return null;

    // Parse subtasks
    let subtaskIds: string[] = [];
    try {
      const parsed = JSON.parse(task.subtasks || '[]');
      if (Array.isArray(parsed)) subtaskIds = parsed.map((st: { id: string }) => st.id);
    } catch { /* no subtasks */ }

    // Build assignments: map each subtask to the first agent that claimed it
    const subtaskToAgent = new Map<string, { agentId: string; workspace: string; reportId: string }>();

    if (subtaskIds.length > 0) {
      for (const stId of subtaskIds) {
        for (const report of reports) {
          try {
            const claimed: string[] = JSON.parse(report.claimed_subtasks);
            if (claimed.includes(stId)) {
              subtaskToAgent.set(stId, { agentId: report.agent_id, workspace: report.workspace, reportId: report.id });
              break;
            }
          } catch { /* skip */ }
        }
      }
    }

    // Group by agent
    const agentMap = new Map<string, { subtaskIds: string[]; workspace: string; reportId: string }>();
    for (const [stId, info] of subtaskToAgent) {
      if (!agentMap.has(info.agentId)) {
        agentMap.set(info.agentId, { subtaskIds: [], workspace: info.workspace, reportId: info.reportId });
      }
      agentMap.get(info.agentId)!.subtaskIds.push(stId);
    }

    // No subtasks: assign whole task to first reporter
    if (subtaskIds.length === 0 && reports.length > 0) {
      const first = reports[0];
      agentMap.set(first.agent_id, { subtaskIds: [], workspace: first.workspace, reportId: first.id });
    }

    if (agentMap.size === 0) return null;

    // Confirm
    const confirmed = this.taskDB.transitionStatus(taskId, 'confirmed', 'auto');
    if (!confirmed) return null;

    // Dispatch
    const assignmentParams: CreateAssignmentParams[] = Array.from(agentMap.entries()).map(([agentId, data]) => ({
      taskId,
      agentId,
      workspace: data.workspace,
      subtaskIds: data.subtaskIds,
      reportId: data.reportId,
    }));

    return this.dispatchTask(taskId, assignmentParams, 'auto');
  }
}
