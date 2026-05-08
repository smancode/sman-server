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

  router.post('/publish', (req: Request, res: Response) => {
    const { version, url, filename, sha512, size, releaseDate, releaseNotes } = req.body;
    if (!version || !url) {
      res.status(400).json({ error: 'version and url required' });
      return;
    }
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: 'url must be a valid URL' });
      return;
    }
    // Derive a safe filename for electron-updater's local temp path.
    // The download URL may contain query params or lack an .exe/.dmg extension,
    // which crashes electron-updater on Windows (illegal path chars like : and ?).
    const downloadUrl = new URL(url);
    let safeName = filename || '';
    if (!safeName) {
      // Try to extract from URL path
      const urlBasename = decodeURIComponent(downloadUrl.pathname.split('/').filter(Boolean).pop() || '');
      if (urlBasename && /\.(exe|dmg)$/i.test(urlBasename)) {
        safeName = urlBasename;
      } else {
        safeName = `Sman-Setup-${version}.exe`;
      }
    }
    const date = releaseDate || new Date().toISOString();
    const yml = [
      `version: ${version}`,
      `files:`,
      `  - url: ${safeName}`,
      `    path: ${url}`,
      sha512 ? `    sha512: ${sha512}` : null,
      size ? `    size: ${size}` : null,
      `releaseDate: '${date}'`,
      releaseNotes ? `releaseNotes: '${releaseNotes.replace(/'/g, "''")}'` : null,
    ].filter(Boolean).join('\n') + '\n';
    fs.writeFileSync(path.join(updatesDir, 'latest.yml'), yml, 'utf-8');
    res.json({ ok: true, path: '/updates/sman/latest.yml', yml });
  });

  router.get('/latest-yml', (_req: Request, res: Response) => {
    const ymlPath = path.join(updatesDir, 'latest.yml');
    try {
      const content = fs.readFileSync(ymlPath, 'utf-8');
      res.type('text/plain').send(content);
    } catch {
      res.status(404).send('latest.yml not found');
    }
  });

  return router;
}
