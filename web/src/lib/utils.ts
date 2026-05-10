import { useCallback, useEffect, useRef } from 'react';

export function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function useAutoRefresh(callback: () => void, intervalMs = 30_000, deps: unknown[] = []) {
  const savedCb = useRef(callback);
  savedCb.current = callback;

  const run = useCallback(() => savedCb.current(), []);

  useEffect(() => {
    run();
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, ...deps]);
}
