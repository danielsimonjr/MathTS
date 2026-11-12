/**
 * Resolve a real Node.js binary when the test runner is Bun.
 *
 * `[run] bun = true` puts a Bun-backed `node` shim first on PATH, so a gate
 * that spawns `node` would time JavaScriptCore. This matches
 * `tools/benchmark/ab/util.mjs`.
 */
import { existsSync, realpathSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * Executable path for a real Node.js (never Bun's `node` shim).
 *
 * @returns Absolute path to the Node binary used for isolated perf gates.
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
  throw new Error('#692 perf gate needs a real Node.js on PATH (or PERF_NODE=/path/to/node)');
}
