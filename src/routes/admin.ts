import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HubDB } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';

export function createAdminRouter(db: HubDB, adminToken: string, updatesDir: string): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  router.post('/broadcast', (req: Request, res: Response) => {
    const { id, title, body } = req.body;
    if (!id || !title || !body) {
      res.status(400).json({ error: 'id, title, body required' });
      return;
    }
    db.createBroadcast({ id, title, body, createdAt: new Date().toISOString() });
    res.json({ ok: true });
  });

  router.get('/broadcasts', (_req: Request, res: Response) => {
    res.json(db.getAllBroadcasts());
  });

  router.delete('/broadcast/:id', (req: Request, res: Response) => {
    db.deactivateBroadcast(String(req.params.id));
    res.json({ ok: true });
  });

  router.get('/stats', (_req: Request, res: Response) => {
    res.json(db.getStats());
  });

  router.get('/clients', (_req: Request, res: Response) => {
    res.json(db.getAllClients());
  });

  router.put('/upload', (req: Request, res: Response) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const filename = req.query.filename as string;
      if (!filename) {
        res.status(400).json({ error: 'filename query param required' });
        return;
      }
      const ext = path.extname(filename).toLowerCase();
      if (!['.yml', '.dmg', '.exe', '.blockmap'].includes(ext)) {
        res.status(400).json({ error: 'Unsupported file type' });
        return;
      }
      const targetPath = path.join(updatesDir, path.basename(filename));
      fs.writeFileSync(targetPath, Buffer.concat(chunks));
      res.json({ ok: true, path: `/updates/sman/${path.basename(filename)}` });
    });
    req.on('error', () => res.status(500).json({ error: 'Upload failed' }));
  });

  return router;
}
