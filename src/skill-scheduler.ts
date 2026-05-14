import type { HubDB } from './db.js';

const DEFAULT_SCHEDULE_HOUR = 3;
const DEFAULT_SCHEDULE_MINUTE = 3;
const CHECK_INTERVAL_MS = 60_000;
const RECENT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface DispatchLog {
  date: string;
  workspace: string;
  projectName: string;
  clientId: string;
  hostname: string;
  status: 'dispatched' | 'skipped';
  reason?: string;
}

/**
 * SkillScheduler: marks skill-auto-updater commands for online clients.
 *
 * Flow:
 * 1. Scheduler ticks at scheduled time → finds all active workspaces via HubDB
 * 2. For each workspace, picks one online client → adds to `pendingCommands` map
 * 3. When client reports heartbeat (every 15 min), server returns pending commands
 * 4. Client executes skill-auto-updater locally
 *
 * No WebSocket, no agent registration needed.
 */
export class SkillScheduler {
  private db: HubDB;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRunDate: string | null = null;
  private enabled = true;
  private logs: DispatchLog[] = [];
  private maxLogs = 500;
  private scheduleHour: number;
  private scheduleMinute: number;
  /** clientId → workspaces that need skill-auto-updater */
  private pendingCommands = new Map<string, string[]>();

  constructor(deps: {
    db: HubDB;
    scheduleHour?: number;
    scheduleMinute?: number;
  }) {
    this.db = deps.db;
    this.scheduleHour = deps.scheduleHour ?? DEFAULT_SCHEDULE_HOUR;
    this.scheduleMinute = deps.scheduleMinute ?? DEFAULT_SCHEDULE_MINUTE;
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref();
    console.log(`[SkillScheduler] Started (enabled=${this.enabled}), schedule at ${this.scheduleHour}:${String(this.scheduleMinute).padStart(2, '0')}`);
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

  setSchedule(hour: number, minute: number): void {
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error('Invalid schedule time');
    }
    this.scheduleHour = hour;
    this.scheduleMinute = minute;
    console.log(`[SkillScheduler] Schedule updated to ${hour}:${String(minute).padStart(2, '0')}`);
  }

  getStatus(): { enabled: boolean; lastRunDate: string | null; nextRun: string; scheduleHour: number; scheduleMinute: number } {
    const now = new Date();
    let next = new Date(now);
    next.setHours(this.scheduleHour, this.scheduleMinute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return { enabled: this.enabled, lastRunDate: this.lastRunDate, nextRun: next.toISOString(), scheduleHour: this.scheduleHour, scheduleMinute: this.scheduleMinute };
  }

  getLogs(limit = 100): DispatchLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Called by report route — returns pending workspaces for this client,
   * and clears them (one-shot command).
   */
  getCommands(clientId: string): string[] {
    const workspaces = this.pendingCommands.get(clientId);
    if (!workspaces) return [];
    this.pendingCommands.delete(clientId);
    return workspaces;
  }

  private tick(): void {
    if (!this.enabled) return;
    const now = new Date();
    if (now.getHours() !== this.scheduleHour || now.getMinutes() !== this.scheduleMinute) return;
    const today = now.toISOString().slice(0, 10);
    if (this.lastRunDate === today) return;
    this.lastRunDate = today;
    console.log(`[SkillScheduler] Triggering for ${today}`);
    try { this.dispatchToAllWorkspaces(); } catch (err) {
      console.error(`[SkillScheduler] Error: ${(err as Error).message}`);
    }
  }

  private dispatchToAllWorkspaces(): { dispatched: number; skipped: number; total: number } {
    const cutoff = new Date(Date.now() - RECENT_THRESHOLD_MS).toISOString();
    const activeWorkspaces = this.db.getActiveWorkspaces(cutoff);

    if (activeWorkspaces.length === 0) {
      console.log('[SkillScheduler] No active workspaces');
      return { dispatched: 0, skipped: 0, total: 0 };
    }

    let dispatched = 0;
    let skipped = 0;

    for (const { workspace, clients } of activeWorkspaces) {
      const selected = clients[0];
      const projectName = workspace.split(/[/\\]/).pop() || workspace;

      // Add to pending commands for this client
      const existing = this.pendingCommands.get(selected.clientId) || [];
      if (!existing.includes(workspace)) {
        existing.push(workspace);
      }
      this.pendingCommands.set(selected.clientId, existing);

      this.addLog({
        date: new Date().toISOString(),
        workspace,
        projectName,
        clientId: selected.clientId,
        hostname: selected.hostname,
        status: 'dispatched',
      });
      dispatched++;
    }

    console.log(`[SkillScheduler] Queued: ${dispatched}, Total workspaces: ${activeWorkspaces.length}`);
    return { dispatched, skipped, total: activeWorkspaces.length };
  }

  /** Manual trigger */
  triggerNow(): { dispatched: number; skipped: number; total: number } {
    console.log('[SkillScheduler] Manual trigger');
    return this.dispatchToAllWorkspaces();
  }

  private addLog(log: DispatchLog): void {
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
}
