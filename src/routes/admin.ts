import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HubDB } from '../db.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

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
      const releaseNotes = req.query.releaseNotes as string;
      if (!filename) {
        res.status(400).json({ error: 'filename query param required' });
        return;
      }
      const ext = path.extname(filename).toLowerCase();
      if (!['.yml', '.dmg', '.exe', '.blockmap'].includes(ext)) {
        res.status(400).json({ error: 'Unsupported file type' });
        return;
      }
      const data = Buffer.concat(chunks);
      const basename = path.basename(filename);
      const targetPath = path.join(updatesDir, basename);
      fs.writeFileSync(targetPath, data);

      const result: Record<string, unknown> = {
        ok: true,
        path: `/updates/sman/${basename}`,
        size: data.length,
      };

      // Auto-generate latest.yml for installer uploads (.exe/.dmg)
      // Extract version from filename, e.g. "Sman-Setup-26.508.16.exe" → "26.508.16"
      if (['.exe', '.dmg'].includes(ext)) {
        const versionMatch = basename.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          const version = versionMatch[1];
          const sha512 = crypto.createHash('sha512').update(data).digest('base64');
          const date = new Date().toISOString();
          const yml = [
            `version: ${version}`,
            `files:`,
            `  - url: ${basename}`,
            `    sha512: ${sha512}`,
            `    size: ${data.length}`,
            `releaseDate: '${date}'`,
            releaseNotes ? `releaseNotes: '${releaseNotes.replace(/'/g, "''")}'` : null,
          ].filter(Boolean).join('\n') + '\n';
          fs.writeFileSync(path.join(updatesDir, 'latest.yml'), yml, 'utf-8');
          result.yml = yml;
          result.sha512 = sha512;
          result.version = version;

          // Auto-update nginx download link and landing page version
          const scriptPath = path.join(updatesDir, '..', '..', 'update-download-links.sh');
          try {
            execFile('bash', [scriptPath], { timeout: 5000 }, (err, stdout) => {
              if (err) console.error('[upload] update-download-links.sh failed:', err.message);
              else console.log('[upload] download links updated:', stdout.trim());
            });
          } catch {}
        }
      }

      res.json(result);
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
    // Determine a safe filename for electron-updater's local temp path.
    // External URLs with query params or non-.exe paths crash on Windows,
    // so we create a local redirect file that points to the real URL.
    const downloadUrl = new URL(url);
    let safeName = filename || '';
    if (!safeName) {
      const urlBasename = decodeURIComponent(downloadUrl.pathname.split('/').filter(Boolean).pop() || '');
      if (urlBasename && /\.(exe|dmg)$/i.test(urlBasename)) {
        safeName = urlBasename;
      } else {
        safeName = `Sman-Setup-${version}.exe`;
      }
    }

    // Save the redirect mapping: filename → real external URL
    const redirectDir = path.join(updatesDir, '_redirects');
    fs.mkdirSync(redirectDir, { recursive: true });
    fs.writeFileSync(path.join(redirectDir, safeName), url, 'utf-8');

    const date = releaseDate || new Date().toISOString();
    const yml = [
      `version: ${version}`,
      `files:`,
      `  - url: ${safeName}`,
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

  // Stardom dev-mode toggle
  router.get('/stardom-dev-mode', (_req: Request, res: Response) => {
    const val = db.getSetting('stardom_dev_mode');
    res.json({ enabled: val === '1' });
  });

  router.put('/stardom-dev-mode', (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled (boolean) required' });
      return;
    }
    db.setSetting('stardom_dev_mode', enabled ? '1' : '0');
    res.json({ ok: true, enabled });
  });

  router.get('/error-reports', (req: Request, res: Response) => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 100, 1), 500);
    res.json(db.getErrorReports(limit));
  });

  router.delete('/error-reports/:id', (req: Request, res: Response) => {
    db.deleteErrorReport(Number(req.params.id));
    res.json({ ok: true });
  });

  router.get('/pageviews', (_req: Request, res: Response) => {
    const days = Math.min(Math.max(parseInt(String(_req.query.days)) || 30, 1), 365);
    res.json({ days: db.getPageViews(days) });
  });

  return router;
}
