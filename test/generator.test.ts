import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  generateMarkdown,
  formatMarkdownAlert,
  generateJson,
  generateHtml,
  generateRss,
  writeGeneratedOutputs,
  escapeHtml,
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

  it('escapes HTML special characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
    expect(escapeHtml('plain')).toBe('plain');
  });

  it('generates valid Markdown document with stats, TOC, and alert blocks', () => {
    const md = generateMarkdown(mockDataset);
    expect(md).toContain('# 🚌 Transit Alert Mirror');
    expect(md).toContain('## 📋 Routes Index');
    expect(md).toContain('**Route 21** (1)');
    expect(md).toContain('## ⚠️ Moderate Detours & Changes');
    expect(md).toContain('### ⚠️ Route 21: Detour via Lake St & Chicago Ave');
    expect(md).toContain('> 💡 **Rider Action**: Board at Lake & 10th');
  });

  it('formats markdown alert with critical and minor severities and edge cases', () => {
    const critAlert: EnrichedAlert = {
      id: 'crit-1',
      agency: 'Agency',
      severity: 'Critical',
      title: 'Suspension',
      summary: 'Critical alert',
      affectedRoutes: ['Route 5'],
      direction: 'Both Directions',
      intersections: [],
      closedStopIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      closedStopDetails: [
        { id: '1' }, // no name
      ],
      riderAlternative: null,
      detourDetails: null,
      activePeriod: {},
      cause: 'EMERGENCY',
      effect: 'NO_SERVICE',
      updatedAt: '2026-09-14T00:00:00.000Z',
      rawHeader: 'Header only',
    };

    const critMd = formatMarkdownAlert(critAlert);
    expect(critMd).toContain('### 🚨 Suspension');
    expect(critMd).toContain('*(+1 more)*');
    expect(critMd).toContain('**Header**: Header only');
    expect(critMd).not.toContain('```text');

    const minorAlert: EnrichedAlert = {
      id: 'minor-1',
      agency: 'Agency',
      severity: 'Minor',
      title: 'Advisory',
      summary: 'Minor notice',
      affectedRoutes: ['Route 10'],
      direction: 'All',
      intersections: [],
      closedStopIds: ['100', '101'],
      closedStopDetails: [], // fallback to closedStopIds with #id
      riderAlternative: null,
      detourDetails: null,
      activePeriod: {},
      cause: 'GENERAL',
      effect: 'ADVISORY',
      updatedAt: '2026-09-14T00:00:00.000Z',
      rawDescription: 'Desc only',
    };

    const minorMd = formatMarkdownAlert(minorAlert);
    expect(minorMd).toContain('### ℹ️ Advisory');
    expect(minorMd).toContain('#100, #101');
    expect(minorMd).toContain('```text\nDesc only\n```');
    expect(minorMd).not.toContain('**Header**:');

    // Alert with no raw message
    const noRawAlert: EnrichedAlert = {
      ...minorAlert,
      closedStopIds: [],
      rawHeader: undefined,
      rawDescription: undefined,
    };
    const noRawMd = formatMarkdownAlert(noRawAlert);
    expect(noRawMd).not.toContain('<details>');
  });

  it('generates markdown with critical, moderate, and minor sections present and empty states', () => {
    const allSectionDataset: AlertDataset = {
      metadata: {
        generatedAt: '2026-09-14T00:00:00.000Z',
        totalAlerts: 3,
        criticalCount: 1,
        moderateCount: 1,
        minorCount: 1,
        affectedRoutesCount: 2,
        agencies: ['Agency'],
      },
      alerts: [
        { ...mockAlert, id: 'c1', severity: 'Critical', affectedRoutes: ['Route 10', 'Route 2'] },
        { ...mockAlert, id: 'm1', severity: 'Moderate', affectedRoutes: ['Route 2'] },
        { ...mockAlert, id: 'n1', severity: 'Minor', affectedRoutes: ['Route 10'] },
      ],
    };

    const mdAll = generateMarkdown(allSectionDataset);
    expect(mdAll).toContain('**Route 2** (2) • **Route 10** (2)');

    // Dataset with 0 alerts (testing all empty section messages)
    const emptyDataset: AlertDataset = {
      metadata: {
        generatedAt: '2026-09-14T00:00:00.000Z',
        totalAlerts: 0,
        criticalCount: 0,
        moderateCount: 0,
        minorCount: 0,
        affectedRoutesCount: 0,
        agencies: [],
      },
      alerts: [],
    };

    const mdEmpty = generateMarkdown(emptyDataset);
    expect(mdEmpty).toContain('*No active route disruptions reported.*');
    expect(mdEmpty).toContain('*No critical suspensions or cancellations at this time.*');
    expect(mdEmpty).toContain('*No moderate detours or stop closures active.*');
    expect(mdEmpty).toContain('*No minor service advisories reported.*');
  });

  it('generates JSON with pretty true and false', () => {
    const jsonPretty = generateJson(mockDataset, true);
    expect(jsonPretty).toContain('\n');
    const jsonCompact = generateJson(mockDataset, false);
    expect(jsonCompact).not.toContain('\n');
    expect(JSON.parse(jsonCompact).metadata.totalAlerts).toBe(1);
  });

  it('generates rich HTML dashboard', () => {
    const html = generateHtml(mockDataset);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Transit Alert Mirror');
    expect(html).toContain('Route 21');
    expect(html).toContain('searchInput');
  });

  it('generates valid RSS feed with and without optional fields', () => {
    const rss = generateRss(mockDataset);
    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain('<title>[Moderate] Route 21: Detour via Lake St &amp; Chicago Ave</title>');
    expect(rss).toContain('&amp;');

    const alertWithoutOptional: EnrichedAlert = {
      ...mockAlert,
      url: undefined,
      riderAlternative: null,
    };
    const rss2 = generateRss({
      metadata: mockDataset.metadata,
      alerts: [alertWithoutOptional],
    });
    expect(rss2).toContain('<link>https://github.com/aminamos/transit-alert-mirror</link>');
  });

  it('writes all files to specified directory with custom file names', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transit-test-'));
    try {
      const result = await writeGeneratedOutputs(mockDataset, {
        rootDir: tmpDir,
        markdownFile: path.join(tmpDir, 'CUSTOM.md'),
        jsonDataFile: path.join(tmpDir, 'custom.json'),
        htmlFile: path.join(tmpDir, 'custom.html'),
        rssFile: path.join(tmpDir, 'custom.xml'),
      });

      expect((await fs.stat(result.markdownPath)).isFile()).toBe(true);
      expect((await fs.stat(result.jsonPath)).isFile()).toBe(true);
      expect((await fs.stat(result.htmlPath)).isFile()).toBe(true);
      expect((await fs.stat(result.rssPath)).isFile()).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('uses process.cwd() fallback when options.rootDir is omitted', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transit-omit-root-'));
    try {
      const result = await writeGeneratedOutputs(mockDataset, {
        markdownFile: path.join(tmpDir, '1.md'),
        jsonDataFile: path.join(tmpDir, '2.json'),
        htmlFile: path.join(tmpDir, '3.html'),
        rssFile: path.join(tmpDir, '4.xml'),
      });
      expect(result.markdownPath).toBe(path.join(tmpDir, '1.md'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
