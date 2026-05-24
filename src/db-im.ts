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

export interface IMRoomRow {
  id: string;
  name: string;
  members: string;
  last_message_time: number | null;
}

export class IMDB {
  private db: Database.Database;
  private stmts: {
    insertMessage: Database.Statement;
    getMessagesAfter: Database.Statement;
    deleteOldMessages: Database.Statement;
    upsertRoom: Database.Statement;
    getRoom: Database.Statement;
    getRoomsForMember: Database.Statement;
    deleteRoom: Database.Statement;
  };

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
    this.stmts = this.prepareStatements();
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

      CREATE TABLE IF NOT EXISTS im_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        members TEXT NOT NULL DEFAULT '[]',
        last_message_time INTEGER DEFAULT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_im_msg_room_ts ON im_messages(room_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_im_msg_room_seq ON im_messages(room_id, seq);
    `);

    // seq migration
    try {
      this.db.exec('ALTER TABLE im_messages ADD COLUMN seq INTEGER DEFAULT 0');
    } catch {
      // Column already exists
    }
  }

  private prepareStatements() {
    return {
      insertMessage: this.db.prepare(`
        INSERT OR IGNORE INTO im_messages (id, room_id, sender, content, mentioned_agents, quote_id, type, status, attachments, session_id, timestamp, seq)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getMessagesAfter: this.db.prepare(`
        SELECT * FROM im_messages WHERE room_id = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?
      `),
      deleteOldMessages: this.db.prepare('DELETE FROM im_messages WHERE timestamp < ?'),
      upsertRoom: this.db.prepare(`
        INSERT INTO im_rooms (id, name, members, last_message_time) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET members = excluded.members, name = excluded.name
      `),
      getRoom: this.db.prepare('SELECT id, name, members, last_message_time FROM im_rooms WHERE id = ?'),
      getRoomsForMember: this.db.prepare(`
        SELECT id, name, members, last_message_time FROM im_rooms
        WHERE members LIKE ?
        ORDER BY last_message_time DESC
      `),
      deleteRoom: this.db.prepare('DELETE FROM im_rooms WHERE id = ?'),
    };
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
    this.stmts.insertMessage.run(
      msg.id, msg.room_id, msg.sender, msg.content,
      msg.mentioned_agents ?? null, msg.quote_id ?? null,
      msg.type ?? 'text', msg.status ?? null,
      msg.attachments ?? null, msg.session_id ?? null,
      msg.timestamp, msg.seq ?? 0,
    );
  }

  getMessagesAfter(roomId: string, afterTimestamp: number, limit: number = 200): IMMessageRow[] {
    return this.stmts.getMessagesAfter.all(roomId, afterTimestamp, limit) as IMMessageRow[];
  }

  /** Upsert room info (called on im.room.updated) */
  upsertRoom(roomId: string, name: string, members: string[], lastMessageTime?: number): void {
    this.stmts.upsertRoom.run(roomId, name, JSON.stringify(members), lastMessageTime ?? null);
  }

  /** Get rooms where a clientId is a member */
  getRoomsForMember(clientId: string): IMRoomRow[] {
    return this.stmts.getRoomsForMember.all(`%"${clientId}"%`) as IMRoomRow[];
  }

  getRoom(roomId: string): IMRoomRow | undefined {
    return this.stmts.getRoom.get(roomId) as IMRoomRow | undefined;
  }

  deleteRoom(roomId: string): void {
    this.stmts.deleteRoom.run(roomId);
  }

  /** Delete messages older than 7 days */
  deleteOldMessages(): number {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const result = this.stmts.deleteOldMessages.run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
