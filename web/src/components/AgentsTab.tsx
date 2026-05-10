import { useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';

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

const STATUS_BADGE: Record<string, string> = {
  online: 'badge-green',
  busy: 'badge-yellow',
  offline: 'badge-gray',
};

export function AgentsTab() {
  const token = useAuthStore((s) => s.token);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  useLocale();

  const load = () => {
    api.getAgents(token)
      .then(data => { setAgents(data as Agent[]); setError(''); })
      .catch(() => setError(t('agents.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!agents.length) return <div className="empty-state"><p>{t('agents.noData')}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.agents')}</h2>
      </div>
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
              const badgeClass = STATUS_BADGE[a.status] || 'badge-gray';
              return (
                <tr key={a.id}>
                  <td>
                    <span className={`badge ${badgeClass}`}>
                      <span className="badge-dot" />
                      {a.status}
                    </span>
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
    </div>
  );
}
