import { useState } from 'react';
import { t } from '../locales';

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
      setError(t('token.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="token-screen">
      <form className="token-card" onSubmit={handleSubmit}>
        <h1>{t('app.title')}</h1>
        <p className="token-subtitle">{t('token.subtitle')}</p>
        <input
          type="password"
          placeholder={t('token.placeholder')}
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading || !value.trim()}>
          {loading ? t('token.connecting') : t('token.connect')}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
