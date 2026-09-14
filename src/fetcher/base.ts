import type { RawAlert } from '../types/index.js';

export interface FetchOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface AlertFetcher {
  readonly agencyName: string;
  readonly defaultUrl: string;
  fetchAlerts(options?: FetchOptions): Promise<RawAlert[]>;
}
