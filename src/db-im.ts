import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export interface IMMessageRow {
  id: string;
  room_id: string;
  sender: string;
  content: string;
  mentioned_agents: string | null;
  quote_id: string | null;
  type: string;
  status: string | null;
  attachments: string | null;
  session_id: string | null;
  timestamp: number;
  seq: number;
  created_at: string;
}

export class IMDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS im_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        mentioned_agents TEXT,
        quote_id TEXT,
        type TEXT NOT NULL DEFAULT 'text',
        status TEXT DEFAULT NULL,
        attachments TEXT,
        session_id TEXT,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // seq migration
    try {
      this.db.exec('ALTER TABLE im_messages ADD COLUMN seq INTEGER DEFAULT 0');
    } catch {
      // Column already exists
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_im_msg_room_ts ON im_messages(room_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_im_msg_room_seq ON im_messages(room_id, seq);
    `);
  }

  insertMessage(msg: {
    id: string;
    room_id: string;
    sender: string;
    content: string;
    mentioned_agents?: string;
    quote_id?: string;
    type?: string;
    status?: string;
    attachments?: string;
    session_id?: string;
    timestamp: number;
    seq?: number;
  }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO im_messages (id, room_id, sender, content, mentioned_agents, quote_id, type, status, attachments, session_id, timestamp, seq)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.room_id,
      msg.sender,
      msg.content,
      msg.mentioned_agents ?? null,
      msg.quote_id ?? null,
      msg.type ?? 'text',
      msg.status ?? null,
      msg.attachments ?? null,
      msg.session_id ?? null,
      msg.timestamp,
      msg.seq ?? 0,
    );
  }

  getMessagesAfter(roomId: string, afterTimestamp: number, limit: number = 200): IMMessageRow[] {
    return this.db.prepare(`
      SELECT * FROM im_messages WHERE room_id = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?
    `).all(roomId, afterTimestamp, limit) as IMMessageRow[];
  }

  /** Delete messages older than 7 days */
  deleteOldMessages(): number {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const result = this.db.prepare('DELETE FROM im_messages WHERE timestamp < ?').run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
