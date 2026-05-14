import type { RoomDB } from './db-rooms.js';
import type { TaskDB } from './db-tasks.js';
import type { TaskEngine } from './task-engine.js';
import type { WsHub } from './ws-server.js';
import type { AgentRecord } from './types.js';

const SCHEDULE_HOUR = 3;
const SCHEDULE_MINUTE = 3;
const CHECK_INTERVAL_MS = 60_000;
const RECENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export interface DispatchLog {
  date: string;
  workspace: string;
  projectName: string;
  agentId: string;
  clientId: string;
  taskId: string;
  status: 'dispatched' | 'skipped';
  reason?: string;
}

export class SkillScheduler {
  private roomDB: RoomDB;
  private taskDB: TaskDB;
  private taskEngine: TaskEngine;
  private wsHub: WsHub;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRunDate: string | null = null;
  private enabled = true;
  private logs: DispatchLog[] = [];
  private maxLogs = 500;

  constructor(deps: {
    roomDB: RoomDB;
    taskDB: TaskDB;
    taskEngine: TaskEngine;
    wsHub: WsHub;
  }) {
    this.roomDB = deps.roomDB;
    this.taskDB = deps.taskDB;
    this.taskEngine = deps.taskEngine;
    this.wsHub = deps.wsHub;
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref();
    console.log(`[SkillScheduler] Started (enabled=${this.enabled}), schedule at ${SCHEDULE_HOUR}:${String(SCHEDULE_MINUTE).padStart(2, '0')}`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isEnabled(): boolean { return this.enabled; }

  setEnabled(v: boolean): void {
    this.enabled = v;
    console.log(`[SkillScheduler] ${v ? 'Enabled' : 'Disabled'}`);
  }

  getStatus(): { enabled: boolean; lastRunDate: string | null; nextRun: string } {
    const now = new Date();
    let next = new Date(now);
    next.setHours(SCHEDULE_HOUR, SCHEDULE_MINUTE, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return { enabled: this.enabled, lastRunDate: this.lastRunDate, nextRun: next.toISOString() };
  }

  getLogs(limit = 100): DispatchLog[] {
    return this.logs.slice(-limit);
  }

  private tick(): void {
    if (!this.enabled) return;
    const now = new Date();
    if (now.getHours() !== SCHEDULE_HOUR || now.getMinutes() !== SCHEDULE_MINUTE) return;
    const today = now.toISOString().slice(0, 10);
    if (this.lastRunDate === today) return;
    this.lastRunDate = today;
    console.log(`[SkillScheduler] Triggering for ${today}`);
    try { this.dispatchToAllWorkspaces(); } catch (err) {
      console.error(`[SkillScheduler] Error: ${(err as Error).message}`);
    }
  }

  private dispatchToAllWorkspaces(): { dispatched: number; skipped: number; total: number } {
    const agents = this.getRecentAgents();
    if (agents.length === 0) {
      console.log('[SkillScheduler] No recent agents');
      return { dispatched: 0, skipped: 0, total: 0 };
    }

    const workspaceMap = new Map<string, AgentRecord[]>();
    for (const agent of agents) {
      const list = workspaceMap.get(agent.workspace) || [];
      list.push(agent);
      workspaceMap.set(agent.workspace, list);
    }

    let dispatched = 0;
    let skipped = 0;

    for (const [workspace, wsAgents] of workspaceMap) {
      const selected = wsAgents.sort((a, b) =>
        b.last_heartbeat.localeCompare(a.last_heartbeat)
      )[0];
      const projectName = workspace.split(/[/\\]/).pop() || workspace;
      const ok = this.dispatchSkillTask(selected);
      this.addLog({
        date: new Date().toISOString(),
        workspace,
        projectName,
        agentId: selected.id,
        clientId: selected.client_id,
        taskId: '',
        status: ok ? 'dispatched' : 'skipped',
        reason: ok ? undefined : 'agent busy or dispatch failed',
      });
      if (ok) dispatched++; else skipped++;
    }

    console.log(`[SkillScheduler] Dispatched: ${dispatched}, Skipped: ${skipped}, Total: ${workspaceMap.size}`);
    return { dispatched, skipped, total: workspaceMap.size };
  }

  /** Get agents with heartbeat within 1 hour */
  private getRecentAgents(): AgentRecord[] {
    const cutoff = new Date(Date.now() - RECENT_THRESHOLD_MS).toISOString();
    return this.roomDB.getRecentAgents(cutoff);
  }

  private dispatchSkillTask(agent: AgentRecord): boolean {
    const running = this.taskDB.getActiveTaskCount(agent.id);
    if (running > 0) return false;

    const task = this.taskEngine.createTask({
      roomId: agent.room_id,
      title: 'skill-auto-updater',
      description: `Automated skill scan for workspace: ${agent.workspace}`,
      createdBy: 'system:scheduler',
      autoExecute: true,
      context: { type: 'skill-auto-updater', workspace: agent.workspace, triggeredBy: 'scheduler' },
    });

    const confirmed = this.taskEngine.confirmTask(task.id, 'system:scheduler');
    if (!confirmed) return false;

    const result = this.taskEngine.dispatchTask(task.id, [{
      taskId: task.id,
      agentId: agent.id,
      workspace: agent.workspace,
      subtaskIds: [],
      instructions: '/skill-auto-updater',
    }], 'system:scheduler');

    if (!result) return false;

    for (const assignment of result.assignments) {
      this.wsHub.sendToAgent(assignment.agent_id, {
        type: 'task.dispatched_to',
        task: result.task,
        assignment,
      });
    }

    // Update log with taskId
    const lastLog = this.logs[this.logs.length - 1];
    if (lastLog) lastLog.taskId = task.id;

    return true;
  }

  /** Manual trigger */
  triggerNow(): { dispatched: number; skipped: number; total: number } {
    return this.dispatchToAllWorkspaces();
  }

  private addLog(log: DispatchLog): void {
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
}
