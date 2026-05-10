import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomDB } from '../db-rooms.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let db: RoomDB;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sman-rooms-test-'));
  db = new RoomDB(path.join(tmpDir, 'test-rooms.db'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('RoomDB', () => {
  describe('Room CRUD', () => {
    it('should create a room with owner as member', () => {
      const room = db.createRoom({ name: 'Test Room', ownerId: 'alice@1' });
      expect(room).toBeDefined();
      expect(room.name).toBe('Test Room');
      expect(room.owner_id).toBe('alice@1');

      const members = db.getRoomMembers(room.id);
      expect(members).toHaveLength(1);
      expect(members[0].client_id).toBe('alice@1');
      expect(members[0].role).toBe('owner');
    });

    it('should list active rooms', () => {
      db.createRoom({ name: 'Room A', ownerId: 'alice@1' });
      db.createRoom({ name: 'Room B', ownerId: 'bob@2' });
      const rooms = db.listRooms();
      expect(rooms).toHaveLength(2);
    });

    it('should deactivate room', () => {
      const room = db.createRoom({ name: 'To Deactivate', ownerId: 'alice@1' });
      db.deactivateRoom(room.id);
      const rooms = db.listRooms();
      expect(rooms).toHaveLength(0);
    });
  });

  describe('Room Members', () => {
    it('should join room', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      const member = db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      expect(member).toBeDefined();
      expect(member!.client_id).toBe('bob@2');
      expect(member!.role).toBe('member');

      const count = db.getMemberCount(room.id);
      expect(count).toBe(2);
    });

    it('should reject joining inactive room', () => {
      const room = db.createRoom({ name: 'Inactive', ownerId: 'alice@1' });
      db.deactivateRoom(room.id);
      const member = db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      expect(member).toBeNull();
    });

    it('should reject duplicate join', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      const m1 = db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      const m2 = db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      expect(m1).toBeDefined();
      expect(m2).toBeDefined();
      expect(m2!.role).toBe('member');
    });

    it('should leave room', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      const left = db.leaveRoom(room.id, 'bob@2');
      expect(left).toBe(true);
      expect(db.getMemberCount(room.id)).toBe(1);
    });

    it('should reject owner leaving', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      const left = db.leaveRoom(room.id, 'alice@1');
      expect(left).toBe(false);
    });

    it('should enforce max_agents limit', () => {
      const room = db.createRoom({ name: 'Small', ownerId: 'alice@1', maxAgents: 2 });
      db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      const m3 = db.joinRoom({ roomId: room.id, clientId: 'charlie@3', displayName: 'Charlie' });
      expect(m3).toBeNull();
    });
  });

  describe('Agent CRUD', () => {
    it('should register agent', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      const agent = db.registerAgent({
        agentId: 'alice:abc123',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/projects/frontend',
        capabilities: { skills: ['react', 'typescript'], techStack: ['React', 'Tailwind'], projectType: 'frontend' },
      });
      expect(agent).toBeDefined();
      expect(agent.id).toBe('alice:abc123');
      expect(agent.status).toBe('online');
      expect(agent.workspace).toBe('/projects/frontend');
    });

    it('should upsert agent on re-register', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.registerAgent({
        agentId: 'alice:abc123',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/projects/frontend',
        capabilities: { skills: ['react'], techStack: ['React'], projectType: 'frontend' },
      });
      const updated = db.registerAgent({
        agentId: 'alice:abc123',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/projects/frontend',
        capabilities: { skills: ['react', 'nextjs'], techStack: ['React', 'Next.js'], projectType: 'fullstack' },
      });
      expect(updated.status).toBe('online');

      const agents = db.getRoomAgents(room.id);
      expect(agents).toHaveLength(1);
    });

    it('should deregister agent', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.registerAgent({
        agentId: 'alice:abc123',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/projects/frontend',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });
      db.deregisterAgent('alice:abc123');
      const agent = db.getAgent('alice:abc123');
      expect(agent!.status).toBe('offline');
    });

    it('should update heartbeat', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.registerAgent({
        agentId: 'alice:abc123',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/projects/frontend',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });

      const agent = db.getAgent('alice:abc123')!;
      expect(agent.last_heartbeat).toBeDefined();

      db.updateHeartbeat('alice:abc123');
      const updated = db.getAgent('alice:abc123')!;
      expect(updated.last_heartbeat).toBeDefined();
    });

    it('should detect stale agents', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.registerAgent({
        agentId: 'alice:abc123',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/projects/frontend',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });

      const fresh = db.getStaleAgents(90_000);
      expect(fresh).toHaveLength(0);

      // Manually set a stale heartbeat
      const staleTime = new Date(Date.now() - 120_000).toISOString();
      const dbAny = (db as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      dbAny.prepare("UPDATE agents SET last_heartbeat = ? WHERE id = ?").run(staleTime, 'alice:abc123');

      const stale = db.getStaleAgents(90_000);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe('alice:abc123');
    });

    it('should mark agents offline in batch', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.joinRoom({ roomId: room.id, clientId: 'bob@2', displayName: 'Bob' });
      db.registerAgent({
        agentId: 'agent1',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/a',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });
      db.registerAgent({
        agentId: 'agent2',
        roomId: room.id,
        clientId: 'bob@2',
        workspace: '/b',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });

      db.markAgentsOffline(['agent1', 'agent2']);
      expect(db.getAgent('agent1')!.status).toBe('offline');
      expect(db.getAgent('agent2')!.status).toBe('offline');
    });

    it('should list agents by client', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      db.registerAgent({
        agentId: 'agent1',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/a',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });
      db.registerAgent({
        agentId: 'agent2',
        roomId: room.id,
        clientId: 'alice@1',
        workspace: '/b',
        capabilities: { skills: [], techStack: [], projectType: '' },
      });

      const agents = db.getClientAgents('alice@1');
      expect(agents).toHaveLength(2);
    });
  });

  describe('isMember', () => {
    it('should check membership correctly', () => {
      const room = db.createRoom({ name: 'Test', ownerId: 'alice@1' });
      expect(db.isMember(room.id, 'alice@1')).toBe(true);
      expect(db.isMember(room.id, 'bob@2')).toBe(false);
    });
  });
});
