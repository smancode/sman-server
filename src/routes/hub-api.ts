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

  // List rooms (no name in payload) or create room (name in payload)
  router.post('/rooms', (req: Request, res: Response) => {
    const data = (req as any)._hubPayload;
    if (data?.name) {
      const room = roomDB.createRoom({
        name: data.name,
        description: data.description,
        ownerId: data.ownerId || 'sman',
        maxAgents: data.maxAgents,
      });
      res.status(201).json(encrypt(room, psk));
      return;
    }
    const rooms = roomDB.listRooms();
    const result = rooms.map(room => ({
      ...room,
      memberCount: roomDB.getMemberCount(room.id),
    }));
    res.json(encrypt(result, psk));
  });

  // Get room detail
  router.post('/rooms/:id', (req: Request<{ id: string }>, res: Response) => {
    const roomId = req.params.id;
    const room = roomDB.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const members = roomDB.getRoomMembers(room.id);
    const agents = roomDB.getRoomAgents(room.id);
    res.json(encrypt({ room, members, agents }, psk));
  });

  // Join room
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
    res.json(encrypt(member, psk));
  });

  // Leave room
  router.post('/rooms/:id/leave', (req: Request<{ id: string }>, res: Response) => {
    const data = (req as any)._hubPayload;
    const roomId = req.params.id;
    const { clientId } = data;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const left = roomDB.leaveRoom(roomId, clientId);
    res.json(encrypt({ ok: left }, psk));
  });

  // ---- Agents ----

  router.post('/agents', (_req: Request, res: Response) => {
    const rooms = roomDB.listRooms();
    const allAgents = rooms.flatMap(room => roomDB.getRoomAgents(room.id));
    res.json(encrypt(allAgents, psk));
  });

  // ---- Tasks ----

  // List tasks (roomId in payload, no title) or create task (title in payload)
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
        createdBy: 'sman',
      });
      res.status(201).json(encrypt(task, psk));
      return;
    }
    const roomId = data?.roomId;
    if (!roomId) {
      res.status(400).json({ error: 'roomId is required' });
      return;
    }
    const tasks = taskDB.listRoomTasks(roomId);
    res.json(encrypt(tasks, psk));
  });

  // Get task detail
  router.post('/tasks/:id', (req: Request<{ id: string }>, res: Response) => {
    const taskId = req.params.id;
    const task = taskDB.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const events = taskDB.getTaskEvents(task.id);
    res.json(encrypt({ task, events }, psk));
  });

  // Cancel task
  router.post('/tasks/:id/cancel', (req: Request<{ id: string }>, res: Response) => {
    const taskId = req.params.id;
    const task = taskDB.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    taskDB.transitionStatus(taskId, 'cancelled');
    res.json(encrypt({ ok: true }, psk));
  });

  return router;
}
