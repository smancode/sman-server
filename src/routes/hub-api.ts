import { Router } from 'express';
import type { Request, Response } from 'express';
import type { RoomDB } from '../db-rooms.js';
import type { TaskDB } from '../db-tasks.js';
import type { TaskEngine } from '../task-engine.js';
import type { HubDB } from '../db.js';
import type { WsHub } from '../ws-server.js';
import { decrypt, encrypt } from '../crypto.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const AUTO_DISPATCH_TIMEOUT_MS = 30_000;

export function createHubApiRouter(roomDB: RoomDB, taskDB: TaskDB, psk: string, taskEngine: TaskEngine | undefined, hubDB: HubDB, wsHub?: WsHub): Router {
  const router = Router();
  const autoDispatchTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleAutoDispatchFallback(taskId: string, roomId: string): void {
    if (!taskEngine || autoDispatchTimers.has(taskId)) return;
    const timer = setTimeout(() => {
      autoDispatchTimers.delete(taskId);
      const result = taskEngine.tryAutoConfirmAndDispatch(taskId, roomDB, true);
      if (result && wsHub) {
        wsHub.broadcastToRoom(roomId, { type: 'task.confirmed', task: result.task });
        wsHub.broadcastToRoom(roomId, { type: 'task.dispatched', task: result.task, assignments: result.assignments });
        for (const assignment of result.assignments) {
          wsHub.sendToAgent(assignment.agent_id, { type: 'task.dispatched_to', task: result.task, assignment });
        }
      }
    }, AUTO_DISPATCH_TIMEOUT_MS);
    autoDispatchTimers.set(taskId, timer);
  }

  function tryAutoDispatch(taskId: string, roomId: string): void {
    if (!taskEngine) return;
    const timer = autoDispatchTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      autoDispatchTimers.delete(taskId);
    }
    const result = taskEngine.tryAutoConfirmAndDispatch(taskId, roomDB);
    if (result && wsHub) {
      wsHub.broadcastToRoom(roomId, { type: 'task.confirmed', task: result.task });
      wsHub.broadcastToRoom(roomId, { type: 'task.dispatched', task: result.task, assignments: result.assignments });
      for (const assignment of result.assignments) {
        wsHub.sendToAgent(assignment.agent_id, { type: 'task.dispatched_to', task: result.task, assignment });
      }
    }
  }

  // PSK auth middleware — all routes carry encrypted payload in body
  router.use((req: Request, res: Response, next) => {
    try {
      const { payload, timestamp, pskVersion } = req.body;
      if (pskVersion !== 1) {
        res.status(400).json({ error: 'Unsupported PSK version' });
        return;
      }
      const now = Date.now();
      if (Math.abs(now - timestamp * 1000) > REPLAY_WINDOW_MS) {
        res.status(400).json({ error: 'Timestamp out of range' });
        return;
      }
      const data = decrypt(payload, psk);
      (req as any)._hubPayload = data;
      next();
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // ---- Rooms ----

  router.post('/rooms', (req: Request, res: Response) => {
    const data = (req as any)._hubPayload;
    if (data?.name) {
      const ownerId = data.ownerId || 'sman';
      const room = roomDB.createRoom({
        name: data.name,
        description: data.description,
        ownerId,
        maxAgents: data.maxAgents,
        visibility: data.visibility || 'private',
        password: data.password || undefined,
      });
      // Auto-add owner as member
      roomDB.joinRoom({ roomId: room.id, clientId: ownerId, displayName: ownerId, role: 'owner' });
      res.status(201).json({ payload: encrypt(room, psk) });
      return;
    }
    const clientId = data?.clientId;
    const search = data?.search as string | undefined;
    const limit = typeof data?.limit === 'number' ? data.limit : 10;
    const offset = typeof data?.offset === 'number' ? data.offset : 0;
    const rooms = clientId
      ? roomDB.listRoomsVisibleTo(clientId, { search, limit, offset })
      : roomDB.listRooms();
    const total = clientId
      ? roomDB.countRoomsVisibleTo(clientId, search)
      : rooms.length;
    const result = rooms.map(room => {
      const { password, ...rest } = room;
      const cidUser = clientId ? clientId.split('@')[0] : '';
      const ownerUser = room.owner_id ? room.owner_id.split('@')[0] : '';
      const isOwner = clientId && (room.owner_id === clientId || (cidUser && ownerUser && cidUser === ownerUser));
      return {
        ...rest,
        memberCount: roomDB.getMemberCount(room.id),
        isMember: clientId ? roomDB.isMember(room.id, clientId) : false,
        hasPassword: !!password,
        ...(isOwner && password ? { password } : {}),
      };
    });
    res.json({ payload: encrypt({ rooms: result, total }, psk) });
  });

  router.post('/rooms/:id', (req: Request<{ id: string }>, res: Response) => {
    const roomId = req.params.id;
    const room = roomDB.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const members = roomDB.getRoomMembers(room.id);
    const agents = roomDB.getRoomAgents(room.id);
    res.json({ payload: encrypt({ room, members, agents }, psk) });
  });

  router.post('/rooms/:id/join', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const roomId = req.params.id;
    const { clientId, displayName, password } = data;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const room = roomDB.getRoom(roomId);
    if (!room || !room.active) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.password && room.password !== password) {
      res.status(403).json({ error: 'Wrong password' });
      return;
    }
    const member = roomDB.joinRoom({ roomId, clientId, displayName: displayName || clientId });
    if (!member) {
      res.status(409).json({ error: 'Room is full' });
      return;
    }
    res.json({ payload: encrypt(member, psk) });
  });

  router.post('/rooms/:id/leave', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const roomId = req.params.id;
    const { clientId } = data;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const left = roomDB.leaveRoom(roomId, clientId);
    res.json({ payload: encrypt({ ok: left }, psk) });
  });

  router.post('/rooms/:id/agents', (req: Request<{ id: string }>, res: Response) => {
    const roomId = req.params.id;
    const agents = roomDB.getRoomAgents(roomId);
    res.json({ payload: encrypt(agents, psk) });
  });

  router.post('/rooms/:id/dissolve', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const roomId = req.params.id;
    const clientId = data?.clientId;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const room = roomDB.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.owner_id !== clientId) {
      res.status(403).json({ error: 'Only owner can dissolve room' });
      return;
    }
    // Check for active tasks
    if (taskEngine) {
      for (const status of ['dispatched', 'running', 'stopping'] as const) {
        const tasks = taskEngine.getRoomTasks(roomId, status);
        if (tasks.length > 0) {
          res.status(409).json({ error: 'Cannot dissolve: room has active tasks. Stop them first.' });
          return;
        }
      }
    }
    roomDB.deactivateRoom(roomId);
    res.json({ payload: encrypt({ ok: true, roomId }, psk) });
  });

  // ---- Agents ----

  router.post('/agents', (_req: Request, res: Response) => {
    const rooms = roomDB.listRooms();
    const allAgents = rooms.flatMap(room => roomDB.getRoomAgents(room.id));
    res.json({ payload: encrypt(allAgents, psk) });
  });

  // ---- Tasks ----

  router.post('/tasks', (req: Request, res: Response) => {
    const data = (req as any)._hubPayload;
    if (data?.title) {
      if (!data.roomId) {
        res.status(400).json({ error: 'roomId is required' });
        return;
      }
      const task = taskDB.createTask({
        roomId: data.roomId,
        title: data.title,
        description: data.description || '',
        priority: data.priority || 0,
        context: data.context,
        createdBy: data.createdBy || 'sman',
        acceptanceCriteria: data.acceptanceCriteria,
        subtasks: data.subtasks,
        autoExecute: data.autoExecute,
        gitBranch: data.gitBranch,
      });
      res.status(201).json({ payload: encrypt(task, psk) });
      // Schedule auto-dispatch fallback for auto_execute tasks
      if (task.auto_execute === 1) {
        scheduleAutoDispatchFallback(task.id, task.room_id);
      }
      return;
    }
    const roomId = data?.roomId;
    if (!roomId) {
      res.status(400).json({ error: 'roomId is required' });
      return;
    }
    const tasks = taskDB.listRoomTasks(roomId);
    res.json({ payload: encrypt(tasks, psk) });
  });

  router.post('/tasks/:id', (req: Request<{ id: string }>, res: Response) => {
    const taskId = req.params.id;
    const task = taskDB.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const events = taskDB.getTaskEvents(task.id);
    const evaluations = taskDB.listEvaluationReports(task.id);
    const assignments = taskDB.getAssignments(task.id);
    res.json({ payload: encrypt({ task, events, evaluations, assignments }, psk) });
  });

  router.post('/tasks/:id/cancel', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const taskId = req.params.id;
    const task = taskDB.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    taskDB.transitionStatus(taskId, 'cancelled', data?.cancelledBy);
    res.json({ payload: encrypt({ ok: true }, psk) });
  });

  // Stop task (notifies assigned agents)
  router.post('/tasks/:id/stop', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const taskId = req.params.id;
    if (!taskEngine) {
      res.status(500).json({ error: 'Task engine not available' });
      return;
    }
    const task = taskEngine.stopTask(taskId, data?.actor);
    if (!task) {
      res.status(409).json({ error: 'Cannot stop task (must be dispatched or running)' });
      return;
    }
    res.json({ payload: encrypt(task, psk) });
  });

  // Confirm task
  router.post('/tasks/:id/confirm', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const taskId = req.params.id;
    const task = taskDB.transitionStatus(taskId, 'confirmed', data?.actor);
    if (!task) {
      res.status(409).json({ error: 'Cannot confirm task (wrong status or not found)' });
      return;
    }
    res.json({ payload: encrypt(task, psk) });
  });

  // Reject task
  router.post('/tasks/:id/reject', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const taskId = req.params.id;
    const task = taskDB.transitionStatus(taskId, 'rejected', data?.actor, { reason: data?.reason });
    if (!task) {
      res.status(409).json({ error: 'Cannot reject task' });
      return;
    }
    res.json({ payload: encrypt(task, psk) });
  });

  // Dispatch task
  router.post('/tasks/:id/dispatch', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const taskId = req.params.id;
    const assignments = data?.assignments;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      res.status(400).json({ error: 'assignments[] is required' });
      return;
    }

    const task = taskDB.getTask(taskId);
    if (!task || task.status !== 'confirmed') {
      res.status(409).json({ error: 'Task must be confirmed before dispatch' });
      return;
    }

    const created = taskDB.createAssignments(taskId, assignments);
    if (created.length > 0) {
      taskDB.assignTask(taskId, created[0].agent_id);
    }
    const updated = taskDB.transitionStatus(taskId, 'dispatched', data?.actor, {
      assignmentCount: created.length,
      agents: assignments.map((a: any) => a.agentId),
    });

    if (!updated) {
      res.status(500).json({ error: 'Dispatch failed' });
      return;
    }
    res.json({ payload: encrypt({ task: updated, assignments: created }, psk) });
  });

  // ---- Evaluation Reports ----

  // List evaluation reports for a task
  router.post('/evaluations', (req: Request, res: Response) => {
    const data = (req as any)._hubPayload;
    const taskId = data?.taskId;
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    const reports = taskDB.listEvaluationReports(taskId);
    res.json({ payload: encrypt(reports, psk) });
  });

  // Submit evaluation report
  router.post('/evaluations/submit', (req: Request, res: Response) => {
    const data = (req as any)._hubPayload;
    const { taskId, agentId, workspace } = data || {};
    if (!taskId || !agentId || !workspace) {
      res.status(400).json({ error: 'taskId, agentId, workspace are required' });
      return;
    }

    const report = taskDB.createEvaluationReport({
      taskId,
      agentId,
      workspace,
      claimedSubtasks: data.claimedSubtasks || [],
      approach: data.approach || '',
      complexity: data.complexity || 'medium',
      dependencies: data.dependencies || [],
      rawResponse: data.rawResponse || '',
    });
    res.status(201).json({ payload: encrypt(report, psk) });

    // Auto-confirm + auto-dispatch if all evaluations received
    const task = taskDB.getTask(taskId);
    if (task) {
      tryAutoDispatch(taskId, task.room_id);
    }
  });

  // Approve evaluation report
  router.post('/evaluations/:id/approve', (req: Request<{ id: string }>, res: Response) => {
    const reportId = req.params.id;
    const report = taskDB.updateReportStatus(reportId, 'approved');
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ payload: encrypt(report, psk) });
  });

  // Reject evaluation report
  router.post('/evaluations/:id/reject', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const reportId = req.params.id;
    const report = taskDB.updateReportStatus(reportId, 'rejected', data?.comment);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ payload: encrypt(report, psk) });
  });

  // Stardom dev-mode (read-only for clients)
  router.post('/stardom-dev-mode', (_req: Request, res: Response) => {
    const val = hubDB.getSetting('stardom_dev_mode');
    res.json({ payload: encrypt({ enabled: val === '1' }, psk) });
  });

  // Hub dev-mode (read-only for clients)
  router.post('/hub-dev-mode', (_req: Request, res: Response) => {
    const val = hubDB.getSetting('hub_dev_mode');
    res.json({ payload: encrypt({ enabled: val === '1' }, psk) });
  });

  return router;
}
