import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';

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

const STATUS_KEYS: Record<string, string> = {
  queued: 'tasks.statusQueued',
  dispatched: 'tasks.statusDispatched',
  running: 'tasks.statusRunning',
  completed: 'tasks.statusCompleted',
  failed: 'tasks.statusFailed',
  cancelled: 'tasks.statusCancelled',
};

export function TasksTab({ token }: { token: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useLocale();

  const load = useCallback(() => {
    api.getTasks(token, statusFilter || undefined)
      .then(data => { setTasks(data as Task[]); setError(''); })
      .catch(() => setError(t('tasks.loadFailed')));
  }, [token, statusFilter]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const handleCancel = (taskId: string) => {
    if (!confirm(t('tasks.cancelConfirm'))) return;
    api.cancelTask(token, taskId)
      .then(load)
      .catch(() => setError(t('tasks.cancelFailed')));
  };

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>{t('tasks.filterLabel')}</label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('tasks.filterAll')}</option>
          <option value="queued">{t('tasks.statusQueued')}</option>
          <option value="dispatched">{t('tasks.statusDispatched')}</option>
          <option value="running">{t('tasks.statusRunning')}</option>
          <option value="completed">{t('tasks.statusCompleted')}</option>
          <option value="failed">{t('tasks.statusFailed')}</option>
          <option value="cancelled">{t('tasks.statusCancelled')}</option>
        </select>
      </div>
      {!tasks.length ? (
        <p>{t('tasks.noData')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('tasks.colStatus')}</th>
                <th>{t('tasks.colTitle')}</th>
                <th>{t('tasks.colRoom')}</th>
                <th>{t('tasks.colAssignedTo')}</th>
                <th>{t('tasks.colRetries')}</th>
                <th>{t('tasks.colStarted')}</th>
                <th>{t('tasks.colCompleted')}</th>
                <th>{t('tasks.colCreated')}</th>
                <th>{t('tasks.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[task.status] || '#9ca3af' }} />
                    {' '}{t(STATUS_KEYS[task.status] || task.status)}
                  </td>
                  <td>{task.title}</td>
                  <td className="mono">{task.room_id.slice(0, 8)}...</td>
                  <td>{task.assigned_to ? task.assigned_to.slice(0, 12) : '-'}</td>
                  <td>{task.retry_count}/{task.max_retries}</td>
                  <td>{formatDateTime(task.started_at)}</td>
                  <td>{formatDateTime(task.completed_at)}</td>
                  <td>{formatDateTime(task.created_at)}</td>
                  <td>
                    {(task.status === 'queued' || task.status === 'dispatched') && (
                      <button className="btn-sm btn-danger" onClick={() => handleCancel(task.id)}>{t('tasks.cancel')}</button>
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
