#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncAlerts } from '../index.js';
import { defaultRegistry } from '../fetcher/index.js';
import { enrichAlert, enrichAlerts } from '../enricher/index.js';
import type { AlertSeverity, RawAlert } from '../types/index.js';

export function createProgram(): Command {
  const program = new Command();

  program
  .name('alert-mirror')
  .description('Plain-English transit alert enrichment engine & markdown mirror')
  .version('1.0.0');

program
  .command('sync')
  .description('Download transit alerts, enrich with NLP heuristics, and generate ALERTS.md, data/alerts.json, and web dashboard')
  .option('-o, --output <dir>', 'Output root directory', process.cwd())
  .option('-a, --agency <name>', 'Target specific agency (default: all registered agencies)')
  .option('--dry-run', 'Fetch and enrich without writing files')
  .option('-v, --verbose', 'Print verbose log messages')
  .action(async (options) => {
    try {
      console.log(pc.cyan('🚌 Starting transit alert sync & enrichment...'));
      const startTime = Date.now();

      const result = await syncAlerts({
        outputDir: options.output,
        agency: options.agency,
        dryRun: options.dryRun,
        verbose: options.verbose,
      });

      const { metadata } = result.dataset;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(pc.green(`✔ Successfully processed ${metadata.totalAlerts} alerts in ${elapsed}s`));
      console.log(`  ${pc.red('●')} Critical: ${metadata.criticalCount}`);
      console.log(`  ${pc.yellow('●')} Moderate: ${metadata.moderateCount}`);
      console.log(`  ${pc.blue('●')} Minor:    ${metadata.minorCount}`);
      console.log(`  ${pc.magenta('●')} Routes affected: ${metadata.affectedRoutesCount}`);

      if (!options.dryRun && result.files) {
        console.log(pc.cyan('\nGenerated Artifacts:'));
        console.log(`  📄 Markdown:  ${pc.bold(path.relative(process.cwd(), result.files.markdownPath))}`);
        console.log(`  📦 JSON Data: ${pc.bold(path.relative(process.cwd(), result.files.jsonPath))}`);
        console.log(`  🌐 Dashboard: ${pc.bold(path.relative(process.cwd(), result.files.htmlPath))}`);
        console.log(`  📡 RSS Feed:  ${pc.bold(path.relative(process.cwd(), result.files.rssPath))}`);
      }
    } catch (err: unknown) {
      console.error(pc.red(`\n✖ Error during sync:`), err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('list [route]')
  .description('List enriched transit alerts in terminal, optionally filtered by route')
  .option('-s, --severity <level>', 'Filter by severity: Critical, Moderate, or Minor')
  .option('-l, --limit <number>', 'Maximum alerts to show', '15')
  .option('--agency <name>', 'Target agency')
  .action(async (routeArg, options) => {
    try {
      // First try loading existing data/alerts.json, else fetch live
      let dataset;
      const localJsonPath = path.join(process.cwd(), 'data', 'alerts.json');
      try {
        const rawContent = await fs.readFile(localJsonPath, 'utf-8');
        dataset = JSON.parse(rawContent);
      } catch {
        // Fallback to live fetch
        const rawAlerts = await defaultRegistry.fetchAll(options.agency);
        dataset = enrichAlerts(rawAlerts);
      }

      let alerts = dataset.alerts;

      if (routeArg) {
        const needle = routeArg.toLowerCase().replace(/^route\s*/i, '');
        alerts = alerts.filter((a: any) =>
          a.affectedRoutes.some((r: string) => r.toLowerCase().includes(needle))
        );
      }

      if (options.severity) {
        const sev = options.severity.toLowerCase();
        alerts = alerts.filter((a: any) => a.severity.toLowerCase() === sev);
      }

      const limit = parseInt(options.limit, 10) || 15;
      const displayed = alerts.slice(0, limit);

      if (displayed.length === 0) {
        console.log(pc.yellow(`No alerts found matching route: "${routeArg || 'all'}"`));
        return;
      }

      console.log(
        pc.bold(`\nShowing ${displayed.length} of ${alerts.length} alerts for ${routeArg ? `Route "${routeArg}"` : 'All Routes'}:\n`)
      );

      for (const a of displayed) {
        const sevColor =
          a.severity === 'Critical'
            ? pc.bgRed(pc.white(` ${a.severity.toUpperCase()} `))
            : a.severity === 'Moderate'
            ? pc.bgYellow(pc.black(` ${a.severity.toUpperCase()} `))
            : pc.bgBlue(pc.white(` ${a.severity.toUpperCase()} `));

        console.log(`${sevColor} ${pc.bold(a.title)}`);
        console.log(`  ${pc.gray('Routes:')} ${a.affectedRoutes.join(', ')}  |  ${pc.gray('Direction:')} ${a.direction}`);
        console.log(`  ${pc.gray('Summary:')} ${a.summary}`);

        if (a.riderAlternative) {
          console.log(`  ${pc.cyan('💡 Alternative:')} ${pc.bold(a.riderAlternative)}`);
        }

        if (a.closedStopIds && a.closedStopIds.length > 0) {
          console.log(`  ${pc.gray('Closed Stops:')} ${a.closedStopIds.map((id: string) => '#' + id).join(', ')}`);
        }

        console.log('');
      }
    } catch (err: unknown) {
      console.error(pc.red(`\n✖ Failed to list alerts:`), err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('json [route]')
  .description('Print normalized JSON dataset or route-filtered alerts to stdout')
  .option('-p, --pretty', 'Pretty-print JSON', true)
  .action(async (routeArg) => {
    try {
      const localJsonPath = path.join(process.cwd(), 'data', 'alerts.json');
      let dataset;
      try {
        const rawContent = await fs.readFile(localJsonPath, 'utf-8');
        dataset = JSON.parse(rawContent);
      } catch {
        const rawAlerts = await defaultRegistry.fetchAll();
        dataset = enrichAlerts(rawAlerts);
      }

      if (routeArg) {
        const needle = routeArg.toLowerCase().replace(/^route\s*/i, '');
        const filtered = dataset.alerts.filter((a: any) =>
          a.affectedRoutes.some((r: string) => r.toLowerCase().includes(needle))
        );
        console.log(JSON.stringify(filtered, null, 2));
      } else {
        console.log(JSON.stringify(dataset, null, 2));
      }
    } catch (err: unknown) {
      console.error(pc.red(`\n✖ Failed to output JSON:`), err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('parse <text>')
  .description('Test NLP enrichment engine directly on raw dispatcher text')
  .option('-d, --desc <desc>', 'Optional detailed description')
  .action(async (text, options) => {
    const raw: RawAlert = {
      id: 'test-preview',
      agency: 'Manual Input',
      headerText: text,
      descriptionText: options.desc || '',
      informedEntities: [],
    };

    const enriched = enrichAlert(raw);
    console.log(pc.cyan('\nEnriched Result:'));
    console.log(JSON.stringify(enriched, null, 2));
  });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<Command> {
  const program = createProgram();
  return program.parseAsync(argv);
}

const isMain = Boolean(
  process.argv[1] &&
  (
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    process.argv[1].endsWith('alert-mirror')
  )
);

/* v8 ignore start */
if (isMain) {
  runCli();
}
/* v8 ignore stop */


