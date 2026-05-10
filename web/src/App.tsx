import { useState } from 'react';
import { api } from './api';
import { t, useLocale, setLocale, getCurrentLocale } from './locales';
import { TokenScreen } from './components/TokenScreen';
import { DashboardTab } from './components/DashboardTab';
import { ClientsTab } from './components/ClientsTab';
import { BroadcastsTab } from './components/BroadcastsTab';
import { UploadTab } from './components/UploadTab';
import { RoomsTab } from './components/RoomsTab';
import { AgentsTab } from './components/AgentsTab';
import { TasksTab } from './components/TasksTab';

type Tab = 'dashboard' | 'clients' | 'broadcasts' | 'upload' | 'rooms' | 'agents' | 'tasks';

const STORAGE_KEY = 'sman-admin-token';

const TAB_KEYS: { key: Tab; labelKey: string }[] = [
  { key: 'dashboard', labelKey: 'tab.dashboard' },
  { key: 'clients', labelKey: 'tab.clients' },
  { key: 'broadcasts', labelKey: 'tab.broadcasts' },
  { key: 'upload', labelKey: 'tab.upload' },
  { key: 'rooms', labelKey: 'tab.rooms' },
  { key: 'agents', labelKey: 'tab.agents' },
  { key: 'tasks', labelKey: 'tab.tasks' },
];

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [tab, setTab] = useState<Tab>('dashboard');
  const locale = useLocale();

  const handleLogin = async (tk: string) => {
    await api.getStats(tk);
    localStorage.setItem(STORAGE_KEY, tk);
    setToken(tk);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken('');
  };

  if (!token) {
    return <TokenScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>{t('app.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            className="lang-select"
            value={locale}
            onChange={e => setLocale(e.target.value)}
            title={t('common.languageSwitch')}
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
          <button className="btn-logout" onClick={handleLogout}>{t('app.logout')}</button>
        </div>
      </header>
      <nav className="tab-bar">
        {TAB_KEYS.map(item => (
          <button
            key={item.key}
            className={`tab ${tab === item.key ? 'tab-active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>
      <main className="content">
        {tab === 'dashboard' && <DashboardTab token={token} />}
        {tab === 'clients' && <ClientsTab token={token} />}
        {tab === 'broadcasts' && <BroadcastsTab token={token} />}
        {tab === 'upload' && <UploadTab token={token} />}
        {tab === 'rooms' && <RoomsTab token={token} />}
        {tab === 'agents' && <AgentsTab token={token} />}
        {tab === 'tasks' && <TasksTab token={token} />}
      </main>
    </div>
  );
}
