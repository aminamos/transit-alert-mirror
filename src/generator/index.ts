import fs from 'node:fs/promises';
import path from 'node:path';
import type { AlertDataset } from '../types/index.js';
import { generateMarkdown } from './markdown.js';
import { generateJson } from './json.js';
import { generateHtml } from './html.js';
import { generateRss } from './rss.js';

export * from './markdown.js';
export * from './json.js';
export * from './html.js';
export * from './rss.js';

export interface GenerateOutputsOptions {
  rootDir?: string;
  markdownFile?: string;
  jsonDataFile?: string;
  htmlFile?: string;
  rssFile?: string;
}

export interface GeneratedFilesResult {
  markdownPath: string;
  jsonPath: string;
  htmlPath: string;
  rssPath: string;
}

export async function writeGeneratedOutputs(
  dataset: AlertDataset,
  options: GenerateOutputsOptions = {}
): Promise<GeneratedFilesResult> {
  const rootDir = options.rootDir || process.cwd();

  const markdownPath = options.markdownFile || path.join(rootDir, 'ALERTS.md');
  const jsonPath = options.jsonDataFile || path.join(rootDir, 'data', 'alerts.json');
  const htmlPath = options.htmlFile || path.join(rootDir, 'docs', 'index.html');
  const rssPath = options.rssFile || path.join(rootDir, 'docs', 'feed.xml');

  // Ensure parent directories exist
  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await fs.mkdir(path.dirname(rssPath), { recursive: true });

  const mdContent = generateMarkdown(dataset);
  const jsonContent = generateJson(dataset);
  const htmlContent = generateHtml(dataset);
  const rssContent = generateRss(dataset);

  await Promise.all([
    fs.writeFile(markdownPath, mdContent, 'utf-8'),
    fs.writeFile(jsonPath, jsonContent, 'utf-8'),
    fs.writeFile(htmlPath, htmlContent, 'utf-8'),
    fs.writeFile(rssPath, rssContent, 'utf-8'),
  ]);

  return {
    markdownPath,
    jsonPath,
    htmlPath,
    rssPath,
  };
}
