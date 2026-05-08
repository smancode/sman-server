import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ClientRecord } from '../types';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ClientsTab({ token }: { token: string }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getClients(token)
      .then(data => setClients(data as ClientRecord[]))
      .catch(() => setError('Failed to load clients'));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!clients.length) return <p>No clients registered yet.</p>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Hostname</th>
            <th>IP</th>
            <th>Version</th>
            <th>Sessions</th>
            <th>Last Seen</th>
            <th>First Seen</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.client_id}>
              <td>{c.hostname}</td>
              <td className="mono">{c.ip}</td>
              <td>{c.version}</td>
              <td>{c.active_sessions}</td>
              <td title={c.last_seen}>{formatRelative(c.last_seen)}</td>
              <td title={c.first_seen}>{formatRelative(c.first_seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
