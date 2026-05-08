import { useState } from 'react';

export function TokenScreen({ onLogin }: { onLogin: (token: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onLogin(value.trim());
    } catch {
      setError('Invalid token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="token-screen">
      <form onSubmit={handleSubmit}>
        <h1>sman admin</h1>
        <input
          type="password"
          placeholder="Admin Token"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading || !value.trim()}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
