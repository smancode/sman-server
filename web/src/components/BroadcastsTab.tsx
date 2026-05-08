import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Broadcast } from '../types';

export function BroadcastsTab({ token }: { token: string }) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await api.getBroadcasts(token) as Broadcast[];
      setBroadcasts(data);
      setError('');
    } catch {
      setError('Failed to load broadcasts');
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
      setError(err instanceof Error ? err.message : 'Failed to create broadcast');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.deleteBroadcast(token, id);
      await load();
    } catch {
      setError('Failed to deactivate broadcast');
    }
  };

  return (
    <div>
      <form className="form-section" onSubmit={handleCreate}>
        <h3>New Broadcast</h3>
        <input
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Body"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
        />
        <button type="submit" disabled={creating || !title.trim() || !body.trim()}>
          {creating ? 'Creating...' : 'Create'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Body</th>
              <th>Created</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map(b => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td className="truncate">{b.body}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>{b.active ? 'Active' : 'Inactive'}</td>
                <td>
                  {b.active && (
                    <button className="btn-sm" onClick={() => handleDeactivate(b.id)}>
                      Deactivate
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
