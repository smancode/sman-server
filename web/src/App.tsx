import { useState } from 'react';
import { api } from './api';
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

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [tab, setTab] = useState<Tab>('dashboard');

  const handleLogin = async (t: string) => {
    await api.getStats(t);
    localStorage.setItem(STORAGE_KEY, t);
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken('');
  };

  if (!token) {
    return <TokenScreen onLogin={handleLogin} />;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'clients', label: 'Clients' },
    { key: 'broadcasts', label: 'Broadcasts' },
    { key: 'upload', label: 'Upload' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'agents', label: 'Agents' },
    { key: 'tasks', label: 'Tasks' },
  ];

  return (
    <div className="app">
      <header className="header">
        <h1>sman admin</h1>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </header>
      <nav className="tab-bar">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
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
