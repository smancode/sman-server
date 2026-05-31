/** Client -> Server: usage report payload */
export interface ReportPayload {
  /** Unique client identifier (username@hostname) */
  clientId: string;
  /** App version */
  version: string;
  /** OS username (e.g. "nasakim") */
  username: string;
  /** Machine hostname (e.g. "nasakim-mini") */
  hostname: string;
  /** Client IP address (best effort, for display only) */
  ip: string;
  /** Number of active sessions */
  activeSessions: number;
  /** ISO 8601 report time */
  reportTime: string;
  /** Active workspace paths loaded by this client */
  workspaces?: string[];
}

/** Client -> Server: broadcast query payload */
export interface BroadcastQueryPayload {
  /** Unique client identifier */
  clientId: string;
  /** ISO 8601 timestamp - fetch broadcasts since this time */
  since: string;
}

/** Client -> Server: broadcast acknowledgment */
export interface AckPayload {
  /** Unique client identifier */
  clientId: string;
  /** IDs of broadcast messages being acknowledged */
  broadcastIds: string[];
}

/** A single broadcast message */
export interface BroadcastMessage {
  /** Unique broadcast ID */
  id: string;
  /** Message content (markdown) */
  content: string;
  /** ISO 8601 creation time */
  createdAt: string;
  /** Minimum app version to display (optional) */
  minVersion?: string;
  /** Broadcast type: "info" | "warning" | "update" */
  type: 'info' | 'warning' | 'update';
  /** Whether this broadcast requires acknowledgment */
  requireAck: boolean;
}

/** Server -> Client: broadcast query response */
export interface BroadcastResponse {
  /** List of applicable broadcasts */
  messages: BroadcastMessage[];
}

/** Wire format for encrypted request body (single base64 blob: IV + ciphertext + authTag) */
export type EncryptedPayload = string;

/** Encrypted request envelope sent by client */
export interface EncryptedRequest {
  /** Encrypted payload (base64 blob from crypto.encrypt) */
  payload: EncryptedPayload;
  /** Unix timestamp (seconds) for replay protection */
  timestamp: number;
  /** PSK version used for encryption */
  pskVersion: number;
}

/** Stored client record (maps to clients table, snake_case columns) */
export interface ClientRecord {
  client_id: string;
  version: string;
  username: string;
  hostname: string;
  ip: string;
  first_seen: string;
  last_seen: string;
  active_sessions: number;
}

/** Admin dashboard statistics */
export interface AdminStats {
  /** Total unique clients */
  totalClients: number;
  /** Clients online in the last hour */
  onlineClients: number;
  /** Total reports in the last 24 hours */
  totalReports24h: number;
  /** Active broadcast messages */
  activeBroadcasts: number;
}

// ============================================================================
// Room-based collaboration types
// ============================================================================

/** Agent status on the network */
export type AgentStatus = 'online' | 'offline' | 'busy';

/** Task lifecycle status */
export type TaskStatus = 'draft' | 'evaluating' | 'confirmed' | 'rejected' | 'dispatched' | 'running' | 'stopping' | 'completed' | 'failed' | 'cancelled' | 'queued';

/** Room role */
export type RoomRole = 'owner' | 'member';

/** Agent capabilities extracted from workspace */
export interface AgentCapabilities {
  skills: string[];
  techStack: string[];
  projectType: string;
}

/** Room record (maps to rooms table) */
export interface RoomRecord {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  visibility: 'public' | 'private';
  active: number;
  max_agents: number;
  created_at: string;
  password: string | null;
}

/** Room member record (maps to room_members table) */
export interface RoomMemberRecord {
  room_id: string;
  client_id: string;
  display_name: string;
  role: RoomRole;
  joined_at: string;
}

/** Agent record (maps to agents table) */
export interface AgentRecord {
  id: string;
  room_id: string;
  client_id: string;
  workspace: string;
  capabilities: string;
  status: AgentStatus;
  max_concurrent: number;
  last_heartbeat: string;
  registered_at: string;
}

/** Task record (maps to tasks table) */
export interface TaskRecord {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  created_by: string;
  assigned_to: string | null;
  context: string;
  result: string | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  acceptance_criteria: string | null;
  subtasks: string;
  auto_execute: number;
  git_branch: string | null;
  version: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Task event audit log (maps to task_events table) */
export interface TaskEventRecord {
  id: number;
  task_id: string;
  event: string;
  actor: string | null;
  metadata: string;
  created_at: string;
}

/** Evaluation report record (maps to evaluation_reports table) */
export interface EvaluationReportRecord {
  id: string;
  task_id: string;
  agent_id: string;
  workspace: string;
  claimed_subtasks: string;
  approach: string | null;
  complexity: string | null;
  dependencies: string;
  raw_response: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

/** Task assignment record (maps to task_assignments table) */
export interface TaskAssignmentRecord {
  id: string;
  task_id: string;
  agent_id: string;
  workspace: string;
  subtask_ids: string;
  instructions: string | null;
  report_id: string | null;
  status: 'assigned' | 'running' | 'completed' | 'failed';
  created_at: string;
}

/** WS message envelope */
export interface WsMessage {
  type: string;
  id?: string;
  roomId?: string;
  agentId?: string;
  [key: string]: unknown;
}

/** WS auth message */
export interface WsAuthMessage extends WsMessage {
  type: 'auth.psk';
  payload: EncryptedPayload;
  timestamp: number;
  pskVersion: number;
}
