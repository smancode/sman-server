import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TaskDB } from '../db-tasks.js';
import type { TaskStatus } from '../types.js';

export function createTasksRouter(taskDB: TaskDB, adminToken: string): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  router.get('/tasks', (req: Request, res: Response) => {
    const roomId = req.query.roomId as string | undefined;
    const status = req.query.status as string | undefined;
    if (roomId) {
      const tasks = taskDB.listRoomTasks(roomId, status as TaskStatus | undefined);
      res.json(tasks);
    } else {
      res.json([]);
    }
  });

  router.get('/tasks/:id', (req: Request<{ id: string }>, res: Response) => {
    const task = taskDB.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const events = taskDB.getTaskEvents(task.id);
    res.json({ task, events });
  });

  router.get('/tasks/:id/events', (req: Request<{ id: string }>, res: Response) => {
    const events = taskDB.getTaskEvents(req.params.id);
    res.json(events);
  });

  router.get('/rooms/:roomId/task-stats', (req: Request<{ roomId: string }>, res: Response) => {
    const stats = taskDB.getStats(req.params.roomId);
    res.json(stats);
  });

  return router;
}
