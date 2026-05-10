import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface Task {
  id: string;
  room_id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  created_by: string;
  assigned_to: string | null;
  retry_count: number;
  max_retries: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const STATUS_COLORS: Record<string, string> = {
  queued: '#eab308',
  dispatched: '#3b82f6',
  running: '#22c55e',
  completed: '#6b7280',
  failed: '#ef4444',
  cancelled: '#9ca3af',
};

export function TasksTab({ token }: { token: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const load = useCallback(() => {
    api.getTasks(token, statusFilter || undefined)
      .then(data => { setTasks(data as Task[]); setError(''); })
      .catch(() => setError('Failed to load tasks'));
  }, [token, statusFilter]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const handleCancel = (taskId: string) => {
    if (!confirm('Cancel this task?')) return;
    api.cancelTask(token, taskId)
      .then(load)
      .catch(() => setError('Failed to cancel task'));
  };

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>Filter by status:</label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="queued">Queued</option>
          <option value="dispatched">Dispatched</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {!tasks.length ? (
        <p>No tasks found.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Title</th>
                <th>Room</th>
                <th>Assigned To</th>
                <th>Retries</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[t.status] || '#9ca3af' }} />
                    {' '}{t.status}
                  </td>
                  <td>{t.title}</td>
                  <td className="mono">{t.room_id.slice(0, 8)}...</td>
                  <td>{t.assigned_to ? t.assigned_to.slice(0, 12) : '-'}</td>
                  <td>{t.retry_count}/{t.max_retries}</td>
                  <td>{formatDateTime(t.started_at)}</td>
                  <td>{formatDateTime(t.completed_at)}</td>
                  <td>{formatDateTime(t.created_at)}</td>
                  <td>
                    {(t.status === 'queued' || t.status === 'dispatched') && (
                      <button className="btn-sm btn-danger" onClick={() => handleCancel(t.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
