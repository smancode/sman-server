import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HubDB } from './db.js';
import { RoomDB } from './db-rooms.js';
import { TaskDB } from './db-tasks.js';
import { TaskEngine } from './task-engine.js';
import { WsHub } from './ws-server.js';
import { createReportRouter } from './routes/report.js';
import { createBroadcastRouter } from './routes/broadcast.js';
import { createAdminRouter } from './routes/admin.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createTasksRouter } from './routes/tasks.js';
import { createHubApiRouter } from './routes/hub-api.js';
import { SkillScheduler } from './skill-scheduler.js';

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
const pagesDir = path.join(DATA_DIR, 'pages');
fs.mkdirSync(updatesDir, { recursive: true });
fs.mkdirSync(pagesDir, { recursive: true });

const db = new HubDB(path.join(DATA_DIR, 'hub.db'));
const roomDB = new RoomDB(path.join(DATA_DIR, 'rooms.db'));
const taskDB = new TaskDB(path.join(DATA_DIR, 'tasks.db'));
const taskEngine = new TaskEngine(taskDB);
const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));

function handleDownload(req: Request<{ filename: string }>, res: Response) {
  const fname = req.params.filename;
  const filePath = path.join(updatesDir, fname);
  const isBinary = !fname.endsWith('.yml') && !fname.endsWith('.blockmap');

  // Check for redirect mapping (external URL)
  const redirectFile = path.join(updatesDir, '_redirects', fname);
  try {
    const targetUrl = fs.readFileSync(redirectFile, 'utf-8').trim();
    if (isBinary) {
      try {
        const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown';
        db.recordDownload(ip, fname);
      } catch { /* ignore */ }
    }
    res.redirect(302, targetUrl);
    return;
  } catch { /* no redirect */ }

  // Serve local file
  if (fs.existsSync(filePath)) {
    if (isBinary) {
      try {
        const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown';
        db.recordDownload(ip, fname);
      } catch { /* ignore */ }
    }
    res.sendFile(filePath);
    return;
  }
  res.status(404).send('Not found');
}

app.get('/updates/sman/:filename', handleDownload);
app.get('/download/:filename', handleDownload);
app.use('/updates', (_req, res) => res.status(404).send('Not found'));

app.use('/api', createReportRouter(db, PSK));
app.use('/api', createBroadcastRouter(db, PSK));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Public page view tracking (no auth)
app.post('/api/pageview', (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown';
    db.recordPageView(ip);
  } catch { /* ignore */ }
  res.json({ ok: true });
});

app.use('/admin', createAdminRouter(db, ADMIN_TOKEN, updatesDir));
app.use('/admin', createRoomsRouter(roomDB, ADMIN_TOKEN));
app.use('/admin', createTasksRouter(taskDB, ADMIN_TOKEN));

// Hub API needs wsHub for auto-dispatch broadcast, but wsHub requires a running server.
// Solution: register hub API route after listen(), but BEFORE the SPA fallback.
// The SPA fallback is stored and registered after wsHub is created.

const server = app.listen(PORT, () => {
  console.log(`sman-server listening on port ${PORT}`);
  console.log(`Updates served at /updates/sman`);
});

const wsHub = new WsHub(server, roomDB, PSK, taskEngine);

// Hub API routes — registered after wsHub creation, before SPA fallback
app.use('/api/hub', createHubApiRouter(roomDB, taskDB, PSK, taskEngine, db, wsHub));

// Skill auto-updater scheduler — dispatches at configurable time (default 03:03 daily)
const scheduleHour = parseInt(process.env.SKILL_SCHEDULE_HOUR || '3', 10);
const scheduleMinute = parseInt(process.env.SKILL_SCHEDULE_MINUTE || '3', 10);
const skillScheduler = new SkillScheduler({ roomDB, taskDB, taskEngine, wsHub, scheduleHour, scheduleMinute });
skillScheduler.start();

// Admin: manual trigger for skill scheduler
app.post('/admin/skill-scheduler/trigger', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const result = skillScheduler.triggerNow();
  res.json({ ok: true, ...result });
});

// Admin: skill scheduler status + toggle + logs
app.get('/admin/skill-scheduler/status', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(skillScheduler.getStatus());
});

app.put('/admin/skill-scheduler/enabled', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { enabled } = req.body as { enabled: boolean };
  skillScheduler.setEnabled(Boolean(enabled));
  res.json({ ok: true, enabled: skillScheduler.isEnabled() });
});

app.get('/admin/skill-scheduler/logs', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(skillScheduler.getLogs(limit));
});

app.put('/admin/skill-scheduler/schedule', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { hour, minute } = req.body as { hour: number; minute: number };
  if (typeof hour !== 'number' || typeof minute !== 'number' || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    res.status(400).json({ error: 'Invalid schedule: hour (0-23) and minute (0-59) required' });
    return;
  }
  skillScheduler.setSchedule(hour, minute);
  res.json({ ok: true, ...skillScheduler.getStatus() });
});

// Public static pages (no auth, accessible from LAN)
app.use('/pages', express.static(pagesDir));

// SPA static files — MUST be last to avoid intercepting API routes
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
  app.use((req: Request, res: Response) => {
    if (req.method === 'GET' && req.accepts('html')) {
      res.sendFile(path.join(publicDir, 'index.html'));
      return;
    }
    res.status(404).json({ error: 'Not found' });
  });
}

process.on('SIGTERM', () => {
  skillScheduler.stop();
  wsHub.close();
  server.close(() => {
    taskDB.close();
    roomDB.close();
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  skillScheduler.stop();
  wsHub.close();
  server.close(() => {
    taskDB.close();
    roomDB.close();
    db.close();
    process.exit(0);
  });
});
