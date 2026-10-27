import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 2_000;

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

function readmeRunCommands(): string[] {
  const text = readFileSync(resolve(REPO, 'examples/README.md'), 'utf8');
  const cmds: string[] = [];
  for (const block of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const line of block[1].split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('#')) cmds.push(trimmed);
    }
  }
  return cmds;
}

function killChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill(signal);
  } catch {
    // already gone
  }
}

function runExample(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: REPO,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Drain stdout so a chatty example cannot fill the pipe and deadlock.
    child.stdout?.resume();
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
      if (stderr.length > 8_192) stderr = stderr.slice(-8_192);
    });

    let settled = false;
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (
      err: Error | undefined,
      result?: { exitCode: number | null; signal: NodeJS.Signals | null; stderr: string }
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer !== undefined) clearTimeout(killTimer);
      if (err) rejectPromise(err);
      else resolvePromise(result!);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killChild(child, 'SIGTERM');
      killTimer = setTimeout(() => killChild(child, 'SIGKILL'), KILL_GRACE_MS);
    }, timeoutMs);

    child.on('error', (err) => {
      finish(err);
    });

    child.on('close', (code, signal) => {
      if (timedOut) {
        finish(new Error(`timeout after ${timeoutMs}ms`));
        return;
      }
      finish(undefined, { exitCode: code, signal, stderr });
    });
  });
}

describe('examples smoke (README commands)', () => {
  it('covers every README bash command and does not run lightspeed.html', () => {
    const fromReadme = readmeRunCommands();
    const fromTable = EXAMPLE_RUNS.map(({ command, args }) => [command, ...args].join(' '));
    expect(fromTable).toEqual(fromReadme);
    expect(fromReadme.join('\n')).not.toMatch(/lightspeed\.html/);
  });

  for (const { label, command, args } of EXAMPLE_RUNS) {
    it(
      label,
      async () => {
        const { exitCode, signal, stderr } = await runExample(command, args, TIMEOUT_MS);
        expect(signal, `${label}: killed by signal${stderr ? `\n${stderr}` : ''}`).toBeNull();
        expect(exitCode, `${label}: non-zero exit${stderr ? `\n${stderr}` : ''}`).toBe(0);
      },
      TIMEOUT_MS + KILL_GRACE_MS + 5_000
    );
  }
});
