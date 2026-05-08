import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HubDB } from './db.js';
import { createReportRouter } from './routes/report.js';
import { createBroadcastRouter } from './routes/broadcast.js';
import { createAdminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5882', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const KEY_FILE = path.resolve(process.cwd(), 'hub.key');

function loadPsk(): string {
  if (process.env.SMAN_PSK && process.env.SMAN_PSK.length === 32) return process.env.SMAN_PSK;
  try {
    const key = fs.readFileSync(KEY_FILE, 'utf-8').trim();
    if (key.length === 32) return key;
    console.error(`ERROR: hub.key must be exactly 32 characters, got ${key.length}`);
  } catch {}
  console.error('ERROR: PSK must be exactly 32 characters. Set SMAN_PSK env var or hub.key file');
  process.exit(1);
}

const PSK = loadPsk();

function localhostOnly(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    next();
    return;
  }
  res.status(403).send('Forbidden');
}


if (!ADMIN_TOKEN) {
  console.error('ERROR: ADMIN_TOKEN must be set in .env');
  process.exit(1);
}

const updatesDir = path.join(DATA_DIR, 'updates', 'sman');
fs.mkdirSync(updatesDir, { recursive: true });

const db = new HubDB(path.join(DATA_DIR, 'hub.db'));
const app = express();

app.use(express.json({ limit: '1mb' }));

app.use('/updates/sman', express.static(updatesDir));
// Redirect proxy: when electron-updater downloads a file that is actually an external URL,
// look up the real URL from _redirects/ and 302 redirect. This avoids Windows path issues
// with external URLs containing : and ? characters.
app.get('/updates/sman/:filename', (req: Request<{ filename: string }>, res: Response) => {
  const fname = req.params.filename;
  // Skip non-binary files (yml, blockmap, etc.) — let express.static handle them
  if (fname.endsWith('.yml') || fname.endsWith('.blockmap')) {
    const filePath = path.join(updatesDir, fname);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
      return;
    }
    res.status(404).send('Not found');
    return;
  }
  const redirectFile = path.join(updatesDir, '_redirects', fname);
  try {
    const targetUrl = fs.readFileSync(redirectFile, 'utf-8').trim();
    res.redirect(302, targetUrl);
  } catch {
    // No redirect mapping — check if actual file exists
    const filePath = path.join(updatesDir, fname);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
      return;
    }
    res.status(404).send('Not found');
  }
});
app.use('/updates', (_req, res) => res.status(404).send('Not found'));

app.use('/api', createReportRouter(db, PSK));
app.use('/api', createBroadcastRouter(db, PSK));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/admin', createAdminRouter(db, ADMIN_TOKEN, updatesDir));

// SPA static files (localhost only, production mode)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(localhostOnly, express.static(publicDir));
  app.use(localhostOnly, (req: Request, res: Response) => {
    if (req.method === 'GET' && req.accepts('html')) {
      res.sendFile(path.join(publicDir, 'index.html'));
      return;
    }
    res.status(404).json({ error: 'Not found' });
  });
}

const server = app.listen(PORT, () => {
  console.log(`sman-server listening on port ${PORT}`);
  console.log(`Updates served at /updates/sman`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
