import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  generateMarkdown,
  generateJson,
  generateHtml,
  generateRss,
  writeGeneratedOutputs,
} from '../src/generator/index.js';
import type { AlertDataset, EnrichedAlert } from '../types/index.js';

describe('generator', () => {
  const mockAlert: EnrichedAlert = {
    id: 'test-1',
    agency: 'Metro Transit',
    severity: 'Moderate',
    title: 'Route 21: Detour via Lake St & Chicago Ave',
    summary: 'Route 21 detoured off Lake St at Chicago Ave due to police activity.',
    affectedRoutes: ['Route 21'],
    direction: 'Northbound',
    intersections: ['Lake St & Chicago Ave'],
    closedStopIds: ['1234', '1235'],
    closedStopDetails: [
      { id: '1234', name: 'Lake St & Chicago Ave' },
      { id: '1235', name: 'Lake St & 10th Ave' },
    ],
    riderAlternative: 'Board at Lake & 10th',
    detourDetails: 'Buses will travel via 28th St.',
    activePeriod: { textDescription: 'Beginning today until further notice' },
    cause: 'POLICE_ACTIVITY',
    effect: 'DETOUR',
    url: 'https://example.com/alert/1',
    updatedAt: '2026-09-14T00:00:00.000Z',
    rawHeader: 'NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE',
    rawDescription: 'Board at Lake & 10th.',
  };

  const mockDataset: AlertDataset = {
    metadata: {
      generatedAt: '2026-09-14T00:00:00.000Z',
      totalAlerts: 1,
      criticalCount: 0,
      moderateCount: 1,
      minorCount: 0,
      affectedRoutesCount: 1,
      agencies: ['Metro Transit'],
    },
    alerts: [mockAlert],
  };

  it('generates valid Markdown document with stats, TOC, and alert blocks', () => {
    const md = generateMarkdown(mockDataset);
    expect(md).toContain('# 🚌 Transit Alert Mirror');
    expect(md).toContain('## 📋 Routes Index');
    expect(md).toContain('**Route 21** (1)');
    expect(md).toContain('## ⚠️ Moderate Detours & Changes');
    expect(md).toContain('### ⚠️ Route 21: Detour via Lake St & Chicago Ave');
    expect(md).toContain('> 💡 **Rider Action**: Board at Lake & 10th');
  });

  it('generates valid JSON output', () => {
    const jsonStr = generateJson(mockDataset);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.metadata.totalAlerts).toBe(1);
    expect(parsed.alerts[0].title).toBe(mockAlert.title);
  });

  it('generates rich HTML dashboard', () => {
    const html = generateHtml(mockDataset);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Transit Alert Mirror');
    expect(html).toContain('Route 21');
    expect(html).toContain('searchInput');
  });

  it('generates valid RSS feed', () => {
    const rss = generateRss(mockDataset);
    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain('<title>[Moderate] Route 21: Detour via Lake St &amp; Chicago Ave</title>');
  });

  it('writes all files to specified directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transit-test-'));
    try {
      const result = await writeGeneratedOutputs(mockDataset, { rootDir: tmpDir });
      const mdExists = await fs.stat(result.markdownPath);
      const jsonExists = await fs.stat(result.jsonPath);
      const htmlExists = await fs.stat(result.htmlPath);
      const rssExists = await fs.stat(result.rssPath);

      expect(mdExists.isFile()).toBe(true);
      expect(jsonExists.isFile()).toBe(true);
      expect(htmlExists.isFile()).toBe(true);
      expect(rssExists.isFile()).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
