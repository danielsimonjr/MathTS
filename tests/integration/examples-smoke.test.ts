import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TIMEOUT_MS = 60_000;

/** README-listed example commands (see `examples/README.md`). */
const EXAMPLE_RUNS: { label: string; command: string; args: string[] }[] = [
  {
    label: 'basic-arithmetic',
    command: 'bun',
    args: ['--tsconfig-override=tsconfig.base.json', 'examples/basic-arithmetic.ts'],
  },
  {
    label: 'basic-matrix',
    command: 'bun',
    args: ['--tsconfig-override=tsconfig.base.json', 'examples/basic-matrix.ts'],
  },
  {
    label: 'parallel-computing',
    command: 'bun',
    args: ['--tsconfig-override=tsconfig.base.json', 'examples/parallel-computing.ts'],
  },
  {
    label: 'matrix-operations',
    command: 'bun',
    args: ['--tsconfig-override=tsconfig.base.json', 'examples/matrix-operations.ts'],
  },
  {
    label: 'mathjs-migration',
    command: 'bun',
    args: ['--tsconfig-override=tsconfig.base.json', 'examples/mathjs-migration.ts'],
  },
  {
    label: 'basic-workbook',
    command: 'bun',
    args: ['workbook/dist/cli.js', 'run', 'examples/basic-workbook.mtsw'],
  },
  {
    label: 'lightspeed-workbook',
    command: 'bun',
    args: ['workbook/dist/cli.js', 'run', 'examples/lightspeed.mtsw'],
  },
];

function runExample(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: REPO,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      rejectPromise(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      rejectPromise(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: code, signal });
    });
  });
}

describe('examples smoke (README commands)', () => {
  for (const { label, command, args } of EXAMPLE_RUNS) {
    it(
      label,
      async () => {
        const { exitCode, signal } = await runExample(command, args, TIMEOUT_MS);
        expect(signal, `${label}: killed by signal`).toBeNull();
        expect(exitCode, `${label}: non-zero exit`).toBe(0);
      },
      TIMEOUT_MS + 5_000
    );
  }
});
