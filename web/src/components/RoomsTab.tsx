import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';

interface Room {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  active: number;
  max_agents: number;
  created_at: string;
  member_count: number;
  agent_count: number;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function RoomsTab({ token }: { token: string }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useLocale();

  const load = useCallback(() => {
    api.getRooms(token)
      .then(data => { setRooms(data as Room[]); setError(''); })
      .catch(() => setError(t('rooms.loadFailed')));
  }, [token]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const handleDelete = (roomId: string) => {
    if (!confirm(t('rooms.deleteConfirm'))) return;
    api.deleteRoom(token, roomId)
      .then(load)
      .catch(() => setError(t('rooms.deleteFailed')));
  };

  if (error) return <p className="error">{error}</p>;
  if (!rooms.length) return <p>{t('rooms.noData')}</p>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('rooms.colId')}</th>
            <th>{t('rooms.colName')}</th>
            <th>{t('rooms.colDescription')}</th>
            <th>{t('rooms.colOwner')}</th>
            <th>{t('rooms.colMembers')}</th>
            <th>{t('rooms.colAgents')}</th>
            <th>{t('rooms.colActive')}</th>
            <th>{t('rooms.colCreated')}</th>
            <th>{t('rooms.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map(r => (
            <tr key={r.id}>
              <td className="mono">{r.id.slice(0, 8)}...</td>
              <td>{r.name}</td>
              <td>{r.description || '-'}</td>
              <td className="mono">{r.owner_id.slice(0, 8)}...</td>
              <td>{r.member_count ?? '-'}</td>
              <td>{r.agent_count ?? '-'}</td>
              <td>{r.active ? t('rooms.yes') : t('rooms.no')}</td>
              <td>{formatDateTime(r.created_at)}</td>
              <td>
                <button className="btn-sm btn-danger" onClick={() => handleDelete(r.id)}>{t('rooms.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
