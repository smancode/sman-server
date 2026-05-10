import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

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

  const load = useCallback(() => {
    api.getRooms(token)
      .then(data => { setRooms(data as Room[]); setError(''); })
      .catch(() => setError('Failed to load rooms'));
  }, [token]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const handleDelete = (roomId: string) => {
    if (!confirm('Delete this room?')) return;
    api.deleteRoom(token, roomId)
      .then(load)
      .catch(() => setError('Failed to delete room'));
  };

  if (error) return <p className="error">{error}</p>;
  if (!rooms.length) return <p>No rooms created yet.</p>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Description</th>
            <th>Owner</th>
            <th>Members</th>
            <th>Agents</th>
            <th>Active</th>
            <th>Created</th>
            <th>Actions</th>
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
              <td>{r.active ? 'Yes' : 'No'}</td>
              <td>{formatDateTime(r.created_at)}</td>
              <td>
                <button className="btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
