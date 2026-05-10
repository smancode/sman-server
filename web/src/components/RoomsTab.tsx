import { useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';

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

export function RoomsTab() {
  const token = useAuthStore((s) => s.token);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  useLocale();

  const load = () => {
    api.getRooms(token)
      .then(data => { setRooms(data as Room[]); setError(''); })
      .catch(() => setError(t('rooms.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token]);

  const handleDelete = (roomId: string) => {
    if (!confirm(t('rooms.deleteConfirm'))) return;
    api.deleteRoom(token, roomId)
      .then(load)
      .catch(() => setError(t('rooms.deleteFailed')));
  };

  if (error) return <p className="error">{error}</p>;
  if (!rooms.length) return <div className="empty-state"><p>{t('rooms.noData')}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.rooms')}</h2>
      </div>
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
                <td>
                  {r.active
                    ? <span className="badge badge-green"><span className="badge-dot" />{t('rooms.active')}</span>
                    : <span className="badge badge-gray">{t('rooms.inactive')}</span>
                  }
                </td>
                <td>{formatDateTime(r.created_at)}</td>
                <td>
                  <button className="btn-danger" onClick={() => handleDelete(r.id)}>{t('rooms.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
