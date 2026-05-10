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

  // ---- Read ----

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

  // ---- Write ----

  router.post('/rooms', (req: Request, res: Response) => {
    const { name, description, maxAgents, ownerId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Room name is required' });
      return;
    }
    const room = roomDB.createRoom({
      name,
      description,
      ownerId: ownerId || 'admin',
      maxAgents,
    });
    res.status(201).json(room);
  });

  router.post('/rooms/:id/join', (req: Request<{ id: string }>, res: Response) => {
    const roomId = req.params.id;
    const { clientId, displayName } = req.body;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const member = roomDB.joinRoom({
      roomId,
      clientId,
      displayName: displayName || clientId,
    });
    if (!member) {
      res.status(409).json({ error: 'Cannot join room (not found, full, or already joined)' });
      return;
    }
    res.json(member);
  });

  router.post('/rooms/:id/leave', (req: Request<{ id: string }>, res: Response) => {
    const roomId = req.params.id;
    const { clientId } = req.body;
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }
    const left = roomDB.leaveRoom(roomId, clientId);
    res.json({ ok: left });
  });

  router.delete('/rooms/:id', (req: Request<{ id: string }>, res: Response) => {
    roomDB.deactivateRoom(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
