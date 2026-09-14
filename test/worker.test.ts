import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/worker/index.js';
import { defaultRegistry } from '../src/fetcher/index.js';

describe('Cloudflare Worker handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('serves /health endpoint with JSON status', async () => {
    const req = new Request('https://worker.local/health');
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('serves /feed.xml and /rss with XML feed', async () => {
    vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValue([
      {
        id: 'feed-1',
        agency: 'Metro Transit',
        headerText: 'Route 21 detour',
        descriptionText: 'Board at Lake & 10th',
        informedEntities: [{ routeId: '21' }],
      },
    ]);

    const req1 = new Request('https://worker.local/feed.xml');
    const res1 = await worker.fetch(req1, {});
    expect(res1.status).toBe(200);
    expect(res1.headers.get('Content-Type')).toContain('application/rss+xml');
    const xml = await res1.text();
    expect(xml).toContain('<rss version="2.0"');

    const req2 = new Request('https://worker.local/rss');
    const res2 = await worker.fetch(req2, {});
    expect(res2.status).toBe(200);
    expect(res2.headers.get('Content-Type')).toContain('application/rss+xml');
  });

  it('serves /api/alerts and /alerts.json with optional route and severity query filters', async () => {
    vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValue([
      {
        id: 'alert-1',
        agency: 'Metro Transit',
        cause: 'CONSTRUCTION',
        effect: 'DETOUR',
        headerText: 'Route 21 detour on Lake St',
        descriptionText: 'Board at Lake & 10th',
        informedEntities: [{ routeId: '21' }],
      },
      {
        id: 'alert-2',
        agency: 'Metro Transit',
        cause: 'OTHER',
        effect: 'NO_SERVICE',
        effectDetail: 'CANCELLATION',
        headerText: 'Route 5 trip canceled',
        descriptionText: '',
        informedEntities: [{ routeId: '5' }],
      },
    ]);
    await worker.fetch(new Request('https://worker.local/api/sync'), {});

    // Unfiltered /alerts.json
    const req1 = new Request('https://worker.local/alerts.json');
    const res1 = await worker.fetch(req1, {});
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.alerts.length).toBe(2);

    // Filter by route 21
    const req2 = new Request('https://worker.local/api/alerts?route=21');
    const res2 = await worker.fetch(req2, {});
    const data2 = await res2.json();
    expect(data2.alerts.length).toBe(1);
    expect(data2.alerts[0].affectedRoutes).toContain('Route 21');

    // Filter by severity critical
    const req3 = new Request('https://worker.local/api/alerts?severity=critical');
    const res3 = await worker.fetch(req3, {});
    const data3 = await res3.json();
    expect(data3.alerts.length).toBe(1);
    expect(data3.alerts[0].severity).toBe('Critical');

    // Filter by non-matching route
    const req4 = new Request('https://worker.local/api/alerts?route=999');
    const res4 = await worker.fetch(req4, {});
    const data4 = await res4.json();
    expect(data4.alerts.length).toBe(0);
  });

  it('forces synchronization via /api/sync', async () => {
    vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValue([
      {
        id: 'sync-1',
        agency: 'Metro Transit',
        headerText: 'System notice',
        descriptionText: '',
        informedEntities: [],
      },
    ]);

    const req = new Request('https://worker.local/api/sync');
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Synchronized alerts successfully');
    expect(data.count).toBe(1);
  });

  it('serves dashboard on / and /index.html', async () => {
    vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValue([]);

    const req1 = new Request('https://worker.local/');
    const res1 = await worker.fetch(req1, {});
    expect(res1.status).toBe(200);
    expect(res1.headers.get('Content-Type')).toContain('text/html');

    const req2 = new Request('https://worker.local/index.html');
    const res2 = await worker.fetch(req2, {});
    expect(res2.status).toBe(200);
    expect(res2.headers.get('Content-Type')).toContain('text/html');
  });

  it('returns 404 for unknown endpoints', async () => {
    const req = new Request('https://worker.local/unknown-path');
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not Found');
  });

  it('handles Error exception in fetch handler', async () => {
    // Invalidate cache first via sync
    const syncReq = new Request('https://worker.local/api/sync');
    vi.spyOn(defaultRegistry, 'fetchAll').mockRejectedValueOnce(new Error('Network failure'));
    const res = await worker.fetch(syncReq, {});
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Network failure');
  });

  it('handles non-Error throw in fetch handler', async () => {
    const syncReq = new Request('https://worker.local/api/sync');
    vi.spyOn(defaultRegistry, 'fetchAll').mockRejectedValueOnce('string error');
    const res = await worker.fetch(syncReq, {});
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal Server Error');
  });

  it('triggers background update via scheduled handler', async () => {
    let waitedPromise: Promise<unknown> | null = null;
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitedPromise = p;
      },
    };

    vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValue([]);
    await worker.scheduled({}, {}, ctx);
    expect(waitedPromise).not.toBeNull();
    await waitedPromise;
  });
});
