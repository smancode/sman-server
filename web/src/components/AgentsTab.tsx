import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';

interface Agent {
  id: string;
  room_id: string;
  client_id: string;
  workspace: string;
  capabilities: string;
  status: string;
  max_concurrent: number;
  last_heartbeat: string;
  registered_at: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  busy: '#eab308',
  offline: '#9ca3af',
};

export function AgentsTab({ token }: { token: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useLocale();

  const load = useCallback(() => {
    api.getAgents(token)
      .then(data => { setAgents(data as Agent[]); setError(''); })
      .catch(() => setError(t('agents.loadFailed')));
  }, [token]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!agents.length) return <p>{t('agents.noData')}</p>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('agents.colStatus')}</th>
            <th>{t('agents.colId')}</th>
            <th>{t('agents.colRoom')}</th>
            <th>{t('agents.colWorkspace')}</th>
            <th>{t('agents.colCapabilities')}</th>
            <th>{t('agents.colMaxConcurrent')}</th>
            <th>{t('agents.colLastHeartbeat')}</th>
            <th>{t('agents.colRegistered')}</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(a => {
            let caps: { techStack?: string[] } = {};
            try { caps = JSON.parse(a.capabilities); } catch { /* ignore */ }
            return (
              <tr key={a.id}>
                <td>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[a.status] || '#9ca3af' }} />
                  {' '}{a.status}
                </td>
                <td className="mono">{a.id}</td>
                <td className="mono">{a.room_id.slice(0, 8)}...</td>
                <td>{a.workspace}</td>
                <td>{caps.techStack?.join(', ') || '-'}</td>
                <td>{a.max_concurrent}</td>
                <td>{formatDateTime(a.last_heartbeat)}</td>
                <td>{formatDateTime(a.registered_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
