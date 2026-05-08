import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HubDB } from '../db.js';
import { decrypt, encrypt } from '../crypto.js';
import type { BroadcastQueryPayload, AckPayload, EncryptedRequest } from '../types.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function validateRequest(body: EncryptedRequest): string | null {
  if (body.pskVersion !== 1) return 'Unsupported PSK version';
  if (Math.abs(Date.now() - body.timestamp * 1000) > REPLAY_WINDOW_MS) return 'Timestamp out of range';
  return null;
}

export function createBroadcastRouter(db: HubDB, psk: string): Router {
  const router = Router();

  router.post('/broadcasts', (req: Request, res: Response) => {
    try {
      const err = validateRequest(req.body as EncryptedRequest);
      if (err) { res.status(400).json({ error: err }); return; }

      const { payload } = req.body as EncryptedRequest;
      const data = decrypt(payload, psk) as BroadcastQueryPayload;
      const rows = db.getBroadcastsSince(data.since);
      const readIds = new Set(db.getReadBroadcastIds(data.clientId));
      const messages = rows
        .filter(r => !readIds.has(r.id))
        .map(r => ({ id: r.id, title: r.title, body: r.body, createdAt: r.created_at }));

      const responsePayload = encrypt({ messages, hasMore: false }, psk);
      res.json({ payload: responsePayload });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  router.post('/ack', (req: Request, res: Response) => {
    try {
      const err = validateRequest(req.body as EncryptedRequest);
      if (err) { res.status(400).json({ error: err }); return; }

      const { payload } = req.body as EncryptedRequest;
      const data = decrypt(payload, psk) as AckPayload;
      for (const bid of data.broadcastIds) {
        db.markAsRead({ clientId: data.clientId, broadcastId: bid });
      }

      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  return router;
}
