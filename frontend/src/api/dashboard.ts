import { apiFetch } from './client';
import type { StatistikDashboard } from './types';

export function fetchStatistikDashboard(token: string) {
  return apiFetch<StatistikDashboard>('/api/dashboard/statistik', { token });
}
