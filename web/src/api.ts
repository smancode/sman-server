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
  uploadFile: async (token: string, filename: string, file: File) => {
    const res = await fetch(`${BASE}/upload?filename=${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
};
