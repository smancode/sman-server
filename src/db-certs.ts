import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export interface CertificateRecord {
  serial: string;
  cn: string;
  identity: string;
  device_id: string | null;
  status: 'active' | 'revoked' | 'expired';
  pem: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface CertificateSummary {
  serial: string;
  cn: string;
  identity: string;
  device_id: string | null;
  status: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export class CertDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS certificates (
        serial TEXT PRIMARY KEY,
        cn TEXT NOT NULL,
        identity TEXT NOT NULL,
        device_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        pem TEXT NOT NULL,
        issued_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        revoked_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_certs_identity ON certificates(identity);
      CREATE INDEX IF NOT EXISTS idx_certs_status ON certificates(status);
      CREATE INDEX IF NOT EXISTS idx_certs_expires ON certificates(expires_at);
    `);
  }

  upsertCert(params: {
    serial: string;
    cn: string;
    identity: string;
    deviceId?: string | null;
    pem: string;
    expiresAt: string;
  }): void {
    this.db.prepare(`
      INSERT INTO certificates (serial, cn, identity, device_id, pem, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(serial) DO UPDATE SET
        cn = excluded.cn,
        identity = excluded.identity,
        device_id = excluded.device_id,
        pem = excluded.pem,
        expires_at = excluded.expires_at,
        status = 'active',
        revoked_at = NULL,
        revoked_reason = NULL
    `).run(params.serial, params.cn, params.identity, params.deviceId ?? null, params.pem, params.expiresAt);
  }

  getCert(serial: string): CertificateRecord | undefined {
    return this.db.prepare('SELECT * FROM certificates WHERE serial = ?').get(serial) as CertificateRecord | undefined;
  }

  getCertByPem(pem: string): CertificateRecord | undefined {
    return this.db.prepare('SELECT * FROM certificates WHERE pem = ?').get(pem.trim()) as CertificateRecord | undefined;
  }

  getCertsByIdentity(identity: string): CertificateRecord[] {
    return this.db.prepare(
      'SELECT * FROM certificates WHERE identity = ? ORDER BY issued_at DESC'
    ).all(identity) as CertificateRecord[];
  }

  getActiveCertsByIdentity(identity: string): CertificateRecord[] {
    return this.db.prepare(
      "SELECT * FROM certificates WHERE identity = ? AND status = 'active' ORDER BY issued_at DESC"
    ).all(identity) as CertificateRecord[];
  }

  revokeCert(serial: string, reason?: string): boolean {
    const result = this.db.prepare(`
      UPDATE certificates
      SET status = 'revoked', revoked_at = datetime('now', 'localtime'), revoked_reason = ?
      WHERE serial = ? AND status = 'active'
    `).run(reason ?? null, serial);
    return result.changes > 0;
  }

  getAllCerts(limit = 100, offset = 0): CertificateSummary[] {
    return this.db.prepare(
      'SELECT serial, cn, identity, device_id, status, issued_at, expires_at, revoked_at, revoked_reason FROM certificates ORDER BY issued_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as CertificateSummary[];
  }

  getRevokedSerials(): string[] {
    const rows = this.db.prepare(
      "SELECT serial FROM certificates WHERE status = 'revoked'"
    ).all() as { serial: string }[];
    return rows.map(r => r.serial);
  }

  getActiveCertCount(): number {
    return (this.db.prepare("SELECT COUNT(*) as c FROM certificates WHERE status = 'active'").get() as { c: number }).c;
  }

  getCertCountByStatus(): { active: number; revoked: number; expired: number } {
    const rows = this.db.prepare(
      'SELECT status, COUNT(*) as c FROM certificates GROUP BY status'
    ).all() as { status: string; c: number }[];
    const result = { active: 0, revoked: 0, expired: 0 };
    for (const row of rows) {
      if (row.status in result) {
        (result as Record<string, number>)[row.status] = row.c;
      }
    }
    return result;
  }

  /** Mark expired certificates. Returns number of certificates marked. */
  markExpired(): number {
    const result = this.db.prepare(`
      UPDATE certificates SET status = 'expired'
      WHERE status = 'active' AND expires_at < datetime('now', 'localtime')
    `).run();
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
