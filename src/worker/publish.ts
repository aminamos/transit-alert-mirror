import { generateMarkdown } from '../generator/markdown.js';
import { generateJson } from '../generator/json.js';
import { generateHtml } from '../generator/html.js';
import { generateRss } from '../generator/rss.js';
import type { AlertDataset } from '../types/index.js';

/**
 * Durable publication for the hourly Worker cron.
 *
 * The scheduled GitHub Actions workflow used to run the CLI and commit
 * ALERTS.md, data/alerts.json, docs/index.html, docs/feed.xml. This module
 * lets the Cloudflare Worker (wrangler.json triggers.crons) write those same
 * four files through the GitHub Contents API, using the same generator
 * functions as the CLI so output is byte-identical for a given dataset.
 * Unchanged files are skipped, mirroring the workflow's "commit if changed".
 */

export const PUBLISH_REPO = 'aminamos/transit-alert-mirror';
export const PUBLISH_BRANCH = 'main';
export const PUBLISH_MESSAGE =
  'chore(alerts): update plain-English transit advisories [skip ci]';

const FILE_GENERATORS: Record<string, (d: AlertDataset) => string> = {
  'ALERTS.md': generateMarkdown,
  'data/alerts.json': generateJson,
  'docs/index.html': generateHtml,
  'docs/feed.xml': generateRss,
};

export interface PublishConfig {
  token: string;
  repo?: string;
  branch?: string;
  message?: string;
}

export interface PublishResult {
  updated: string[];
  skipped: string[];
}

/** Build every published file's content from one dataset. */
export function buildPublishFiles(dataset: AlertDataset): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, generate] of Object.entries(FILE_GENERATORS)) {
    files[path] = generate(dataset);
  }
  return files;
}

/** Base64-encode UTF-8 text without Buffer (unavailable in Workers). */
export function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** True when the base64 stored by the Contents API decodes to `next`. */
export function contentsEqual(existingBase64: string | null, next: string): boolean {
  if (existingBase64 == null) return false;
  return existingBase64.replace(/\s/g, '') === toBase64Utf8(next);
}

type FetchImpl = typeof fetch;

async function getExistingFile(
  fetchImpl: FetchImpl,
  apiBase: string,
  headers: Record<string, string>,
  path: string,
  branch: string,
): Promise<{ sha: string; content: string } | null> {
  const res = await fetchImpl(
    `${apiBase}/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get ${path} failed: HTTP ${res.status}`);
  const body = (await res.json()) as { sha?: string; content?: string };
  if (typeof body.sha !== 'string' || typeof body.content !== 'string') {
    throw new Error(`get ${path} returned unexpected shape`);
  }
  return { sha: body.sha, content: body.content };
}

/**
 * Write changed files to the repo via the Contents API. Files whose content
 * already matches are skipped, so quiet hours produce no commits.
 */
export async function publishDataset(
  config: PublishConfig,
  dataset: AlertDataset,
  fetchImpl: FetchImpl = fetch,
): Promise<PublishResult> {
  const repo = config.repo ?? PUBLISH_REPO;
  const branch = config.branch ?? PUBLISH_BRANCH;
  const message = config.message ?? PUBLISH_MESSAGE;
  const apiBase = `https://api.github.com/repos/${repo}/contents`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'transit-alert-mirror-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const result: PublishResult = { updated: [], skipped: [] };
  for (const [path, content] of Object.entries(buildPublishFiles(dataset))) {
    const existing = await getExistingFile(fetchImpl, apiBase, headers, path, branch);
    if (contentsEqual(existing?.content ?? null, content)) {
      result.skipped.push(path);
      continue;
    }
    const payload: Record<string, string> = { message, content: toBase64Utf8(content), branch };
    if (existing) payload.sha = existing.sha;
    const put = await fetchImpl(`${apiBase}/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    if (!put.ok) throw new Error(`put ${path} failed: HTTP ${put.status}`);
    result.updated.push(path);
  }
  return result;
}
