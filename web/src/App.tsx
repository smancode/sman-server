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
import { useAuthStore } from './stores/auth';

type Tab = 'dashboard' | 'clients' | 'broadcasts' | 'upload' | 'rooms' | 'agents' | 'tasks';

const NAV_ITEMS: { key: Tab; labelKey: string; group: string }[] = [
  { key: 'dashboard', labelKey: 'tab.dashboard', group: 'overview' },
  { key: 'clients', labelKey: 'tab.clients', group: 'overview' },
  { key: 'broadcasts', labelKey: 'tab.broadcasts', group: 'overview' },
  { key: 'upload', labelKey: 'tab.upload', group: 'overview' },
  { key: 'rooms', labelKey: 'tab.rooms', group: 'hub' },
  { key: 'agents', labelKey: 'tab.agents', group: 'hub' },
  { key: 'tasks', labelKey: 'tab.tasks', group: 'hub' },
];

const GROUP_LABELS: Record<string, string> = {
  overview: 'sidebar.groupOverview',
  hub: 'sidebar.groupHub',
};

export function App() {
  const { token, setToken, clearToken } = useAuthStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const locale = useLocale();

  const handleLogin = async (tk: string) => {
    await api.getStats(tk);
    setToken(tk);
  };

  const handleLogout = () => {
    clearToken();
  };

  if (!token) {
    return <TokenScreen onLogin={handleLogin} />;
  }

  let lastGroup = '';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            sman <span>admin</span>
          </div>
        </div>
        <div className="sidebar-divider" />
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const showLabel = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {showLabel && (
                  <div className="sidebar-group-label">{t(GROUP_LABELS[item.group])}</div>
                )}
                <button
                  className={`sidebar-item ${tab === item.key ? 'active' : ''}`}
                  onClick={() => setTab(item.key)}
                >
                  {t(item.labelKey)}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <select
              className="lang-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </div>
          <button className="btn-sidebar-logout" onClick={handleLogout}>
            {t('app.logout')}
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="content-inner">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'clients' && <ClientsTab />}
          {tab === 'broadcasts' && <BroadcastsTab />}
          {tab === 'upload' && <UploadTab />}
          {tab === 'rooms' && <RoomsTab />}
          {tab === 'agents' && <AgentsTab />}
          {tab === 'tasks' && <TasksTab />}
        </div>
      </main>
    </div>
  );
}
