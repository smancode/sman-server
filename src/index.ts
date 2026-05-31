import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HubDB } from './db.js';
import { RoomDB } from './db-rooms.js';
import { TaskDB } from './db-tasks.js';
import { IMDB } from './db-im.js';
import { TaskEngine } from './task-engine.js';
import { WsHub } from './ws-server.js';
import { loadPsk } from './crypto.js';
import { initCA, generateServerCert, verifyClientCert } from './ca.js';
import { CertDB } from './db-certs.js';
import { AccountDB } from './db-accounts.js';
import { LedgerEngine } from './ledger-engine.js';
import { AccountEngine } from './account-engine.js';
import { createReportRouter } from './routes/report.js';
import { createBroadcastRouter } from './routes/broadcast.js';
import { createAdminRouter } from './routes/admin.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createTasksRouter } from './routes/tasks.js';
import { createHubApiRouter } from './routes/hub-api.js';
import { createAuthRouter, createAdminCertRouter } from './routes/auth.js';
import { createAccountRouter } from './routes/accounts.js';
import { createAdminAccountRouter } from './routes/admin-accounts.js';
import { SkillScheduler } from './skill-scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5882', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DATA_DIR = path.resolve(process.env.HUB_DATA_DIR || path.join(process.cwd(), 'data'));
const TLS_ENABLED = process.env.TLS_ENABLED !== 'false'; // Default: TLS on

const PSK = loadPsk();

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
const imDB = new IMDB(path.join(DATA_DIR, 'im.db'));
const certDB = new CertDB(path.join(DATA_DIR, 'certs.db'));
const accountDB = new AccountDB(path.join(DATA_DIR, 'accounts.db'));
const ledgerEngine = new LedgerEngine(accountDB);
const accountEngineInstance = new AccountEngine(accountDB);
const taskEngine = new TaskEngine(taskDB);

// Phase 0A: Initialize CA + generate server cert (skip when TLS disabled)
const tlsDataDir = path.join(DATA_DIR, 'tls');
let caResult: Awaited<ReturnType<typeof initCA>> | null = null;
let serverCerts: Awaited<ReturnType<typeof generateServerCert>> | null = null;
if (TLS_ENABLED) {
  caResult = initCA(tlsDataDir);
  serverCerts = generateServerCert(tlsDataDir);
  if (caResult.generated) {
    console.log('[TLS] New CA certificate generated');
  }
  console.log('[TLS] Server certificate ready');
} else {
  console.log('[TLS] Disabled — running in HTTP mode');
}

// Skill auto-updater scheduler — pull model via report response
const scheduleHour = parseInt(process.env.SKILL_SCHEDULE_HOUR || '3', 10);
const scheduleMinute = parseInt(process.env.SKILL_SCHEDULE_MINUTE || '3', 10);
const skillScheduler = new SkillScheduler({ db, scheduleHour, scheduleMinute });

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

// Friendly download routes — redirect to actual file based on yml
// MUST be registered before the wildcard /download/:filename route
function makeFriendlyDownloadRoute(ymlName: string) {
  return (_req: Request, res: Response) => {
    try {
      const ymlPath = path.join(updatesDir, ymlName);
      const yml = fs.readFileSync(ymlPath, 'utf-8');
      // Try "url: <filename>" in files section, fallback to top-level "path:"
      let fileMatch = yml.match(/^\s*-\s*url:\s*(.+)$/m);
      let filename = fileMatch?.[1]?.trim();
      if (!filename) {
        const pathMatch = yml.match(/^path:\s*(.+)$/m);
        filename = pathMatch?.[1]?.trim();
      }
      if (!filename) {
        res.status(404).send('Installer filename not found in yml');
        return;
      }
      // If url is a full URL (external), redirect directly
      if (/^https?:\/\//.test(filename)) {
        res.redirect(302, filename);
        return;
      }
      res.redirect(302, `/download/${filename}`);
    } catch {
      res.status(404).send(`${ymlName} not found`);
    }
  };
}

app.get('/download/windows-x64', makeFriendlyDownloadRoute('latest.yml'));
app.get('/download/macos-arm', (_req: Request, res: Response) => {
  // Prefer DMG for user downloads, fall back to yml (which points to zip for electron-updater)
  try {
    const files = fs.readdirSync(updatesDir);
    const dmgs = files.filter(f => f.endsWith('.dmg'));
    if (dmgs.length > 0) {
      // Sort by modification time descending, pick the latest
      const sorted = dmgs.map(f => ({ f, mtime: fs.statSync(path.join(updatesDir, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      res.redirect(302, `/download/${sorted[0].f}`);
      return;
    }
  } catch { /* no dmg */ }
  makeFriendlyDownloadRoute('latest-mac.yml')(_req, res);
});

app.get('/updates/sman/:filename', handleDownload);
app.get('/download/:filename', handleDownload);

app.use('/updates', (_req, res) => res.status(404).send('Not found'));

app.use('/api', createReportRouter(db, PSK, (clientId) => skillScheduler.getCommands(clientId)));
app.use('/api', createBroadcastRouter(db, PSK));

// mTLS auth routes (no client cert required — whitelisted for cert enrollment)
app.use('/api/auth', createAuthRouter(certDB, ADMIN_TOKEN));

app.route('/health').get((_req, res) => res.json({ ok: true })).head((_req, res) => res.status(200).end());
app.route('/api/health').get((_req, res) => res.json({ ok: true })).head((_req, res) => res.status(200).end());

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
app.use('/admin', createAdminCertRouter(certDB, ADMIN_TOKEN));

// Hub API needs wsHub for auto-dispatch broadcast, but wsHub requires a running server.
// Solution: register hub API route after listen(), but BEFORE the SPA fallback.
// The SPA fallback is stored and registered after wsHub is created.

// Create HTTP or HTTPS server based on TLS_ENABLED
let server: http.Server | https.Server;
if (TLS_ENABLED) {
  server = https.createServer({
    key: serverCerts!.key,
    cert: serverCerts!.cert,
    ca: caResult!.caCertPem,
    requestCert: true,
    rejectUnauthorized: false, // Allow non-mTLS clients (PSK legacy + cert enrollment)
  }, app);
  console.log('[TLS] HTTPS server with mTLS enabled');
} else {
  server = http.createServer(app);
  console.log('[TLS] HTTP server (TLS disabled)');
}

server.listen(PORT, () => {
  const protocol = TLS_ENABLED ? 'HTTPS' : 'HTTP';
  console.log(`sman-server listening on port ${PORT} (${protocol})`);
  console.log(`Updates served at /updates/sman`);
  skillScheduler.start();
});

const wsHub = new WsHub(server, roomDB, imDB, db, PSK, taskEngine, certDB);

// Hub API routes — registered after wsHub creation, before SPA fallback
app.use('/api/hub', createHubApiRouter(roomDB, taskDB, PSK, taskEngine, db, wsHub));

// Account system routes (PSK-encrypted client routes + admin routes)
app.use('/api', createAccountRouter(accountDB, ledgerEngine, PSK));
app.use('/admin', createAdminAccountRouter(accountDB, ledgerEngine, accountEngineInstance, ADMIN_TOKEN!));

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
    imDB.close();
    certDB.close();
    accountDB.close();
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
    imDB.close();
    certDB.close();
    accountDB.close();
    db.close();
    process.exit(0);
  });
});
