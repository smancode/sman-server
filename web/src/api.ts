const BASE = '/admin';

async function request(path: string, token: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  getStats: (token: string) => request('/stats', token),
  getClients: (token: string) => request('/clients', token),
  getBroadcasts: (token: string) => request('/broadcasts', token),
  createBroadcast: (token: string, data: { id: string; title: string; body: string }) =>
    request('/broadcast', token, { method: 'POST', body: JSON.stringify(data) }),
  deleteBroadcast: (token: string, id: string) =>
    request(`/broadcast/${id}`, token, { method: 'DELETE' }),
  uploadFile: async (token: string, filename: string, file: File, options?: { releaseNotes?: string }) => {
    const params = new URLSearchParams({ filename });
    if (options?.releaseNotes) params.set('releaseNotes', options.releaseNotes);
    const res = await fetch(`${BASE}/upload?${params}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
  publish: (token: string, data: { version: string; url: string; filename?: string; sha512?: string; size?: number; releaseNotes?: string }) =>
    request('/publish', token, { method: 'POST', body: JSON.stringify(data) }),
  getLatestYml: async (token: string): Promise<string> => {
    const res = await fetch(`${BASE}/latest-yml`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  },
  getRooms: (token: string) => request('/rooms', token),
  deleteRoom: (token: string, roomId: string) =>
    request(`/rooms/${roomId}`, token, { method: 'DELETE' }),
  getAgents: (token: string) => request('/agents', token),
  getTasks: (token: string, status?: string) =>
    request(status ? `/tasks?status=${status}` : '/tasks', token),
  cancelTask: (token: string, taskId: string) =>
    request(`/tasks/${taskId}/cancel`, token, { method: 'POST' }),
  getStardomDevMode: (token: string) => request('/stardom-dev-mode', token),
  setStardomDevMode: (token: string, enabled: boolean) =>
    request('/stardom-dev-mode', token, { method: 'PUT', body: JSON.stringify({ enabled }) }),
  getErrorReports: (token: string) => request('/error-reports', token),
  deleteErrorReport: (token: string, id: number) =>
    request(`/error-reports/${id}`, token, { method: 'DELETE' }),
};
