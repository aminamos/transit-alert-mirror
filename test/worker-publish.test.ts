import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPublishFiles,
  toBase64Utf8,
  contentsEqual,
  publishDataset,
  PUBLISH_REPO,
  PUBLISH_BRANCH,
  PUBLISH_MESSAGE,
} from '../src/worker/publish.js';
import type { AlertDataset } from '../types/index.js';

function makeDataset(title: string): AlertDataset {
  return {
    metadata: {
      generatedAt: '2026-10-06T00:00:00.000Z',
      totalAlerts: 1,
      criticalCount: 0,
      moderateCount: 1,
      minorCount: 0,
      affectedRoutesCount: 1,
      agencies: ['Metro Transit'],
    },
    alerts: [
      {
        id: 'test-1',
        agency: 'Metro Transit',
        severity: 'Moderate',
        title,
        summary: 'summary',
        affectedRoutes: ['Route 21'],
        direction: 'Northbound',
        intersections: [],
        closedStopIds: [],
        closedStopDetails: [],
        riderAlternative: null,
        detourDetails: null,
        activePeriod: { textDescription: 'now' },
        cause: 'UNKNOWN_CAUSE',
        effect: 'UNKNOWN_EFFECT',
        updatedAt: '2026-10-06T00:00:00.000Z',
      },
    ],
  };
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (url: unknown, init?: RequestInit) => handler(String(url), init));
}

function contentsResponse(sha: string, content: string): Response {
  return new Response(JSON.stringify({ sha, content }));
}

describe('worker publish', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the same four files the CLI writes', () => {
    const files = buildPublishFiles(makeDataset('Detour'));
    expect(Object.keys(files).sort()).toEqual([
      'ALERTS.md',
      'data/alerts.json',
      'docs/feed.xml',
      'docs/index.html',
    ]);
    expect(files['ALERTS.md']).toContain('Detour');
    expect(files['docs/feed.xml']).toContain('<rss');
    expect(files['docs/index.html']).toContain('<html');
    expect(JSON.parse(files['data/alerts.json']).alerts).toHaveLength(1);
  });

  it('round-trips unicode through base64', () => {
    const text = 'Métro détour: Lake St & Chicago Ave ✓';
    const bytes = Uint8Array.from(atob(toBase64Utf8(text)), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe(text);
  });

  it('compares stored content ignoring base64 line wraps', () => {
    const next = 'a'.repeat(200);
    const wrapped = toBase64Utf8(next).replace(/(.{76})/g, '$1\n');
    expect(contentsEqual(wrapped, next)).toBe(true);
    expect(contentsEqual(toBase64Utf8('other'), next)).toBe(false);
    expect(contentsEqual(null, next)).toBe(false);
  });

  it('skips PUT when every file already matches', async () => {
    const dataset = makeDataset('Detour');
    const files = buildPublishFiles(dataset);
    const fetchImpl = stubFetch((url, init) => {
      if (init?.method === 'PUT') return new Response('{}', { status: 201 });
      const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
      return contentsResponse(`sha-${path}`, toBase64Utf8(files[path]));
    });

    const result = await publishDataset({ token: 't' }, dataset, fetchImpl);
    expect(result.updated).toEqual([]);
    expect(result.skipped).toHaveLength(4);
    expect(fetchImpl.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('PUTs changed files with sha, branch, and message', async () => {
    const dataset = makeDataset('New detour');
    const puts: Array<{ url: string; body: Record<string, string> }> = [];
    const fetchImpl = stubFetch((url, init) => {
      if (init?.method === 'PUT') {
        puts.push({ url, body: JSON.parse(String(init.body)) });
        return new Response('{}', { status: 200 });
      }
      return contentsResponse('old-sha', toBase64Utf8('stale'));
    });

    const result = await publishDataset({ token: 't' }, dataset, fetchImpl);
    expect(result.updated).toHaveLength(4);
    expect(result.skipped).toEqual([]);
    for (const put of puts) {
      expect(put.url).toContain(`/repos/${PUBLISH_REPO}/contents/`);
      expect(put.body.sha).toBe('old-sha');
      expect(put.body.branch).toBe(PUBLISH_BRANCH);
      expect(put.body.message).toBe(PUBLISH_MESSAGE);
    }
  });

  it('creates files missing from the repo without sha', async () => {
    const puts: Array<Record<string, string>> = [];
    const fetchImpl = stubFetch((_url, init) => {
      if (init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)));
        return new Response('{}', { status: 201 });
      }
      return new Response('not found', { status: 404 });
    });

    const result = await publishDataset({ token: 't' }, makeDataset('Detour'), fetchImpl);
    expect(result.updated).toHaveLength(4);
    expect(puts.every((b) => !('sha' in b))).toBe(true);
  });

  it('throws on GET and PUT failures', async () => {
    const getFail = stubFetch(() => new Response('boom', { status: 500 }));
    await expect(publishDataset({ token: 't' }, makeDataset('x'), getFail)).rejects.toThrow(
      'get ALERTS.md failed: HTTP 500',
    );

    const putFail = stubFetch((_url, init) =>
      init?.method === 'PUT'
        ? new Response('denied', { status: 403 })
        : contentsResponse('sha', toBase64Utf8('stale')),
    );
    await expect(publishDataset({ token: 't' }, makeDataset('x'), putFail)).rejects.toThrow(
      'put ALERTS.md failed: HTTP 403',
    );
  });

  it('throws on malformed Contents API payloads', async () => {
    const badShape = stubFetch(() => new Response(JSON.stringify({ sha: 42 })));
    await expect(publishDataset({ token: 't' }, makeDataset('x'), badShape)).rejects.toThrow(
      'unexpected shape',
    );
  });
});
