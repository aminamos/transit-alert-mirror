import { defaultRegistry, FetcherRegistry } from './fetcher/index.js';
import { enrichAlerts } from './enricher/index.js';
import { writeGeneratedOutputs } from './generator/index.js';
import type { AlertDataset, SyncOptions } from './types/index.js';

export * from './types/index.js';
export * from './fetcher/index.js';
export * from './enricher/index.js';
export * from './generator/index.js';

export interface SyncResult {
  dataset: AlertDataset;
  files?: {
    markdownPath: string;
    jsonPath: string;
    htmlPath: string;
    rssPath: string;
  };
}

export async function syncAlerts(options: SyncOptions = {}): Promise<SyncResult> {
  const registry = defaultRegistry;
  const rawAlerts = await registry.fetchAll(options.agency);
  const dataset = enrichAlerts(rawAlerts);

  if (options.dryRun) {
    return { dataset };
  }

  const files = await writeGeneratedOutputs(dataset, {
    rootDir: options.outputDir,
  });

  return { dataset, files };
}
