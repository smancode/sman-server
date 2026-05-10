import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskDB } from '../db-tasks.js';
import { TaskEngine } from '../task-engine.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let taskDB: TaskDB;
let engine: TaskEngine;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sman-tasks-test-'));
  taskDB = new TaskDB(path.join(tmpDir, 'test-tasks.db'));
  engine = new TaskEngine(taskDB);
});

afterEach(() => {
  taskDB.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('TaskDB', () => {
  it('should create task', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'Test task', createdBy: 'alice@1' });
    expect(task).toBeDefined();
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('queued');
    expect(task.room_id).toBe('room1');
  });

  it('should transition queued -> dispatched -> running -> completed', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });

    const dispatched = taskDB.transitionStatus(task.id, 'dispatched', 'agent1');
    expect(dispatched!.status).toBe('dispatched');

    const running = taskDB.transitionStatus(task.id, 'running', 'agent1');
    expect(running!.status).toBe('running');

    const completed = taskDB.transitionStatus(task.id, 'completed', 'agent1');
    expect(completed!.status).toBe('completed');
    expect(completed!.completed_at).toBeDefined();
  });

  it('should reject invalid transitions', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    const result = taskDB.transitionStatus(task.id, 'completed', 'agent1');
    expect(result).toBeNull();
  });

  it('should claim task atomically', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    const claimed = taskDB.claimTask(task.id, 'agent1', 2);
    expect(claimed).toBeDefined();
    expect(claimed!.status).toBe('dispatched');
    expect(claimed!.assigned_to).toBe('agent1');
  });

  it('should reject claim when max concurrent reached', () => {
    const t1 = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    const t2 = taskDB.createTask({ roomId: 'room1', title: 'T2', createdBy: 'alice@1' });
    const t3 = taskDB.createTask({ roomId: 'room1', title: 'T3', createdBy: 'alice@1' });

    taskDB.claimTask(t1.id, 'agent1', 2);
    taskDB.transitionStatus(t1.id, 'running', 'agent1');
    taskDB.claimTask(t2.id, 'agent1', 2);

    const third = taskDB.claimTask(t3.id, 'agent1', 2);
    expect(third).toBeNull();
  });

  it('should cancel from queued', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    const cancelled = taskDB.transitionStatus(task.id, 'cancelled', 'alice@1');
    expect(cancelled!.status).toBe('cancelled');
  });

  it('should auto-retry from failed', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    taskDB.claimTask(task.id, 'agent1', 2);
    taskDB.transitionStatus(task.id, 'running', 'agent1');
    taskDB.setError(task.id, 'runtime_offline');

    const retried = taskDB.transitionStatus(task.id, 'failed', 'agent1');
    expect(retried!.status).toBe('failed');
  });

  it('should track events', () => {
    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    taskDB.transitionStatus(task.id, 'dispatched', 'agent1');
    taskDB.transitionStatus(task.id, 'running', 'agent1');

    const events = taskDB.getTaskEvents(task.id);
    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('created');
    expect(events[1].event).toBe('claimed');
    expect(events[2].event).toBe('started');
  });

  it('should list tasks by room and status', () => {
    taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    taskDB.createTask({ roomId: 'room1', title: 'T2', createdBy: 'alice@1' });
    taskDB.createTask({ roomId: 'room2', title: 'T3', createdBy: 'bob@2' });

    const r1 = taskDB.listRoomTasks('room1');
    expect(r1).toHaveLength(2);

    const queued = taskDB.listRoomTasks('room1', 'queued');
    expect(queued).toHaveLength(2);
  });

  it('should track hasQueuedTasks with cache', () => {
    expect(taskDB.hasQueuedTasks('room1')).toBe(false);

    const task = taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    expect(taskDB.hasQueuedTasks('room1')).toBe(true);

    taskDB.claimTask(task.id, 'agent1', 2);
    expect(taskDB.hasQueuedTasks('room1')).toBe(false);
  });

  it('should return stats', () => {
    taskDB.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    taskDB.createTask({ roomId: 'room1', title: 'T2', createdBy: 'alice@1' });

    const t1 = taskDB.createTask({ roomId: 'room1', title: 'T3', createdBy: 'alice@1' });
    taskDB.claimTask(t1.id, 'agent1', 5);
    taskDB.transitionStatus(t1.id, 'running', 'agent1');

    const stats = taskDB.getStats('room1');
    expect(stats.total).toBe(3);
    expect(stats.queued).toBe(2);
    expect(stats.running).toBe(1);
  });
});

describe('TaskEngine', () => {
  it('should complete full lifecycle', () => {
    const task = engine.createTask({ roomId: 'room1', title: 'Test', createdBy: 'alice@1' });
    expect(task.status).toBe('queued');

    const claimed = engine.claimTask(task.id, 'agent1', 2);
    expect(claimed!.status).toBe('dispatched');

    const started = engine.startTask(task.id, 'agent1');
    expect(started!.status).toBe('running');

    const completed = engine.completeTask(task.id, 'agent1', 'Done!');
    expect(completed!.status).toBe('completed');
  });

  it('should auto-retry infra failures', () => {
    const task = engine.createTask({ roomId: 'room1', title: 'Test', createdBy: 'alice@1' });
    engine.claimTask(task.id, 'agent1', 2);
    engine.startTask(task.id, 'agent1');

    const failed = engine.failTask(task.id, 'agent1', 'runtime_offline: connection lost');
    expect(failed!.status).toBe('queued');
    expect(failed!.retry_count).toBe(1);
  });

  it('should NOT auto-retry agent logic errors', () => {
    const task = engine.createTask({ roomId: 'room1', title: 'Test', createdBy: 'alice@1' });
    engine.claimTask(task.id, 'agent1', 2);
    engine.startTask(task.id, 'agent1');

    const failed = engine.failTask(task.id, 'agent1', 'SyntaxError: unexpected token');
    expect(failed!.status).toBe('failed');
  });

  it('should reject origin chain too deep', () => {
    expect(() => {
      engine.createTask({
        roomId: 'room1',
        title: 'Deep',
        createdBy: 'alice@1',
        context: { originChain: ['a', 'b', 'c', 'd', 'e'] },
      });
    }).toThrow('origin chain too deep');
  });

  it('should cancel task', () => {
    const task = engine.createTask({ roomId: 'room1', title: 'Test', createdBy: 'alice@1' });
    const cancelled = engine.cancelTask(task.id, 'alice@1');
    expect(cancelled!.status).toBe('cancelled');
  });

  it('should report progress', () => {
    const task = engine.createTask({ roomId: 'room1', title: 'Test', createdBy: 'alice@1' });
    engine.claimTask(task.id, 'agent1', 2);
    engine.startTask(task.id, 'agent1');
    engine.reportProgress(task.id, 'agent1', 'Step 1 done');

    const events = taskDB.getTaskEvents(task.id);
    const progressEvent = events.find(e => e.event === 'progress');
    expect(progressEvent).toBeDefined();
  });

  it('should get task detail with events', () => {
    const task = engine.createTask({ roomId: 'room1', title: 'Test', createdBy: 'alice@1' });
    const detail = engine.getTaskDetail(task.id);
    expect(detail).toBeDefined();
    expect(detail!.task.id).toBe(task.id);
    expect(detail!.events.length).toBeGreaterThan(0);
  });

  it('should respect max concurrent on claim', () => {
    const t1 = engine.createTask({ roomId: 'room1', title: 'T1', createdBy: 'alice@1' });
    const t2 = engine.createTask({ roomId: 'room1', title: 'T2', createdBy: 'alice@1' });

    const c1 = engine.claimTask(t1.id, 'agent1', 1);
    expect(c1).toBeDefined();

    const c2 = engine.claimTask(t2.id, 'agent1', 1);
    expect(c2).toBeNull();
  });
});
