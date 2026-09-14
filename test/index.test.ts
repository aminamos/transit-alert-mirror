import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { syncAlerts, defaultRegistry } from '../src/index.js';
import * as generatorModule from '../src/generator/index.js';

describe('syncAlerts', () => {
  it('performs dry-run sync without writing files', async () => {
    const fetchSpy = vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValueOnce([
      {
        id: 'test-dry-run',
        agency: 'Metro Transit',
        headerText: 'Route 21 detour',
        descriptionText: 'Board at Lake & 10th',
        informedEntities: [{ routeId: '21' }],
      },
    ]);

    const result = await syncAlerts({ dryRun: true, agency: 'Metro Transit' });
    expect(fetchSpy).toHaveBeenCalledWith('Metro Transit');
    expect(result.dataset).toBeDefined();
    expect(result.dataset.alerts[0].id).toBe('test-dry-run');
    expect(result.files).toBeUndefined();
  });

  it('performs full sync and writes generated outputs with default options', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-test-'));
    try {
      vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValueOnce([
        {
          id: 'test-full-sync',
          agency: 'Metro Transit',
          headerText: 'Route 5 advisory',
          descriptionText: '',
          informedEntities: [{ routeId: '5' }],
        },
      ]);

      const result = await syncAlerts({ outputDir: tmpDir });
      expect(result.dataset).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.files?.markdownPath).toBe(path.join(tmpDir, 'ALERTS.md'));
      expect(result.files?.jsonPath).toBe(path.join(tmpDir, 'data', 'alerts.json'));
      expect(result.files?.htmlPath).toBe(path.join(tmpDir, 'docs', 'index.html'));
      expect(result.files?.rssPath).toBe(path.join(tmpDir, 'docs', 'feed.xml'));

      const stat = await fs.stat(result.files!.markdownPath);
      expect(stat.isFile()).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('runs sync with no arguments (default options)', async () => {
    vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValueOnce([]);
    const writeSpy = vi.spyOn(generatorModule, 'writeGeneratedOutputs').mockResolvedValueOnce({
      markdownPath: 'ALERTS.md',
      jsonPath: 'data/alerts.json',
      htmlPath: 'docs/index.html',
      rssPath: 'docs/feed.xml',
    });

    const result = await syncAlerts();
    expect(result.dataset).toBeDefined();
    expect(result.files).toBeDefined();
    expect(writeSpy).toHaveBeenCalledWith(result.dataset, { rootDir: undefined });
  });
});
