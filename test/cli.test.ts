import { describe, it, expect } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execAsync = promisify(exec);

describe('cli commands', () => {
  const cliPath = path.resolve('src/cli/index.ts');

  it('runs alert-mirror parse successfully', async () => {
    const { stdout } = await execAsync(
      `npx tsx "${cliPath}" parse "NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE. BOARD AT LAKE & 10TH."`
    );

    const jsonText = stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText);
    expect(parsed.affectedRoutes).toContain('Route 21');
    expect(parsed.direction).toBe('Northbound');
    expect(parsed.riderAlternative).toBe('Board at Lake & 10th');
  });

  it('runs alert-mirror json without errors', async () => {
    const { stdout } = await execAsync(`npx tsx "${cliPath}" json`);
    const dataset = JSON.parse(stdout);
    expect(dataset.metadata).toBeDefined();
    expect(Array.isArray(dataset.alerts)).toBe(true);
  });

  it('runs alert-mirror list with route filter', async () => {
    const { stdout } = await execAsync(`npx tsx "${cliPath}" list 21 --limit 2`);
    expect(stdout).toContain('Route "21"');
  });
});
