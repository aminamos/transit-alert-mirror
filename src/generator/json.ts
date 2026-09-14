import type { AlertDataset } from '../types/index.js';

export function generateJson(dataset: AlertDataset, pretty = true): string {
  return JSON.stringify(dataset, null, pretty ? 2 : undefined);
}
