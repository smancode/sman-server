import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminStats } from '../types';

export function DashboardTab({ token }: { token: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.getStats(token) as AdminStats;
      setStats(data);
      setError('');
    } catch {
      setError('Failed to load stats');
    }
  };

  useEffect(() => { load(); }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p>Loading...</p>;

  const cards = [
    { label: 'Total Clients', value: stats.totalClients },
    { label: 'Online (1h)', value: stats.onlineClients },
    { label: 'Reports (24h)', value: stats.totalReports24h },
    { label: 'Active Broadcasts', value: stats.activeBroadcasts },
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
