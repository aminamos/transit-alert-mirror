import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runCli, createProgram } from '../src/cli/index.js';
import * as indexModule from '../src/index.js';
import { defaultRegistry } from '../src/fetcher/index.js';

describe('cli commands', () => {
  let logSpy: any;
  let errorSpy: any;
  let exitSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies program configuration and metadata', () => {
    const program = createProgram();
    expect(program.name()).toBe('alert-mirror');
    expect(program.version()).toBe('1.0.0');
    expect(program.commands.map(c => c.name())).toEqual(['sync', 'list', 'json', 'parse']);
  });

  describe('parse command', () => {
    it('runs parse with text only', async () => {
      await runCli([
        'node',
        'alert-mirror',
        'parse',
        'NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE. BOARD AT LAKE & 10TH.',
      ]);

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Route 21');
      expect(output).toContain('Northbound');
      expect(output).toContain('Board at Lake & 10th');
    });

    it('runs parse with text and --desc option', async () => {
      await runCli([
        'node',
        'alert-mirror',
        'parse',
        'Route 5 closure',
        '--desc',
        'Due to utility repairs, stops #1234 are closed.',
      ]);

      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Route 5');
    });
  });

  describe('sync command', () => {
    it('runs sync in full mode and logs artifacts', async () => {
      vi.spyOn(indexModule, 'syncAlerts').mockResolvedValueOnce({
        dataset: {
          metadata: {
            generatedAt: '2026-09-14T00:00:00.000Z',
            totalAlerts: 3,
            criticalCount: 1,
            moderateCount: 1,
            minorCount: 1,
            affectedRoutesCount: 2,
            agencies: ['Metro Transit'],
          },
          alerts: [],
        },
        files: {
          markdownPath: path.resolve('ALERTS.md'),
          jsonPath: path.resolve('data/alerts.json'),
          htmlPath: path.resolve('docs/index.html'),
          rssPath: path.resolve('docs/feed.xml'),
        },
      });

      await runCli(['node', 'alert-mirror', 'sync', '-o', process.cwd(), '-a', 'Metro Transit', '-v']);

      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Successfully processed 3 alerts');
      expect(output).toContain('Generated Artifacts:');
      expect(output).toContain('ALERTS.md');
    });

    it('runs sync with --dry-run', async () => {
      vi.spyOn(indexModule, 'syncAlerts').mockResolvedValueOnce({
        dataset: {
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
        },
      });

      await runCli(['node', 'alert-mirror', 'sync', '--dry-run']);
      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Successfully processed 0 alerts');
      expect(output).not.toContain('Generated Artifacts:');
    });

    it('handles sync error with Error instance', async () => {
      vi.spyOn(indexModule, 'syncAlerts').mockRejectedValueOnce(new Error('Sync failed'));

      await expect(runCli(['node', 'alert-mirror', 'sync'])).rejects.toThrow('process.exit called with 1');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('handles sync error with non-Error string', async () => {
      vi.spyOn(indexModule, 'syncAlerts').mockRejectedValueOnce('Sync string error');

      await expect(runCli(['node', 'alert-mirror', 'sync'])).rejects.toThrow('process.exit called with 1');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('list command', () => {
    const mockDataset = {
      metadata: { totalAlerts: 3 },
      alerts: [
        {
          id: '1',
          agency: 'Metro Transit',
          severity: 'Critical',
          title: 'Route 21 Service Canceled',
          summary: 'Trip canceled due to staffing',
          affectedRoutes: ['Route 21'],
          direction: 'Northbound',
          riderAlternative: 'Take next bus in 30 mins',
          closedStopIds: ['101', '102'],
        },
        {
          id: '2',
          agency: 'Metro Transit',
          severity: 'Moderate',
          title: 'Route 5 Detour',
          summary: 'Detour on Chicago Ave',
          affectedRoutes: ['Route 5'],
          direction: 'Southbound',
          riderAlternative: null,
          closedStopIds: [],
        },
        {
          id: '3',
          agency: 'Metro Transit',
          severity: 'Minor',
          title: 'Route 10 Advisory',
          summary: 'Minor delay',
          affectedRoutes: ['Route 10'],
          direction: 'All',
          riderAlternative: null,
          closedStopIds: [],
        },
      ],
    };

    it('reads local data/alerts.json and lists filtered alerts with badges and alternatives', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));

      await runCli(['node', 'alert-mirror', 'list', 'Route 21', '-s', 'Critical', '-l', '5']);
      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Showing 1 of 1 alerts for Route "Route 21"');
      expect(output).toContain('Route 21 Service Canceled');
      expect(output).toContain('Alternative:');
      expect(output).toContain('#101, #102');
    });

    it('displays moderate and minor alerts with correct styles', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));

      await runCli(['node', 'alert-mirror', 'list', '--severity', 'Moderate']);
      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Route 5 Detour');

      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));
      await runCli(['node', 'alert-mirror', 'list', '--severity', 'Minor']);
      const outputMinor = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(outputMinor).toContain('Route 10 Advisory');
    });

    it('falls back to defaultRegistry.fetchAll when data/alerts.json cannot be read', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT'));
      vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValueOnce([
        {
          id: 'fallback-1',
          agency: 'Metro Transit',
          headerText: 'Route 21 detoured',
          descriptionText: '',
          informedEntities: [{ routeId: '21' }],
        },
      ]);

      await runCli(['node', 'alert-mirror', 'list', '21', '--agency', 'Metro Transit']);
      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('Route 21');
    });

    it('handles empty results when filter matches no alerts', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));

      await runCli(['node', 'alert-mirror', 'list', '999']);
      const output = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output).toContain('No alerts found matching route: "999"');

      // Empty results without routeArg (defaults to "all")
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));
      await runCli(['node', 'alert-mirror', 'list', '-s', 'NonExistent']);
      const output2 = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output2).toContain('No alerts found matching route: "all"');

      // Limit option fallback when parseInt returns NaN
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));
      await runCli(['node', 'alert-mirror', 'list', '-l', 'invalid']);
      const output3 = logSpy.mock.calls.map((c: any) => c.join(' ')).join('\n');
      expect(output3).toContain('Showing 3 of 3 alerts for All Routes');
    });

    it('handles list error with Error instance', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT'));
      vi.spyOn(defaultRegistry, 'fetchAll').mockRejectedValueOnce(new Error('Fetch failed'));

      await expect(runCli(['node', 'alert-mirror', 'list'])).rejects.toThrow('process.exit called with 1');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('handles list error with non-Error string', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT'));
      vi.spyOn(defaultRegistry, 'fetchAll').mockRejectedValueOnce('Network error string');

      await expect(runCli(['node', 'alert-mirror', 'list'])).rejects.toThrow('process.exit called with 1');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('json command', () => {
    const mockDataset = {
      metadata: { totalAlerts: 1 },
      alerts: [
        {
          id: '1',
          affectedRoutes: ['Route 21'],
          title: 'Route 21 detour',
        },
      ],
    };

    it('outputs full dataset JSON from local file', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));

      await runCli(['node', 'alert-mirror', 'json']);
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.metadata.totalAlerts).toBe(1);
    });

    it('outputs filtered JSON by route', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify(mockDataset));

      await runCli(['node', 'alert-mirror', 'json', 'Route 21']);
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].affectedRoutes).toContain('Route 21');
    });

    it('falls back to defaultRegistry.fetchAll when local json file missing', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT'));
      vi.spyOn(defaultRegistry, 'fetchAll').mockResolvedValueOnce([]);

      await runCli(['node', 'alert-mirror', 'json']);
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.metadata).toBeDefined();
    });

    it('handles json command error with Error instance', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT'));
      vi.spyOn(defaultRegistry, 'fetchAll').mockRejectedValueOnce(new Error('Live fetch failed'));

      await expect(runCli(['node', 'alert-mirror', 'json'])).rejects.toThrow('process.exit called with 1');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('handles json command error with non-Error string', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT'));
      vi.spyOn(defaultRegistry, 'fetchAll').mockRejectedValueOnce('Live fetch failed string');

      await expect(runCli(['node', 'alert-mirror', 'json'])).rejects.toThrow('process.exit called with 1');
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
