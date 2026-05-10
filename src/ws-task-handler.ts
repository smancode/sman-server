import type { WebSocket } from 'ws';
import type { WsHub } from './ws-server.js';
import type { TaskEngine } from './task-engine.js';
import type { WsMessage, TaskStatus } from './types.js';

interface AuthedClient {
  ws: WebSocket;
  clientId: string;
  subscribedRooms: Set<string>;
}

export function createTaskHandler(engine: TaskEngine, wsHub: WsHub) {
  return {
    handle(client: AuthedClient, msg: WsMessage): boolean {
      // Task messages
      if (msg.type.startsWith('task.')) {
        switch (msg.type) {
          case 'task.create': this.handleCreate(client, msg); return true;
          case 'task.claim': this.handleClaim(client, msg); return true;
          case 'task.start': this.handleStart(client, msg); return true;
          case 'task.progress': this.handleProgress(client, msg); return true;
          case 'task.complete': this.handleComplete(client, msg); return true;
          case 'task.fail': this.handleFail(client, msg); return true;
          case 'task.cancel': this.handleCancel(client, msg); return true;
          case 'task.list': this.handleList(client, msg); return true;
          case 'task.detail': this.handleDetail(client, msg); return true;
          case 'task.confirm': this.handleConfirm(client, msg); return true;
          case 'task.reject': this.handleReject(client, msg); return true;
          case 'task.dispatch': this.handleDispatch(client, msg); return true;
          default: return false;
        }
      }
      // Evaluation messages
      if (msg.type.startsWith('evaluation.')) {
        switch (msg.type) {
          case 'evaluation.submit': this.handleEvaluationSubmit(client, msg); return true;
          case 'evaluation.list': this.handleEvaluationList(client, msg); return true;
          case 'evaluation.approve': this.handleEvaluationApprove(client, msg); return true;
          case 'evaluation.reject': this.handleEvaluationReject(client, msg); return true;
          default: return false;
        }
      }
      return false;
    },

    // ---- Task CRUD ----

    handleCreate(client: AuthedClient, msg: WsMessage): void {
      const roomId = msg.roomId as string;
      const title = msg.title as string;
      if (!roomId || !title) {
        send(client.ws, { type: 'task.error', reason: 'roomId and title are required' });
        return;
      }

      try {
        const subtasksRaw = msg.subtasks;
        const subtasks = Array.isArray(subtasksRaw) ? subtasksRaw : undefined;

        const task = engine.createTask({
          roomId,
          title,
          description: msg.description as string | undefined,
          createdBy: client.clientId,
          priority: msg.priority as number | undefined,
          context: msg.context as Record<string, unknown> | undefined,
          acceptanceCriteria: msg.acceptanceCriteria as string | undefined,
          subtasks,
          autoExecute: msg.autoExecute as boolean | undefined,
          gitBranch: msg.gitBranch as string | undefined,
        });

        send(client.ws, { type: 'task.created', task });
        wsHub.broadcastToRoom(roomId, { type: 'task.created', task });
      } catch (err) {
        send(client.ws, { type: 'task.error', reason: (err as Error).message });
      }
    },

    handleClaim(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const agentId = msg.agentId as string;
      const maxConcurrent = (msg.maxConcurrent as number) || 2;
      if (!taskId || !agentId) {
        send(client.ws, { type: 'task.error', reason: 'taskId and agentId are required' });
        return;
      }

      const task = engine.claimTask(taskId, agentId, maxConcurrent);
      if (!task) {
        send(client.ws, { type: 'task.claim_failed', taskId, reason: 'Cannot claim' });
        return;
      }

      send(client.ws, { type: 'task.claimed', task });
      wsHub.broadcastToRoom(task.room_id, { type: 'task.dispatched', task });
    },

    handleStart(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const agentId = msg.agentId as string;
      const task = engine.startTask(taskId, agentId);
      if (!task) {
        send(client.ws, { type: 'task.error', reason: 'Cannot start task' });
        return;
      }
      send(client.ws, { type: 'task.started', task });
      wsHub.broadcastToRoom(task.room_id, { type: 'task.running', task });
    },

    handleProgress(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const agentId = msg.agentId as string;
      const progress = msg.progress as string;
      engine.reportProgress(taskId, agentId, progress);
      const task = engine.getTask(taskId);
      if (task) {
        wsHub.broadcastToRoom(task.room_id, { type: 'task.progress', taskId, agentId, progress });
      }
    },

    handleComplete(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const agentId = msg.agentId as string;
      const result = (msg.result as string) || '';
      const task = engine.completeTask(taskId, agentId, result);
      if (!task) {
        send(client.ws, { type: 'task.error', reason: 'Cannot complete task' });
        return;
      }
      send(client.ws, { type: 'task.completed', task });
      wsHub.broadcastToRoom(task.room_id, { type: 'task.completed', task });
    },

    handleFail(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const agentId = msg.agentId as string;
      const error = (msg.error as string) || 'Unknown error';
      const task = engine.failTask(taskId, agentId, error);
      if (!task) {
        send(client.ws, { type: 'task.error', reason: 'Cannot fail task' });
        return;
      }
      send(client.ws, { type: 'task.failed', task });
      if (task.status === 'evaluating') {
        wsHub.broadcastToRoom(task.room_id, { type: 'task.retried', task });
      } else {
        wsHub.broadcastToRoom(task.room_id, { type: 'task.failed', task });
      }
    },

    handleCancel(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const task = engine.cancelTask(taskId, client.clientId);
      if (!task) {
        send(client.ws, { type: 'task.error', reason: 'Cannot cancel task' });
        return;
      }
      send(client.ws, { type: 'task.cancelled', task });
      wsHub.broadcastToRoom(task.room_id, { type: 'task.cancelled', task });
    },

    handleList(client: AuthedClient, msg: WsMessage): void {
      const roomId = msg.roomId as string;
      if (!roomId) {
        send(client.ws, { type: 'task.error', reason: 'roomId is required' });
        return;
      }
      const status = msg.status as TaskStatus | undefined;
      const tasks = engine.getRoomTasks(roomId, status);
      send(client.ws, { type: 'task.list.update', roomId, tasks });
    },

    handleDetail(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const detail = engine.getTaskDetail(taskId);
      if (!detail) {
        send(client.ws, { type: 'task.error', reason: 'Task not found' });
        return;
      }
      send(client.ws, {
        type: 'task.detail.update',
        task: detail.task,
        events: detail.events,
        evaluations: detail.evaluations,
        assignments: detail.assignments,
      });
    },

    // ---- New: Task Review & Dispatch ----

    handleConfirm(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      if (!taskId) {
        send(client.ws, { type: 'task.error', reason: 'taskId is required' });
        return;
      }
      const task = engine.confirmTask(taskId, client.clientId);
      if (!task) {
        send(client.ws, { type: 'task.error', reason: 'Cannot confirm task (wrong status or not found)' });
        return;
      }
      send(client.ws, { type: 'task.confirmed', task });
      wsHub.broadcastToRoom(task.room_id, { type: 'task.confirmed', task });
    },

    handleReject(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      if (!taskId) {
        send(client.ws, { type: 'task.error', reason: 'taskId is required' });
        return;
      }
      const task = engine.rejectTask(taskId, client.clientId, msg.reason as string | undefined);
      if (!task) {
        send(client.ws, { type: 'task.error', reason: 'Cannot reject task' });
        return;
      }
      send(client.ws, { type: 'task.rejected', task });
      wsHub.broadcastToRoom(task.room_id, { type: 'task.rejected', task });
    },

    handleDispatch(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const assignments = msg.assignments as Array<{
        agentId: string;
        workspace: string;
        subtaskIds: string[];
        instructions?: string;
        reportId?: string;
      }>;
      if (!taskId || !Array.isArray(assignments) || assignments.length === 0) {
        send(client.ws, { type: 'task.error', reason: 'taskId and assignments[] are required' });
        return;
      }

      const result = engine.dispatchTask(
        taskId,
        assignments.map(a => ({ taskId, ...a })),
        client.clientId,
      );
      if (!result) {
        send(client.ws, { type: 'task.error', reason: 'Cannot dispatch task (must be confirmed first)' });
        return;
      }

      send(client.ws, { type: 'task.dispatched', task: result.task, assignments: result.assignments });
      wsHub.broadcastToRoom(result.task.room_id, { type: 'task.dispatched', task: result.task, assignments: result.assignments });

      // Send individual dispatch messages to each assigned agent's client
      for (const assignment of result.assignments) {
        wsHub.sendToAgent(assignment.agent_id, {
          type: 'task.dispatched_to',
          task: result.task,
          assignment,
        });
      }
    },

    // ---- Evaluation Reports ----

    handleEvaluationSubmit(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const agentId = msg.agentId as string;
      const workspace = msg.workspace as string;
      if (!taskId || !agentId || !workspace) {
        send(client.ws, { type: 'task.error', reason: 'taskId, agentId, workspace are required' });
        return;
      }

      const report = engine.submitEvaluationReport({
        taskId,
        agentId,
        workspace,
        claimedSubtasks: (msg.claimedSubtasks as string[]) || [],
        approach: (msg.approach as string) || '',
        complexity: (msg.complexity as string) || 'medium',
        dependencies: (msg.dependencies as string[]) || [],
        rawResponse: (msg.rawResponse as string) || '',
      });

      send(client.ws, { type: 'evaluation.submitted', report });

      const task = engine.getTask(taskId);
      if (task) {
        wsHub.broadcastToRoom(task.room_id, { type: 'evaluation.submitted', taskId, report });
      }
    },

    handleEvaluationList(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      if (!taskId) {
        send(client.ws, { type: 'task.error', reason: 'taskId is required' });
        return;
      }
      const reports = engine.listEvaluationReports(taskId);
      send(client.ws, { type: 'evaluation.list.update', taskId, reports });
    },

    handleEvaluationApprove(client: AuthedClient, msg: WsMessage): void {
      const reportId = msg.reportId as string;
      if (!reportId) {
        send(client.ws, { type: 'task.error', reason: 'reportId is required' });
        return;
      }
      const report = engine.approveReport(reportId);
      if (!report) {
        send(client.ws, { type: 'task.error', reason: 'Report not found' });
        return;
      }
      send(client.ws, { type: 'evaluation.approved', report });
      const task = engine.getTask(report.task_id);
      if (task) {
        wsHub.broadcastToRoom(task.room_id, { type: 'evaluation.approved', taskId: task.id, report });
      }
    },

    handleEvaluationReject(client: AuthedClient, msg: WsMessage): void {
      const reportId = msg.reportId as string;
      const comment = msg.comment as string | undefined;
      if (!reportId) {
        send(client.ws, { type: 'task.error', reason: 'reportId is required' });
        return;
      }
      const report = engine.rejectReport(reportId, comment);
      if (!report) {
        send(client.ws, { type: 'task.error', reason: 'Report not found' });
        return;
      }
      send(client.ws, { type: 'evaluation.rejected', report });
      const task = engine.getTask(report.task_id);
      if (task) {
        wsHub.broadcastToRoom(task.room_id, { type: 'evaluation.rejected', taskId: task.id, report });
      }
    },
  };
}

function send(ws: WebSocket, msg: WsMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}
