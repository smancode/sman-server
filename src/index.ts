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
const PSK = process.env.PSK;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DATA_DIR = path.resolve(process.cwd(), 'data');

function localhostOnly(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    next();
    return;
  }
  res.status(403).send('Forbidden');
}

if (!PSK || PSK.length !== 32) {
  console.error('ERROR: PSK must be exactly 32 characters. Set PSK in .env');
  process.exit(1);
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
