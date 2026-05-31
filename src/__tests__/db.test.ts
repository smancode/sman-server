import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HubDB } from '../db.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let db: HubDB;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sman-test-'));
  db = new HubDB(path.join(tmpDir, 'test.db'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('HubDB', () => {
  describe('upsertClient', () => {
    it('should insert new client', () => {
      db.upsertClient({
        clientId: 'host@1.2.3.4',
        version: '1.0.0',
        username: 'host',
        hostname: 'host',
        ip: '1.2.3.4',
        activeSessions: 3,
      });
      const client = db.getClient('host@1.2.3.4');
      expect(client).toBeDefined();
      expect(client!.client_id).toBe('host@1.2.3.4');
      expect(client!.active_sessions).toBe(3);
    });

    it('should update existing client', () => {
      db.upsertClient({ clientId: 'host@1.2.3.4', version: '1.0', username: 'host', hostname: 'host', ip: '1.2.3.4', activeSessions: 1 });
      db.upsertClient({ clientId: 'host@1.2.3.4', version: '1.1', username: 'host', hostname: 'host', ip: '1.2.3.4', activeSessions: 5 });
      const client = db.getClient('host@1.2.3.4');
      expect(client!.version).toBe('1.1');
      expect(client!.active_sessions).toBe(5);
    });
  });

  describe('insertReport', () => {
    it('should insert and query reports', () => {
      db.upsertClient({ clientId: 'host@1.2.3.4', version: '1.0', username: 'host', hostname: 'host', ip: '1.2.3.4', activeSessions: 0 });
      db.insertReport({ clientId: 'host@1.2.3.4', reportTime: '2026-05-08T14:00:00Z', activeSessions: 3 });
      const reports = db.getReportsByClientId('host@1.2.3.4');
      expect(reports).toHaveLength(1);
      expect(reports[0].active_sessions).toBe(3);
    });
  });

  describe('broadcasts', () => {
    it('should CRUD broadcasts', () => {
      db.createBroadcast({ id: 'bc_001', title: 'Test', body: 'Hello', createdAt: '2026-05-08T10:00:00Z' });
      let bcs = db.getActiveBroadcasts();
      expect(bcs).toHaveLength(1);
      expect(bcs[0].title).toBe('Test');

      db.deactivateBroadcast('bc_001');
      bcs = db.getActiveBroadcasts();
      expect(bcs).toHaveLength(0);
    });

    it('should get broadcasts since a given time', () => {
      db.createBroadcast({ id: 'bc_001', title: 'Old', body: 'Old', createdAt: '2026-05-07T10:00:00Z' });
      db.createBroadcast({ id: 'bc_002', title: 'New', body: 'New', createdAt: '2026-05-08T10:00:00Z' });
      const since = db.getBroadcastsSince('2026-05-08T00:00:00Z');
      expect(since).toHaveLength(1);
      expect(since[0].id).toBe('bc_002');
    });
  });

  describe('readLog', () => {
    it('should mark broadcasts as read', () => {
      db.upsertClient({ clientId: 'host@1.2.3.4', version: '1.0', username: 'host', hostname: 'host', ip: '1.2.3.4', activeSessions: 0 });
      db.createBroadcast({ id: 'bc_001', title: 'T', body: 'B', createdAt: '2026-05-08T10:00:00Z' });
      db.markAsRead({ clientId: 'host@1.2.3.4', broadcastId: 'bc_001' });
      const readIds = db.getReadBroadcastIds('host@1.2.3.4');
      expect(readIds).toContain('bc_001');
    });
  });

  describe('stats', () => {
    it('should return admin stats', () => {
      db.upsertClient({ clientId: 'a@1', version: '1.0', username: 'a', hostname: 'a', ip: '1', activeSessions: 2 });
      db.upsertClient({ clientId: 'b@2', version: '1.0', username: 'b', hostname: 'b', ip: '2', activeSessions: 0 });
      const stats = db.getStats();
      expect(stats.totalClients).toBe(2);
    });
  });

  describe('achievement_leaderboard_log', () => {
    it('should log on first push', () => {
      db.upsertAchievementEntry({
        agentId: 'agent-1', agentName: 'Alice', totalPoints: 100,
        totalUnlocked: 5, level: 'silver', tierCounts: '{}', dimensionScores: '{}',
      });
      const logs = db.getAchievementLogs('agent-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].totalPoints).toBe(100);
      expect(logs[0].changedFields).toBe('[]'); // first push, no previous to compare
    });

    it('should not log when data is unchanged', () => {
      const params = {
        agentId: 'agent-1', agentName: 'Alice', totalPoints: 100,
        totalUnlocked: 5, level: 'silver', tierCounts: '{}', dimensionScores: '{}',
      };
      db.upsertAchievementEntry(params);
      db.upsertAchievementEntry(params); // same data again
      const logs = db.getAchievementLogs('agent-1');
      expect(logs).toHaveLength(1); // only the first push log
    });

    it('should log when fields change', () => {
      db.upsertAchievementEntry({
        agentId: 'agent-1', agentName: 'Alice', totalPoints: 100,
        totalUnlocked: 5, level: 'silver', tierCounts: '{}', dimensionScores: '{}',
      });
      db.upsertAchievementEntry({
        agentId: 'agent-1', agentName: 'Alice', totalPoints: 200,
        totalUnlocked: 8, level: 'gold', tierCounts: '{}', dimensionScores: '{}',
      });
      const logs = db.getAchievementLogs('agent-1');
      expect(logs).toHaveLength(2);
      // second log should record which fields changed
      const changed = JSON.parse(logs[1].changedFields);
      expect(changed).toContain('total_points');
      expect(changed).toContain('total_unlocked');
      expect(changed).toContain('level');
    });

    it('should update main table regardless of change', () => {
      db.upsertAchievementEntry({
        agentId: 'agent-1', agentName: 'Alice', totalPoints: 100,
        totalUnlocked: 5, level: 'silver', tierCounts: '{}', dimensionScores: '{}',
      });
      db.upsertAchievementEntry({
        agentId: 'agent-1', agentName: 'Alice', totalPoints: 100,
        totalUnlocked: 5, level: 'silver', tierCounts: '{}', dimensionScores: '{}',
      });
      const entries = db.getLeaderboard();
      expect(entries).toHaveLength(1);
      expect(entries[0].totalPoints).toBe(100);
    });
  });

  describe('hub_settings', () => {
    it('should return default value for stardom_dev_mode', () => {
      const val = db.getSetting('stardom_dev_mode');
      expect(val).toBe('0');
    });

    it('should update and retrieve setting', () => {
      db.setSetting('stardom_dev_mode', '1');
      expect(db.getSetting('stardom_dev_mode')).toBe('1');
    });

    it('should return undefined for unknown key', () => {
      expect(db.getSetting('nonexistent')).toBeUndefined();
    });
  });
});
