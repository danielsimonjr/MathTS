/** Shared helpers for the Phase 7 A/B harness. */
import { existsSync, realpathSync } from 'node:fs';
import { basename, delimiter, join } from 'node:path';

/** @param {number} seed */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number[]} xs positive numbers */
export function geometricMean(xs) {
  if (xs.length === 0) return NaN;
  let sum = 0;
  for (const x of xs) sum += Math.log(x);
  return Math.exp(sum / xs.length);
}

/** @param {number[]} xs */
export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** @param {string} repoRoot */
export function perfBaseDir(repoRoot) {
  return `${repoRoot}/node_modules/.perf-base`;
}

/** @param {string} repoRoot */
export function perfControlDir(repoRoot) {
  return `${repoRoot}/node_modules/.perf-base-control`;
}

/**
 * @param {import('node:path').PathLike} repoRoot
 * @param {'base' | 'control'} which
 */
export function treeModuleRoot(repoRoot, which = 'base') {
  const sub = which === 'control' ? '.perf-base-control' : '.perf-base';
  return `${repoRoot}/node_modules/${sub}/node_modules`;
}

/**
 * The executable of a real Node.js, for the `node` engine rows.
 *
 * `bun run <script>` (bunfig `[run] bun = true`) puts a `node` shim that is Bun itself at the
 * front of PATH, and `process.execPath` is then Bun. A "Node" column that ran on Bun would
 * measure one engine twice, so under Bun this looks for a `node` on PATH that is not Bun, or
 * takes `PERF_NODE`.
 * @returns {string}
 */
export function nodeBinary() {
  if (process.env.PERF_NODE) return process.env.PERF_NODE;
  if (!process.versions.bun) return process.execPath;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    if (!existsSync(candidate)) continue;
    if (!/^bun/i.test(basename(realpathSync(candidate)))) return candidate;
  }
  throw new Error('bench:ab needs a real Node.js on PATH (or PERF_NODE=/path/to/node)');
}
