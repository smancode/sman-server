import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  totalPoints: number;
  totalUnlocked: number;
  level: string;
  tierCounts: string;
  dimensionScores: string;
  updatedAt: string;
}

interface PageData {
  entries: LeaderboardEntry[];
  total: number;
}

const DIMENSIONS = [
  { key: 'total', labelKey: 'leaderboard.dimTotal' },
  { key: 'sessions', labelKey: 'leaderboard.dimSessions' },
  { key: 'messages', labelKey: 'leaderboard.dimMessages' },
  { key: 'tokens', labelKey: 'leaderboard.dimTokens' },
  { key: 'cron_jobs', labelKey: 'leaderboard.dimCronJobs' },
  { key: 'earth_path', labelKey: 'leaderboard.dimEarthPath' },
  { key: 'bot_sessions', labelKey: 'leaderboard.dimBotSessions' },
  { key: 'bot_messages', labelKey: 'leaderboard.dimBotMessages' },
  { key: 'bot_count', labelKey: 'leaderboard.dimBotCount' },
  { key: 'streak', labelKey: 'leaderboard.dimStreak' },
] as const;

function getDimValue(dimensionScores: string, key: string): number {
  if (key === 'total') return 0;
  try {
    const obj = JSON.parse(dimensionScores);
    return obj[key] ?? 0;
  } catch {
    return 0;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function LeaderboardTab() {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('total');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;
  useLocale();

  const load = useCallback((p: number, sort: string, s: string) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize), sortBy: sort });
    if (s) params.set('search', s);
    api.getLeaderboard(token, params)
      .then((d) => { setData(d as PageData); setLoading(false); })
      .catch(() => { setError(t('leaderboard.loadFailed')); setLoading(false); });
  }, [token]);

  const handleLoad = useCallback(() => {
    load(page, sortBy, search);
  }, [load, page, sortBy, search]);

  // Load on mount
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      load(1, 'total', '');
    }
  }, [load]);

  const handleSortChange = (key: string) => {
    setSortBy(key);
    setPage(1);
    load(1, key, search);
  };

  const handleSearch = () => {
    setPage(1);
    load(1, sortBy, search);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    load(newPage, sortBy, search);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const activeDim = DIMENSIONS.find(d => d.key === sortBy) ?? DIMENSIONS[0];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">
          {t('leaderboard.title')}
          {data ? <span className="page-count">({data.total})</span> : null}
        </h2>
      </div>

      <div className="leaderboard-dims">
        {DIMENSIONS.map(dim => (
          <button
            key={dim.key}
            className={`leaderboard-dim-btn ${sortBy === dim.key ? 'active' : ''}`}
            onClick={() => handleSortChange(dim.key)}
          >
            {t(dim.labelKey)}
          </button>
        ))}
      </div>

      <div className="leaderboard-search-bar">
        <input
          className="leaderboard-search-input"
          type="text"
          placeholder={t('leaderboard.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
        />
        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {t('leaderboard.search')}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && !data ? (
        <div className="loading-state">{t('dashboard.loading')}</div>
      ) : !data?.entries.length ? (
        <div className="empty-state"><p>{t('leaderboard.noData')}</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('leaderboard.colName')}</th>
                  <th>{t('leaderboard.colLevel')}</th>
                  {sortBy !== 'total' && (
                    <th className="leaderboard-active-col">{t(activeDim.labelKey)}</th>
                  )}
                  <th>{t('leaderboard.dimTotal')}</th>
                  <th>{t('leaderboard.dimSessions')}</th>
                  <th>{t('leaderboard.dimMessages')}</th>
                  <th>{t('leaderboard.dimTokens')}</th>
                  <th>{t('leaderboard.dimCronJobs')}</th>
                  <th>{t('leaderboard.dimEarthPath')}</th>
                  <th>{t('leaderboard.dimBotSessions')}</th>
                  <th>{t('leaderboard.dimBotMessages')}</th>
                  <th>{t('leaderboard.dimBotCount')}</th>
                  <th>{t('leaderboard.dimStreak')}</th>
                  <th>{t('leaderboard.colUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(entry => (
                  <tr key={entry.agentId} className={sortBy !== 'total' && getDimValue(entry.dimensionScores, sortBy) > 0 ? 'leaderboard-highlight-row' : ''}>
                    <td className="mono">{entry.rank}</td>
                    <td className="leaderboard-name">{entry.agentName}</td>
                    <td><span className={`badge ${levelBadgeClass(entry.level)}`}>{entry.level}</span></td>
                    {sortBy !== 'total' && (
                      <td className="mono leaderboard-active-col">{formatNumber(getDimValue(entry.dimensionScores, sortBy))}</td>
                    )}
                    <td className="mono">{formatNumber(entry.totalPoints)}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'sessions'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'messages'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'tokens'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'cron_jobs'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'earth_path'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'bot_sessions'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'bot_messages'))}</td>
                    <td className="mono">{formatNumber(getDimValue(entry.dimensionScores, 'bot_count'))}</td>
                    <td className="mono">{getDimValue(entry.dimensionScores, 'streak')}</td>
                    <td className="mono">{formatDate(entry.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="leaderboard-pagination">
              <button
                className="btn-outline"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                {t('leaderboard.prev')}
              </button>
              <span className="leaderboard-page-info">
                {page} / {totalPages}
              </span>
              <button
                className="btn-outline"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                {t('leaderboard.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function levelBadgeClass(level: string): string {
  switch (level) {
    case 'gold': return 'badge-yellow';
    case 'silver': return 'badge-gray';
    case 'bronze': return 'badge-blue';
    case 'platinum': return 'badge-green';
    case 'diamond': return 'badge-red';
    default: return 'badge-gray';
  }
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
