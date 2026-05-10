import { useEffect, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import type { AdminStats } from '../types';

export function DashboardTab({ token }: { token: string }) {
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
  if (!stats) return <p>{t('dashboard.loading')}</p>;

  const cards = [
    { label: t('dashboard.totalClients'), value: stats.totalClients },
    { label: t('dashboard.onlineClients'), value: stats.onlineClients },
    { label: t('dashboard.reports24h'), value: stats.totalReports24h },
    { label: t('dashboard.activeBroadcasts'), value: stats.activeBroadcasts },
  ];

  return (
    <div className="dashboard">
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
