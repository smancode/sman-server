import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { ClientRecord, AdminStats } from './types.js';

interface UpsertClientParams {
  clientId: string;
  version: string;
  hostname: string;
  ip: string;
  activeSessions: number;
}

interface InsertReportParams {
  clientId: string;
  reportTime: string;
  activeSessions: number;
}

interface CreateBroadcastParams {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  active: number;
}

interface ReportRow {
  id: number;
  client_id: string;
  report_time: string;
  active_sessions: number;
}

export class HubDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        client_id TEXT PRIMARY KEY,
        version TEXT,
        hostname TEXT,
        ip TEXT,
        first_seen TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen TEXT NOT NULL DEFAULT (datetime('now')),
        active_sessions INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL,
        report_time TEXT NOT NULL,
        active_sessions INTEGER DEFAULT 0,
        FOREIGN KEY (client_id) REFERENCES clients(client_id)
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS read_log (
        client_id TEXT NOT NULL,
        broadcast_id TEXT NOT NULL,
        read_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (client_id, broadcast_id)
      );

      CREATE INDEX IF NOT EXISTS idx_reports_client ON reports(client_id);
      CREATE INDEX IF NOT EXISTS idx_reports_time ON reports(report_time);
      CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON broadcasts(active);
    `);
  }

  upsertClient(params: UpsertClientParams): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO clients (client_id, version, hostname, ip, first_seen, last_seen, active_sessions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        version = excluded.version,
        hostname = excluded.hostname,
        ip = excluded.ip,
        last_seen = excluded.last_seen,
        active_sessions = excluded.active_sessions
    `).run(params.clientId, params.version, params.hostname, params.ip, now, now, params.activeSessions);
  }

  getClient(clientId: string): ClientRecord | undefined {
    return this.db.prepare('SELECT * FROM clients WHERE client_id = ?').get(clientId) as ClientRecord | undefined;
  }

  getAllClients(): ClientRecord[] {
    return this.db.prepare('SELECT * FROM clients ORDER BY last_seen DESC').all() as ClientRecord[];
  }

  insertReport(params: InsertReportParams): void {
    this.db.prepare(
      'INSERT INTO reports (client_id, report_time, active_sessions) VALUES (?, ?, ?)'
    ).run(params.clientId, params.reportTime, params.activeSessions);
  }

  getReportsByClientId(clientId: string): ReportRow[] {
    return this.db.prepare(
      'SELECT * FROM reports WHERE client_id = ? ORDER BY report_time DESC LIMIT 100'
    ).all(clientId) as ReportRow[];
  }

  createBroadcast(params: CreateBroadcastParams): void {
    this.db.prepare(
      'INSERT INTO broadcasts (id, title, body, created_at) VALUES (?, ?, ?, ?)'
    ).run(params.id, params.title, params.body, params.createdAt);
  }

  deactivateBroadcast(id: string): void {
    this.db.prepare('UPDATE broadcasts SET active = 0 WHERE id = ?').run(id);
  }

  getActiveBroadcasts(): BroadcastRow[] {
    return this.db.prepare(
      "SELECT * FROM broadcasts WHERE active = 1 ORDER BY created_at DESC"
    ).all() as BroadcastRow[];
  }

  getAllBroadcasts(): BroadcastRow[] {
    return this.db.prepare(
      "SELECT * FROM broadcasts ORDER BY created_at DESC"
    ).all() as BroadcastRow[];
  }

  getBroadcastsSince(since: string): BroadcastRow[] {
    return this.db.prepare(
      "SELECT * FROM broadcasts WHERE active = 1 AND created_at > ? ORDER BY created_at DESC"
    ).all(since) as BroadcastRow[];
  }

  markAsRead(params: { clientId: string; broadcastId: string }): void {
    this.db.prepare(
      'INSERT OR IGNORE INTO read_log (client_id, broadcast_id) VALUES (?, ?)'
    ).run(params.clientId, params.broadcastId);
  }

  getReadBroadcastIds(clientId: string): string[] {
    const rows = this.db.prepare(
      'SELECT broadcast_id FROM read_log WHERE client_id = ?'
    ).all(clientId) as { broadcast_id: string }[];
    return rows.map(r => r.broadcast_id);
  }

  getStats(): AdminStats {
    const totalClients = (this.db.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number }).c;
    const onlineClients = (this.db.prepare(
      "SELECT COUNT(*) as c FROM clients WHERE last_seen > datetime('now', '-1 hour')"
    ).get() as { c: number }).c;
    const totalReports24h = (this.db.prepare(
      "SELECT COUNT(*) as c FROM reports WHERE report_time > datetime('now', '-24 hours')"
    ).get() as { c: number }).c;
    const activeBroadcasts = (this.db.prepare(
      "SELECT COUNT(*) as c FROM broadcasts WHERE active = 1"
    ).get() as { c: number }).c;
    return { totalClients, onlineClients, totalReports24h, activeBroadcasts };
  }

  close(): void {
    this.db.close();
  }
}
