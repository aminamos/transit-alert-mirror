import { defaultRegistry } from '../fetcher/index.js';
import { enrichAlerts } from '../enricher/index.js';
import { generateHtml } from '../generator/html.js';
import { generateJson } from '../generator/json.js';
import { generateRss } from '../generator/rss.js';
import type { AlertDataset } from '../types/index.js';

interface Env {
  ALERTS_CACHE?: any; // KV or Cache
  CLOUDFLARE_ACCOUNT_ID?: string;
}

let cachedDataset: { data: AlertDataset; timestamp: number } | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

async function getOrFetchAlerts(): Promise<AlertDataset> {
  const now = Date.now();
  if (cachedDataset && now - cachedDataset.timestamp < CACHE_TTL_MS) {
    return cachedDataset.data;
  }

  const rawAlerts = await defaultRegistry.fetchAll();
  const enriched = enrichAlerts(rawAlerts);
  cachedDataset = { data: enriched, timestamp: now };
  return enriched;
}

export default {
  async fetch(request: Request, env: Env, ctx?: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Health check
      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 2. RSS / Atom Feed
      if (path === '/feed.xml' || path === '/rss') {
        const dataset = await getOrFetchAlerts();
        const rss = generateRss(dataset);
        return new Response(rss, {
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=180',
          },
        });
      }

      // 3. JSON API
      if (path === '/api/alerts' || path === '/alerts.json') {
        const dataset = await getOrFetchAlerts();
        const routeFilter = url.searchParams.get('route');
        const severityFilter = url.searchParams.get('severity');

        let filteredAlerts = dataset.alerts;
        if (routeFilter) {
          const needle = routeFilter.toLowerCase();
          filteredAlerts = filteredAlerts.filter(a =>
            a.affectedRoutes.some(r => r.toLowerCase().includes(needle))
          );
        }
        if (severityFilter) {
          filteredAlerts = filteredAlerts.filter(
            a => a.severity.toLowerCase() === severityFilter.toLowerCase()
          );
        }

        const responsePayload = {
          metadata: {
            ...dataset.metadata,
            filteredAlertsCount: filteredAlerts.length,
          },
          alerts: filteredAlerts,
        };

        return new Response(JSON.stringify(responsePayload, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=120',
          },
        });
      }

      // 4. Force sync endpoint
      if (path === '/api/sync') {
        cachedDataset = null;
        const dataset = await getOrFetchAlerts();
        return new Response(
          JSON.stringify({ message: 'Synchronized alerts successfully', count: dataset.metadata.totalAlerts }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 5. Interactive Web Dashboard
      if (path === '/' || path === '/index.html') {
        const dataset = await getOrFetchAlerts();
        const html = generateHtml(dataset);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=120',
          },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  async scheduled(event: unknown, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(getOrFetchAlerts());
  },
};
