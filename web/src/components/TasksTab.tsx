import { useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';

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

const STATUS_BADGE: Record<string, string> = {
  queued: 'badge-yellow',
  dispatched: 'badge-blue',
  running: 'badge-green',
  completed: 'badge-gray',
  failed: 'badge-red',
  cancelled: 'badge-gray',
};

const STATUS_KEYS: Record<string, string> = {
  queued: 'tasks.statusQueued',
  dispatched: 'tasks.statusDispatched',
  running: 'tasks.statusRunning',
  completed: 'tasks.statusCompleted',
  failed: 'tasks.statusFailed',
  cancelled: 'tasks.statusCancelled',
};

export function TasksTab() {
  const token = useAuthStore((s) => s.token);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useLocale();

  const load = () => {
    api.getTasks(token, statusFilter || undefined)
      .then(data => { setTasks(data as Task[]); setError(''); })
      .catch(() => setError(t('tasks.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token, statusFilter]);

  const handleCancel = (taskId: string) => {
    if (!confirm(t('tasks.cancelConfirm'))) return;
    api.cancelTask(token, taskId)
      .then(load)
      .catch(() => setError(t('tasks.cancelFailed')));
  };

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.tasks')}</h2>
      </div>

      <div className="filter-bar">
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
        <div className="empty-state"><p>{t('tasks.noData')}</p></div>
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
              {tasks.map(task => {
                const badgeClass = STATUS_BADGE[task.status] || 'badge-gray';
                return (
                  <tr key={task.id}>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        <span className="badge-dot" />
                        {t(STATUS_KEYS[task.status] || task.status)}
                      </span>
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
                        <button className="btn-danger" onClick={() => handleCancel(task.id)}>{t('tasks.cancel')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
