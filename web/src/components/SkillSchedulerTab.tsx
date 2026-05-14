import { useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';

interface SchedulerStatus {
  enabled: boolean;
  lastRunDate: string | null;
  nextRun: string;
  scheduleHour: number;
  scheduleMinute: number;
}

interface DispatchLog {
  date: string;
  workspace: string;
  projectName: string;
  clientId: string;
  hostname: string;
  status: 'dispatched' | 'skipped';
  reason?: string;
}

export function SkillSchedulerTab() {
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [error, setError] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [schedHour, setSchedHour] = useState(3);
  const [schedMinute, setSchedMinute] = useState(3);
  const [savingSchedule, setSavingSchedule] = useState(false);
  useLocale();

  const load = () => {
    Promise.all([
      api.getSkillSchedulerStatus(token),
      api.getSkillSchedulerLogs(token, 200),
    ])
      .then(([s, l]) => {
        const st = s as SchedulerStatus;
        setStatus(st);
        setSchedHour(st.scheduleHour);
        setSchedMinute(st.scheduleMinute);
        setLogs((l as DispatchLog[]).reverse());
        setError('');
      })
      .catch(() => setError(t('skillScheduler.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token]);

  const handleToggle = () => {
    if (!status) return;
    setToggling(true);
    const next = !status.enabled;
    api.setSkillSchedulerEnabled(token, next)
      .then(() => {
        setStatus({ ...status, enabled: next });
      })
      .catch(() => setError(t('skillScheduler.toggleFailed')))
      .finally(() => setToggling(false));
  };

  const handleTrigger = () => {
    setTriggering(true);
    api.triggerSkillScheduler(token)
      .then((res) => {
        const r = res as { dispatched?: number; skipped?: number; total?: number; totalAgents?: number; recentAgents?: number };
        const dispatched = r.dispatched ?? 0;
        const skipped = r.skipped ?? 0;
        const total = r.total ?? 0;
        const msg = total === 0 && (r.recentAgents ?? 0) === 0
          ? `No recent agents (online: ${r.totalAgents ?? 0}, recent 1h: ${r.recentAgents ?? 0})`
          : `Dispatched: ${dispatched}, Skipped: ${skipped}, Total: ${total}`;
        alert(msg);
        load();
      })
      .catch(() => setError(t('skillScheduler.triggerFailed')))
      .finally(() => setTriggering(false));
  };

  const handleSaveSchedule = () => {
    if (schedHour < 0 || schedHour > 23 || schedMinute < 0 || schedMinute > 59) {
      alert(t('skillScheduler.scheduleInvalid'));
      return;
    }
    setSavingSchedule(true);
    api.setSkillSchedulerSchedule(token, schedHour, schedMinute)
      .then(() => {
        setStatus(s => s ? { ...s, scheduleHour: schedHour, scheduleMinute: schedMinute } : s);
        alert(t('skillScheduler.scheduleSaved'));
      })
      .catch(() => alert(t('skillScheduler.scheduleFailed')))
      .finally(() => setSavingSchedule(false));
  };

  if (error) return <p className="error">{error}</p>;

  const enabled = status?.enabled ?? false;
  const lastRun = status?.lastRunDate || '-';
  const nextRun = status?.nextRun ? formatDateTime(status.nextRun) : '-';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.skillScheduler')}</h2>
      </div>

      {/* Status card */}
      <div className="skill-scheduler-status">
        <div className="stat-card">
          <div className="stat-value">
            <span className={`badge ${enabled ? 'badge-green' : 'badge-gray'}`}>
              <span className="badge-dot" />
              {enabled ? t('skillScheduler.enabled') : t('skillScheduler.disabled')}
            </span>
          </div>
          <div className="stat-label">{t('skillScheduler.statusLabel')}</div>
          <button
            className={`btn-sm ${enabled ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? '...' : enabled ? t('skillScheduler.disable') : t('skillScheduler.enable')}
          </button>
        </div>
        <div className="stat-card">
          <div className="stat-value">{lastRun !== '-' ? formatDateTime(lastRun) : '-'}</div>
          <div className="stat-label">{t('skillScheduler.lastRun')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{nextRun}</div>
          <div className="stat-label">{t('skillScheduler.nextRun')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ marginBottom: 4 }}>{t('skillScheduler.scheduleTime')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number" min={0} max={23}
              className="input-sm"
              style={{ width: 56, textAlign: 'center' }}
              value={schedHour}
              onChange={e => setSchedHour(parseInt(e.target.value) || 0)}
            />
            <span>:</span>
            <input
              type="number" min={0} max={59}
              className="input-sm"
              style={{ width: 56, textAlign: 'center' }}
              value={schedMinute}
              onChange={e => setSchedMinute(parseInt(e.target.value) || 0)}
            />
            <button
              className="btn-sm btn-primary"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
            >
              {savingSchedule ? '...' : t('skillScheduler.scheduleSave')}
            </button>
          </div>
        </div>
        <div className="stat-card">
          <button
            className="btn-primary btn-sm"
            onClick={handleTrigger}
            disabled={triggering}
          >
            {triggering ? t('skillScheduler.triggering') : t('skillScheduler.triggerNow')}
          </button>
        </div>
      </div>

      {/* Dispatch logs */}
      <h3 className="section-title">{t('skillScheduler.dispatchHistory')}</h3>
      {!logs.length ? (
        <div className="empty-state"><p>{t('skillScheduler.noLogs')}</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('skillScheduler.colDate')}</th>
                <th>{t('skillScheduler.colProject')}</th>
                <th>{t('skillScheduler.colWorkspace')}</th>
                <th>{t('skillScheduler.colHostname')}</th>
                <th>{t('skillScheduler.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i}>
                  <td>{formatDateTime(log.date)}</td>
                  <td><strong>{log.projectName}</strong></td>
                  <td className="mono">{log.workspace}</td>
                  <td>{log.hostname}</td>
                  <td>
                    <span className={`badge ${log.status === 'dispatched' ? 'badge-green' : 'badge-yellow'}`}>
                      <span className="badge-dot" />
                      {log.status}
                    </span>
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
