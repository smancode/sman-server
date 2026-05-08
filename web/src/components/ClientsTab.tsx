import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ClientRecord } from '../types';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
              <td>{formatDateTime(c.last_seen)}</td>
              <td>{formatDateTime(c.first_seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
