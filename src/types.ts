/** Client -> Server: usage report payload */
export interface ReportPayload {
  /** Unique client identifier (anonymous) */
  clientId: string;
  /** App version, e.g. "1.2.3" */
  appVersion: string;
  /** OS platform: "darwin" | "win32" | "linux" */
  platform: string;
  /** Feature usage counters */
  features: Record<string, number>;
  /** ISO 8601 timestamp from client */
  timestamp: string;
}

/** Client -> Server: broadcast query payload */
export interface BroadcastQueryPayload {
  /** Unique client identifier */
  clientId: string;
  /** App version */
  appVersion: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Client -> Server: broadcast acknowledgment */
export interface AckPayload {
  /** Unique client identifier */
  clientId: string;
  /** ID of the broadcast message being acknowledged */
  broadcastId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
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

/** Stored client record (maps to clients table, snake_case columns) */
export interface ClientRecord {
  client_id: string;
  version: string;
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
