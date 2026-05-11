import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { RoomRecord, RoomMemberRecord, AgentRecord, AgentCapabilities, AgentStatus, RoomRole } from './types.js';

export class RoomDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        max_agents INTEGER DEFAULT 10,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (room_id, client_id)
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        workspace TEXT NOT NULL,
        capabilities TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online','offline','busy')),
        max_concurrent INTEGER DEFAULT 2,
        last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
        registered_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_agents_room ON agents(room_id);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_client ON agents(client_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(active);
    `);

    // Migration: add visibility column
    try {
      this.db.exec(`ALTER TABLE rooms ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private'))`);
    } catch { /* column already exists */ }

    // Migration: add password column
    try {
      this.db.exec(`ALTER TABLE rooms ADD COLUMN password TEXT`);
    } catch { /* column already exists */ }
  }

  // ---- Room CRUD ----

  createRoom(params: { name: string; description?: string; ownerId: string; maxAgents?: number; visibility?: 'public' | 'private'; password?: string }): RoomRecord {
    const id = crypto.randomUUID();
    const visibility = params.visibility || 'private';
    this.db.prepare(`
      INSERT INTO rooms (id, name, description, owner_id, max_agents, visibility, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.name, params.description ?? null, params.ownerId, params.maxAgents ?? 10, visibility, params.password || null);

    this.db.prepare(`
      INSERT INTO room_members (room_id, client_id, display_name, role)
      VALUES (?, ?, ?, 'owner')
    `).run(id, params.ownerId, params.ownerId);

    return this.getRoom(id)!;
  }

  getRoom(roomId: string): RoomRecord | undefined {
    return this.db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as RoomRecord | undefined;
  }

  listRooms(): RoomRecord[] {
    return this.db.prepare('SELECT * FROM rooms WHERE active = 1 ORDER BY created_at DESC').all() as RoomRecord[];
  }

  listRoomsVisibleTo(clientId: string, opts?: { search?: string; limit?: number; offset?: number }): RoomRecord[] {
    const search = opts?.search?.trim();
    const limit = opts?.limit ?? 10;
    const offset = opts?.offset ?? 0;

    let sql = `
      SELECT r.* FROM rooms r
      WHERE r.active = 1
        AND (r.visibility = 'public'
             OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.client_id = ?))
    `;
    const params: unknown[] = [clientId];

    if (search) {
      sql += ` AND (r.name LIKE ? OR r.owner_id LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params) as RoomRecord[];
  }

  countRoomsVisibleTo(clientId: string, search?: string): number {
    let sql = `
      SELECT COUNT(*) as cnt FROM rooms r
      WHERE r.active = 1
        AND (r.visibility = 'public'
             OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.client_id = ?))
    `;
    const params: unknown[] = [clientId];
    if (search?.trim()) {
      sql += ` AND (r.name LIKE ? OR r.owner_id LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    const row = this.db.prepare(sql).get(...params) as { cnt: number };
    return row.cnt;
  }

  deactivateRoom(roomId: string): void {
    this.db.prepare('UPDATE rooms SET active = 0 WHERE id = ?').run(roomId);
  }

  // ---- Room Members ----

  joinRoom(params: { roomId: string; clientId: string; displayName: string; role?: RoomRole }): RoomMemberRecord | null {
    const room = this.getRoom(params.roomId);
    if (!room || !room.active) return null;

    const existing = this.db.prepare(
      'SELECT * FROM room_members WHERE room_id = ? AND client_id = ?'
    ).get(params.roomId, params.clientId) as RoomMemberRecord | undefined;
    if (existing) return existing;

    const memberCount = (this.db.prepare(
      'SELECT COUNT(*) as c FROM room_members WHERE room_id = ?'
    ).get(params.roomId) as { c: number }).c;
    if (memberCount >= room.max_agents) return null;

    this.db.prepare(`
      INSERT INTO room_members (room_id, client_id, display_name, role)
      VALUES (?, ?, ?, ?)
    `).run(params.roomId, params.clientId, params.displayName, params.role ?? 'member');

    return this.db.prepare(
      'SELECT * FROM room_members WHERE room_id = ? AND client_id = ?'
    ).get(params.roomId, params.clientId) as RoomMemberRecord;
  }

  leaveRoom(roomId: string, clientId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;
    if (room.owner_id === clientId) return false;

    const result = this.db.prepare(
      'DELETE FROM room_members WHERE room_id = ? AND client_id = ?'
    ).run(roomId, clientId);
    return result.changes > 0;
  }

  getRoomMembers(roomId: string): RoomMemberRecord[] {
    return this.db.prepare(
      'SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC'
    ).all(roomId) as RoomMemberRecord[];
  }

  getMemberCount(roomId: string): number {
    return (this.db.prepare(
      'SELECT COUNT(*) as c FROM room_members WHERE room_id = ?'
    ).get(roomId) as { c: number }).c;
  }

  isMember(roomId: string, clientId: string): boolean {
    const row = this.db.prepare(
      'SELECT 1 FROM room_members WHERE room_id = ? AND client_id = ?'
    ).get(roomId, clientId);
    return row !== undefined;
  }

  // ---- Agent CRUD ----

  registerAgent(params: {
    agentId: string;
    roomId: string;
    clientId: string;
    workspace: string;
    capabilities: AgentCapabilities;
    maxConcurrent?: number;
  }): AgentRecord {
    const capsJson = JSON.stringify(params.capabilities);
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO agents (id, room_id, client_id, workspace, capabilities, status, max_concurrent, last_heartbeat)
      VALUES (?, ?, ?, ?, ?, 'online', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        room_id = excluded.room_id,
        client_id = excluded.client_id,
        workspace = excluded.workspace,
        capabilities = excluded.capabilities,
        status = 'online',
        max_concurrent = excluded.max_concurrent,
        last_heartbeat = excluded.last_heartbeat
    `).run(params.agentId, params.roomId, params.clientId, params.workspace, capsJson, params.maxConcurrent ?? 2, now);

    return this.getAgent(params.agentId)!;
  }

  deregisterAgent(agentId: string): void {
    this.db.prepare("UPDATE agents SET status = 'offline' WHERE id = ?").run(agentId);
  }

  getAgent(agentId: string): AgentRecord | undefined {
    return this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRecord | undefined;
  }

  getRoomAgents(roomId: string): AgentRecord[] {
    return this.db.prepare(
      'SELECT * FROM agents WHERE room_id = ? ORDER BY registered_at ASC'
    ).all(roomId) as AgentRecord[];
  }

  getClientAgents(clientId: string): AgentRecord[] {
    return this.db.prepare(
      'SELECT * FROM agents WHERE client_id = ? ORDER BY registered_at ASC'
    ).all(clientId) as AgentRecord[];
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, agentId);
  }

  updateHeartbeat(agentId: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE agents SET last_heartbeat = ? WHERE id = ?').run(now, agentId);
  }

  getStaleAgents(olderThanMs: number): AgentRecord[] {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    return this.db.prepare(
      "SELECT * FROM agents WHERE status != 'offline' AND last_heartbeat < ?"
    ).all(cutoff) as AgentRecord[];
  }

  markAgentsOffline(agentIds: string[]): void {
    if (agentIds.length === 0) return;
    const placeholders = agentIds.map(() => '?').join(',');
    this.db.prepare(
      `UPDATE agents SET status = 'offline' WHERE id IN (${placeholders})`
    ).run(...agentIds);
  }

  close(): void {
    this.db.close();
  }
}
