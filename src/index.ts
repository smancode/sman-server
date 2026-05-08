import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { HubDB } from './db.js';
import { createReportRouter } from './routes/report.js';
import { createBroadcastRouter } from './routes/broadcast.js';
import { createAdminRouter } from './routes/admin.js';

const PORT = parseInt(process.env.PORT || '5882', 10);
const PSK = process.env.PSK;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DATA_DIR = path.resolve(process.cwd(), 'data');

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
app.use('/admin', createAdminRouter(db, ADMIN_TOKEN, updatesDir));

app.get('/health', (_req, res) => res.json({ ok: true }));

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
