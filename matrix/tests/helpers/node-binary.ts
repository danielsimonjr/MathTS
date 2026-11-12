/**
 * Resolve a real Node.js binary when the test runner is Bun.
 */
import { existsSync, realpathSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * Resolves the Node binary used for isolated perf gates.
 * @returns Absolute path to the Node binary.
 */
export function nodeBinary(): string {
  if (process.env.PERF_NODE) return process.env.PERF_NODE;
  if (!process.versions.bun) return process.execPath;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    if (!existsSync(candidate)) continue;
    const base = realpathSync(candidate).split('/').pop() ?? '';
    if (!/^bun/i.test(base)) return candidate;
  }
  throw new Error('perf gate needs a real Node.js on PATH (or PERF_NODE=/path/to/node)');
}
