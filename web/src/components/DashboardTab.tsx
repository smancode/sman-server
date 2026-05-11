import { useEffect, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import type { AdminStats } from '../types';

export function DashboardTab() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [stardomDev, setStardomDev] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);
  useLocale();

  const load = async () => {
    try {
      const data = await api.getStats(token) as AdminStats;
      setStats(data);
      setError('');
    } catch {
      setError(t('dashboard.loadFailed'));
    }
  };

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await api.getStardomDevMode(token) as { enabled: boolean };
        setStardomDev(data.enabled);
      } catch { /* ignore */ }
    })();
  }, [token]);

  const handleToggleStardom = async (enabled: boolean) => {
    setLoadingToggle(true);
    try {
      await api.setStardomDevMode(token!, enabled);
      setStardomDev(enabled);
    } catch { /* ignore */ }
    setLoadingToggle(false);
  };

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <div className="loading-state">{t('dashboard.loading')}</div>;

  const cards = [
    { label: t('dashboard.totalClients'), value: stats.totalClients },
    { label: t('dashboard.onlineClients'), value: stats.onlineClients },
    { label: t('dashboard.reports24h'), value: stats.totalReports24h },
    { label: t('dashboard.activeBroadcasts'), value: stats.activeBroadcasts },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.dashboard')}</h2>
      </div>
      <div className="page-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
        <div className="stat-card" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t('dashboard.stardomDevMode')}</div>
            <div style={{ fontSize: '0.8em', opacity: 0.6 }}>{t('dashboard.stardomDevModeHint')}</div>
          </div>
          <button
            className={`btn ${stardomDev ? 'btn-primary' : 'btn-secondary'}`}
            disabled={loadingToggle}
            onClick={() => handleToggleStardom(!stardomDev)}
          >
            {stardomDev ? t('broadcast.active') : t('broadcast.inactive')}
          </button>
        </div>
      </div>
    </div>
  );
}
