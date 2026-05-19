import { Fragment, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import { useAuthStore } from '../stores/auth';
import { formatDateTime, useAutoRefresh } from '../lib/utils';

interface Feedback {
  id: number;
  client_id: string | null;
  message: string;
  workspace: string | null;
  llm_model: string | null;
  llm_base_url: string | null;
  os_info: string | null;
  created_at: string;
}

export function FeedbacksTab() {
  const token = useAuthStore((s) => s.token);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState('');
  useLocale();

  const load = () => {
    api.getFeedbacks(token)
      .then(data => { setFeedbacks(data as Feedback[]); setError(''); })
      .catch(() => setError(t('feedbacks.loadFailed')));
  };

  useAutoRefresh(load, 30_000, [token]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteFeedback(token, id);
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    } catch {}
  };

  if (error) return <p className="error">{error}</p>;
  if (!feedbacks.length) return <div className="empty-state"><p>{t('feedbacks.noData')}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('tab.feedbacks')}</h2>
        <span className="page-count">{feedbacks.length}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('feedbacks.colTime')}</th>
              <th>{t('feedbacks.colClient')}</th>
              <th>{t('feedbacks.colMessage')}</th>
              <th>{t('feedbacks.colModel')}</th>
              <th>{t('feedbacks.colOs')}</th>
              <th>{t('feedbacks.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map(f => (
              <Fragment key={f.id}>
                <tr className={expanded === f.id ? 'expanded-row' : ''} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                  <td className="mono">{formatDateTime(f.created_at)}</td>
                  <td className="mono" title={f.client_id ?? ''}>{f.client_id ? f.client_id.split('@')[0] : '-'}</td>
                  <td className="truncate-cell">{f.message}</td>
                  <td className="mono">{f.llm_model ?? '-'}</td>
                  <td className="mono">{f.os_info ?? '-'}</td>
                  <td><button className="btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(f.id); }}>{t('feedbacks.delete')}</button></td>
                </tr>
                {expanded === f.id && (
                  <tr className="detail-row">
                    <td colSpan={6}>
                      <div className="detail-grid">
                        <div className="detail-field detail-field-full">
                          <label>{t('feedbacks.detailMessage')}</label>
                          <pre className="error-raw">{f.message}</pre>
                        </div>
                        {f.workspace && <div className="detail-field"><label>{t('feedbacks.detailWorkspace')}</label><code>{f.workspace}</code></div>}
                        {f.llm_base_url && <div className="detail-field"><label>{t('feedbacks.detailBaseUrl')}</label><code>{f.llm_base_url}</code></div>}
                        {f.llm_model && <div className="detail-field"><label>{t('feedbacks.detailModel')}</label><code>{f.llm_model}</code></div>}
                        {f.os_info && <div className="detail-field"><label>{t('feedbacks.detailOs')}</label><code>{f.os_info}</code></div>}
                        {f.client_id && <div className="detail-field"><label>{t('feedbacks.detailClient')}</label><code>{f.client_id}</code></div>}
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
