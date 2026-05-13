import { useEffect, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import type { PageViewDay } from '../types';

export function AnalyticsTab() {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<PageViewDay[]>([]);
  const [error, setError] = useState('');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useLocale();

  const load = async () => {
    try {
      const res = await api.getPageViews(token!, 30) as { days: PageViewDay[] };
      setData(res.days);
      setError('');
    } catch {
      setError(t('analytics.loadFailed'));
    }
  };

  useEffect(() => { load(); }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (data.length === 0) return <div className="loading-state">{t('analytics.noData')}</div>;

  const maxViews = Math.max(...data.map(d => d.views), 1);
  const totalViews = data.reduce((s, d) => s + d.views, 0);
  const today = data[data.length - 1];
  const dailyAvg = Math.round(totalViews / data.length);

  const cards = [
    { label: t('analytics.today'), value: today?.views ?? 0 },
    { label: t('analytics.total30d'), value: totalViews },
    { label: t('analytics.dailyAvg'), value: dailyAvg },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.analytics')}</h2>
      </div>
      <div className="page-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-value">{c.value.toLocaleString()}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="chart-container">
        <div className="chart-bars">
          {data.map((d, i) => {
            const heightPct = (d.views / maxViews) * 100;
            const isHover = hoverIdx === i;
            return (
              <div
                key={d.date}
                className="chart-bar-wrapper"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <div className="chart-bar" style={{ height: `${Math.max(heightPct, 2)}%` }}>
                  {isHover && (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-date">{d.date.slice(5)}</div>
                      <div className="chart-tooltip-value">{d.views} {t('analytics.views')}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="chart-x-labels">
          {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map(d => (
            <span key={d.date} className="chart-x-label">{d.date.slice(5)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
