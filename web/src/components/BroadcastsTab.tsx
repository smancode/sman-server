import { useEffect, useState } from 'react';
import { api } from '../api';
import { t, useLocale } from '../locales';
import type { Broadcast } from '../types';

export function BroadcastsTab({ token }: { token: string }) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);
  useLocale();

  const load = async () => {
    try {
      const data = await api.getBroadcasts(token) as Broadcast[];
      setBroadcasts(data);
      setError('');
    } catch {
      setError(t('broadcast.loadFailed'));
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setCreating(true);
    try {
      await api.createBroadcast(token, {
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('broadcast.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.deleteBroadcast(token, id);
      await load();
    } catch {
      setError(t('broadcast.deactivateFailed'));
    }
  };

  return (
    <div>
      <form className="form-section" onSubmit={handleCreate}>
        <h3>{t('broadcast.newTitle')}</h3>
        <input
          placeholder={t('broadcast.titlePlaceholder')}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder={t('broadcast.bodyPlaceholder')}
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
        />
        <button type="submit" disabled={creating || !title.trim() || !body.trim()}>
          {creating ? t('broadcast.creating') : t('broadcast.create')}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('broadcast.colTitle')}</th>
              <th>{t('broadcast.colBody')}</th>
              <th>{t('broadcast.colCreated')}</th>
              <th>{t('broadcast.colStatus')}</th>
              <th>{t('broadcast.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map(b => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td className="truncate">{b.body}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>{b.active ? t('broadcast.active') : t('broadcast.inactive')}</td>
                <td>
                  {b.active && (
                    <button className="btn-sm" onClick={() => handleDeactivate(b.id)}>
                      {t('broadcast.deactivate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
