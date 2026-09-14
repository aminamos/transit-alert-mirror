import type { AlertFetcher, FetchOptions } from './base.js';
import { MetroTransitFetcher } from './metroTransit.js';
import type { RawAlert } from '../types/index.js';

export * from './base.js';
export * from './metroTransit.js';

export class FetcherRegistry {
  private fetchers: Map<string, AlertFetcher> = new Map();

  constructor() {
    this.register(new MetroTransitFetcher());
  }

  register(fetcher: AlertFetcher): void {
    this.fetchers.set(fetcher.agencyName.toLowerCase(), fetcher);
  }

  get(name: string): AlertFetcher | undefined {
    return this.fetchers.get(name.toLowerCase());
  }

  getAll(): AlertFetcher[] {
    return Array.from(this.fetchers.values());
  }

  async fetchAll(agencyName?: string, options?: FetchOptions): Promise<RawAlert[]> {
    if (agencyName) {
      const fetcher = this.get(agencyName);
      if (!fetcher) {
        throw new Error(`No fetcher registered for agency "${agencyName}". Available agencies: ${Array.from(this.fetchers.keys()).join(', ')}`);
      }
      return fetcher.fetchAlerts(options);
    }

    const allAlerts: RawAlert[] = [];
    const fetchers = this.getAll();
    const results = await Promise.allSettled(fetchers.map(f => f.fetchAlerts(options)));

    results.forEach((result, idx) => {
      const fetcher = fetchers[idx];
      if (result.status === 'fulfilled') {
        allAlerts.push(...result.value);
      } else {
        console.warn(`[fetcher] Warning: Failed to fetch alerts from ${fetcher.agencyName}:`, result.reason);
      }
    });

    return allAlerts;
  }
}

export const defaultRegistry = new FetcherRegistry();
