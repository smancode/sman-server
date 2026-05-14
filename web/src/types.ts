export interface AdminStats {
  totalClients: number;
  onlineClients: number;
  totalReports24h: number;
  activeBroadcasts: number;
}

export interface ClientRecord {
  client_id: string;
  version: string;
  hostname: string;
  ip: string;
  first_seen: string;
  last_seen: string;
  active_sessions: number;
  workspaces?: string[];
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  created_at: string;
  active: number;
}

export interface PageViewDay {
  date: string;
  views: number;
}

export interface PageViewIp {
  ip: string;
  count: number;
  last_seen: string;
}

export interface DownloadLog {
  ip: string;
  filename: string;
  version: string | null;
  created_at: string;
}

export interface DownloadStats {
  total: number;
  uniqueIps: number;
  byVersion: { version: string; count: number }[];
}
