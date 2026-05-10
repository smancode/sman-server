import type { WebSocket } from 'ws';
import type { WsHub } from './ws-server.js';
import type { TaskEngine } from './task-engine.js';
import type { WsMessage } from './types.js';

interface AuthedClient {
  ws: WebSocket;
  clientId: string;
  subscribedRooms: Set<string>;
}

export function createTaskHandler(engine: TaskEngine, wsHub: WsHub) {
  return {
    handle(client: AuthedClient, msg: WsMessage): boolean {
      switch (msg.type) {
        case 'task.create':
          this.handleCreate(client, msg);
          return true;
        case 'task.claim':
          this.handleClaim(client, msg);
          return true;
        case 'task.start':
          this.handleStart(client, msg);
          return true;
        case 'task.progress':
          this.handleProgress(client, msg);
          return true;
        case 'task.complete':
          this.handleComplete(client, msg);
          return true;
        case 'task.fail':
          this.handleFail(client, msg);
          return true;
        case 'task.cancel':
          this.handleCancel(client, msg);
          return true;
        case 'task.list':
          this.handleList(client, msg);
          return true;
        case 'task.detail':
          this.handleDetail(client, msg);
          return true;
        default:
          return false;
      }
    },

    handleCreate(client: AuthedClient, msg: WsMessage): void {
      const roomId = msg.roomId as string;
      const title = msg.title as string;
      if (!roomId || !title) {
        send(client.ws, { type: 'task.error', reason: 'roomId and title are required' });
        return;
      }

      try {
        const task = engine.createTask({
          roomId,
          title,
          description: msg.description as string | undefined,
          createdBy: client.clientId,
          priority: msg.priority as number | undefined,
          context: msg.context as Record<string, unknown> | undefined,
        });

        send(client.ws, { type: 'task.created', task });
        wsHub.broadcastToRoom(roomId, { type: 'task.queued', task });
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
        send(client.ws, { type: 'task.claim_failed', taskId, reason: 'Cannot claim (not queued, max concurrent reached, or race condition)' });
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
      const task = engine.getTaskDetail(taskId);
      if (task) {
        wsHub.broadcastToRoom(task.task.room_id, { type: 'task.progress', taskId, agentId, progress });
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

      if (task.status === 'queued') {
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
      const status = msg.status as string | undefined;
      const tasks = engine.getRoomTasks(roomId, status as 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled' | undefined);
      send(client.ws, { type: 'task.list.update', roomId, tasks });
    },

    handleDetail(client: AuthedClient, msg: WsMessage): void {
      const taskId = msg.taskId as string;
      const detail = engine.getTaskDetail(taskId);
      if (!detail) {
        send(client.ws, { type: 'task.error', reason: 'Task not found' });
        return;
      }
      send(client.ws, { type: 'task.detail.update', task: detail.task, events: detail.events });
    },
  };
}

function send(ws: WebSocket, msg: WsMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}
