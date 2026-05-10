import { Router } from 'express';
import type { Request, Response } from 'express';
import type { RoomDB } from '../db-rooms.js';
import type { TaskDB } from '../db-tasks.js';
import { decrypt, encrypt } from '../crypto.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export function createHubApiRouter(roomDB: RoomDB, taskDB: TaskDB, psk: string): Router {
  const router = Router();

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
      const room = roomDB.createRoom({
        name: data.name,
        description: data.description,
        ownerId: data.ownerId || 'sman',
        maxAgents: data.maxAgents,
      });
      res.status(201).json({ payload: encrypt(room, psk) });
      return;
    }
    const rooms = roomDB.listRooms();
    const result = rooms.map(room => ({
      ...room,
      memberCount: roomDB.getMemberCount(room.id),
    }));
    res.json({ payload: encrypt(result, psk) });
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
    const { clientId, displayName } = data;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const member = roomDB.joinRoom({ roomId, clientId, displayName: displayName || clientId });
    if (!member) {
      res.status(409).json({ error: 'Cannot join room' });
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

  return router;
}
