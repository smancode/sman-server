import { useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';
import type { ClientRecord } from '../types';

export function ClientsTab() {
  const token = useAuthStore((s) => s.token);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [error, setError] = useState('');
  useLocale();

  const load = () => {
    api.getClients(token)
      .then(data => { setClients(data as ClientRecord[]); setError(''); })
      .catch(() => setError(t('clients.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!clients.length) return <div className="empty-state"><p>{t('clients.noData')}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.clients')}</h2>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('clients.hostname')}</th>
              <th>{t('clients.ip')}</th>
              <th>{t('clients.version')}</th>
              <th>{t('clients.sessions')}</th>
              <th>{t('clients.lastSeen')}</th>
              <th>{t('clients.firstSeen')}</th>
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
    </div>
  );
}
