import { useEffect, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import type { AdminStats } from '../types';

export function DashboardTab() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
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
      </div>
    </div>
  );
}
