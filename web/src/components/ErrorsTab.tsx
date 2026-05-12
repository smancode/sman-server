import { Fragment, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';

interface ErrorReport {
  id: number;
  client_id: string | null;
  session_id: string | null;
  error_code: string | null;
  error_message: string | null;
  raw_error: string | null;
  workspace: string | null;
  last_user_message: string | null;
  llm_model: string | null;
  llm_base_url: string | null;
  os_info: string | null;
  created_at: string;
}

export function ErrorsTab() {
  const token = useAuthStore((s) => s.token);
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState('');
  useLocale();

  const load = () => {
    api.getErrorReports(token)
      .then(data => { setReports(data as ErrorReport[]); setError(''); })
      .catch(() => setError(t('errors.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteErrorReport(token, id);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  if (error) return <p className="error">{error}</p>;
  if (!reports.length) return <div className="empty-state"><p>{t('errors.noData')}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.errors')}</h2>
        <span className="page-count">{reports.length}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('errors.colTime')}</th>
              <th>{t('errors.colClient')}</th>
              <th>{t('errors.colCode')}</th>
              <th>{t('errors.colMessage')}</th>
              <th>{t('errors.colModel')}</th>
              <th>{t('errors.colOs')}</th>
              <th>{t('errors.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <Fragment key={r.id}>
                <tr className={expanded === r.id ? 'expanded-row' : ''} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>                  <td className="mono">{formatDateTime(r.created_at)}</td>
                  <td className="mono" title={r.client_id ?? ''}>{r.client_id ? r.client_id.split('@')[0] : '-'}</td>
                  <td><span className={`status-badge ${r.error_code === 'process_dead' ? 'status-error' : 'status-warning'}`}>{r.error_code ?? 'unknown'}</span></td>
                  <td className="truncate-cell">{r.error_message ?? '-'}</td>
                  <td className="mono">{r.llm_model ?? '-'}</td>
                  <td className="mono">{r.os_info ?? '-'}</td>
                  <td><button className="btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(r.id); }}>{t('errors.delete')}</button></td>
                </tr>
                {expanded === r.id && (
                  <tr className="detail-row">
                    <td colSpan={7}>
                      <div className="detail-grid">
                        {r.workspace && <div className="detail-field"><label>{t('errors.detailWorkspace')}</label><code>{r.workspace}</code></div>}
                        {r.llm_base_url && <div className="detail-field"><label>{t('errors.detailBaseUrl')}</label><code>{r.llm_base_url}</code></div>}
                        {r.last_user_message && <div className="detail-field"><label>{t('errors.detailUserMsg')}</label><code>{r.last_user_message}</code></div>}
                        {r.session_id && <div className="detail-field"><label>{t('errors.detailSession')}</label><code>{r.session_id}</code></div>}
                        {r.raw_error && <div className="detail-field detail-field-full"><label>{t('errors.detailRaw')}</label><pre className="error-raw">{r.raw_error}</pre></div>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
