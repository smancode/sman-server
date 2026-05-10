import { Router } from 'express';
import type { Request, Response } from 'express';
import type { RoomDB } from '../db-rooms.js';

export function createRoomsRouter(roomDB: RoomDB, adminToken: string): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  router.get('/rooms', (_req: Request, res: Response) => {
    const rooms = roomDB.listRooms();
    const result = rooms.map(room => ({
      ...room,
      memberCount: roomDB.getMemberCount(room.id),
    }));
    res.json(result);
  });

  router.get('/rooms/:id', (req: Request<{ id: string }>, res: Response) => {
    const room = roomDB.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const members = roomDB.getRoomMembers(room.id);
    const agents = roomDB.getRoomAgents(room.id);
    res.json({ room, members, agents });
  });

  router.get('/agents', (_req: Request, res: Response) => {
    const rooms = roomDB.listRooms();
    const allAgents = rooms.flatMap(room => roomDB.getRoomAgents(room.id));
    res.json(allAgents);
  });

  router.delete('/rooms/:id', (req: Request<{ id: string }>, res: Response) => {
    roomDB.deactivateRoom(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
