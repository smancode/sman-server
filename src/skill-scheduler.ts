import type { RoomDB } from './db-rooms.js';
import type { TaskDB } from './db-tasks.js';
import type { TaskEngine } from './task-engine.js';
import type { WsHub } from './ws-server.js';
import type { AgentRecord } from './types.js';

const SCHEDULE_HOUR = 3;
const SCHEDULE_MINUTE = 3;
const CHECK_INTERVAL_MS = 60_000;

export class SkillScheduler {
  private roomDB: RoomDB;
  private taskDB: TaskDB;
  private taskEngine: TaskEngine;
  private wsHub: WsHub;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRunDate: string | null = null;

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
    console.log(`[SkillScheduler] Started, will trigger at ${SCHEDULE_HOUR}:${String(SCHEDULE_MINUTE).padStart(2, '0')} daily`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const now = new Date();
    if (now.getHours() !== SCHEDULE_HOUR || now.getMinutes() !== SCHEDULE_MINUTE) return;

    const today = now.toISOString().slice(0, 10);
    if (this.lastRunDate === today) return;

    this.lastRunDate = today;
    console.log(`[SkillScheduler] Triggering skill-auto-updater dispatch for ${today}`);

    try {
      this.dispatchToAllWorkspaces();
    } catch (err) {
      console.error(`[SkillScheduler] Error: ${(err as Error).message}`);
    }
  }

  private dispatchToAllWorkspaces(): void {
    const agents = this.roomDB.getOnlineAgents();
    if (agents.length === 0) {
      console.log('[SkillScheduler] No online agents, skipping');
      return;
    }

    // Group by workspace path
    const workspaceMap = new Map<string, AgentRecord[]>();
    for (const agent of agents) {
      const list = workspaceMap.get(agent.workspace) || [];
      list.push(agent);
      workspaceMap.set(agent.workspace, list);
    }

    let dispatched = 0;
    let skipped = 0;

    for (const [workspace, wsAgents] of workspaceMap) {
      // Pick the agent with the most recent heartbeat
      const selected = wsAgents.sort((a, b) =>
        b.last_heartbeat.localeCompare(a.last_heartbeat)
      )[0];

      const result = this.dispatchSkillTask(selected);
      if (result) {
        dispatched++;
      } else {
        skipped++;
      }
    }

    console.log(`[SkillScheduler] Dispatched: ${dispatched}, Skipped: ${skipped}, Total workspaces: ${workspaceMap.size}`);
  }

  private dispatchSkillTask(agent: AgentRecord): boolean {
    // Check if agent already has a running skill-auto-updater task
    const running = this.taskDB.getActiveTaskCount(agent.id);
    if (running > 0) {
      console.log(`[SkillScheduler] Agent ${agent.id} has ${running} active tasks, skipping`);
      return false;
    }

    // Find agent's room
    const task = this.taskEngine.createTask({
      roomId: agent.room_id,
      title: 'skill-auto-updater',
      description: `Automated skill scan for workspace: ${agent.workspace}`,
      createdBy: 'system:scheduler',
      autoExecute: true,
      context: {
        type: 'skill-auto-updater',
        workspace: agent.workspace,
        triggeredBy: 'scheduler',
      },
    });

    // Transition: evaluating -> confirmed -> dispatched
    const confirmed = this.taskEngine.confirmTask(task.id, 'system:scheduler');
    if (!confirmed) {
      console.log(`[SkillScheduler] Failed to confirm task ${task.id}`);
      return false;
    }

    const result = this.taskEngine.dispatchTask(task.id, [{
      taskId: task.id,
      agentId: agent.id,
      workspace: agent.workspace,
      subtaskIds: [],
      instructions: '/skill-auto-updater',
    }], 'system:scheduler');

    if (!result) {
      console.log(`[SkillScheduler] Failed to dispatch task ${task.id}`);
      return false;
    }

    // Send dispatch message to the agent's client
    for (const assignment of result.assignments) {
      this.wsHub.sendToAgent(assignment.agent_id, {
        type: 'task.dispatched_to',
        task: result.task,
        assignment,
      });
    }

    console.log(`[SkillScheduler] Dispatched skill-auto-updater to agent ${agent.id} for ${agent.workspace}`);
    return true;
  }

  /** Force trigger (for testing / manual invocation) */
  triggerNow(): { dispatched: number; skipped: number; total: number } {
    const agents = this.roomDB.getOnlineAgents();
    if (agents.length === 0) return { dispatched: 0, skipped: 0, total: 0 };

    const workspaceMap = new Map<string, AgentRecord[]>();
    for (const agent of agents) {
      const list = workspaceMap.get(agent.workspace) || [];
      list.push(agent);
      workspaceMap.set(agent.workspace, list);
    }

    let dispatched = 0;
    let skipped = 0;

    for (const [, wsAgents] of workspaceMap) {
      const selected = wsAgents.sort((a, b) =>
        b.last_heartbeat.localeCompare(a.last_heartbeat)
      )[0];
      if (this.dispatchSkillTask(selected)) {
        dispatched++;
      } else {
        skipped++;
      }
    }

    return { dispatched, skipped, total: workspaceMap.size };
  }
}
