import { useEffect, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import type { PageViewDay, PageViewIp, DownloadLog, DownloadStats } from '../types';

export function AnalyticsTab() {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<PageViewDay[]>([]);
  const [ips, setIps] = useState<PageViewIp[]>([]);
  const [dlStats, setDlStats] = useState<DownloadStats | null>(null);
  const [dlLogs, setDlLogs] = useState<DownloadLog[]>([]);
  const [error, setError] = useState('');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useLocale();

  const load = async () => {
    try {
      const [pvRes, ipRes, dlRes] = await Promise.all([
        api.getPageViews(token!, 30) as Promise<{ days: PageViewDay[] }>,
        api.getPageViewIps(token!, 30) as Promise<{ ips: PageViewIp[] }>,
        api.getDownloads(token!, 30) as Promise<{ stats: DownloadStats; logs: DownloadLog[] }>,
      ]);
      setData(pvRes.days);
      setIps(ipRes.ips);
      setDlStats(dlRes.stats);
      setDlLogs(dlRes.logs);
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

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.analytics')}</h2>
      </div>

      <h3 className="section-title">{t('analytics.pageViewsSection')}</h3>
      <div className="page-grid">
        {[
          { label: t('analytics.today'), value: today?.views ?? 0 },
          { label: t('analytics.total30d'), value: totalViews },
          { label: t('analytics.dailyAvg'), value: dailyAvg },
          { label: t('analytics.uniqueIps'), value: ips.length },
        ].map(c => (
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

      {ips.length > 0 && (
        <div className="analytics-ip-section">
          <h3 className="section-title">{t('analytics.ipList')}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('analytics.colIp')}</th>
                <th>{t('analytics.colCount')}</th>
                <th>{t('analytics.colLastSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {ips.map(row => (
                <tr key={row.ip}>
                  <td className="mono">{row.ip}</td>
                  <td>{row.count}</td>
                  <td className="mono">{row.last_seen.replace('T', ' ').slice(0, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dlStats && (
        <div className="analytics-download-section">
          <h3 className="section-title">{t('analytics.downloadSection')}</h3>
          <div className="page-grid">
            {[
              { label: t('analytics.dlTotal'), value: dlStats.total },
              { label: t('analytics.dlUniqueIps'), value: dlStats.uniqueIps },
              ...dlStats.byVersion.map(v => ({ label: `v${v.version}`, value: v.count })),
            ].map(c => (
              <div key={c.label} className="stat-card">
                <div className="stat-value">{c.value.toLocaleString()}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            ))}
          </div>
          {dlLogs.length > 0 && (
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>{t('analytics.colIp')}</th>
                  <th>{t('analytics.dlFile')}</th>
                  <th>{t('analytics.dlVersion')}</th>
                  <th>{t('analytics.dlTime')}</th>
                </tr>
              </thead>
              <tbody>
                {dlLogs.map((row, i) => (
                  <tr key={i}>
                    <td className="mono">{row.ip}</td>
                    <td className="mono">{row.filename}</td>
                    <td>{row.version ?? '-'}</td>
                    <td className="mono">{row.created_at.replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
