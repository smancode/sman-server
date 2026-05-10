import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import type { ClientRecord } from '../types';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function ClientsTab({ token }: { token: string }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useLocale();

  const load = useCallback(() => {
    api.getClients(token)
      .then(data => { setClients(data as ClientRecord[]); setError(''); })
      .catch(() => setError(t('clients.loadFailed')));
  }, [token]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!clients.length) return <p>{t('clients.noData')}</p>;

  return (
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
  );
}
