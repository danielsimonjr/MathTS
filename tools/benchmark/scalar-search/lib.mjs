/**
 * Pure helpers for the scalar-search benchmark harness (SR-11).
 *
 * Node built-ins only, so `node --test` can exercise them without loading
 * the workspace packages.
 */
import { existsSync, realpathSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * @param {number[]} xs
 * @returns {number} median of `xs`; NaN for an empty list.
 */
export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Parsed command line for `run.mjs`.
 * @typedef {object} BenchArgs
 * @property {number} reps Minimum timed reps per case (warmup is separate).
 * @property {'node' | 'bun'} engine Engine the caller asked for, or the
 *   runtime the process is already running on.
 * @property {boolean} [help] `--help` was passed.
 */

/**
 * Parse the harness arguments.
 *
 * Supported flags:
 *   --reps <n>    minimum timed reps per case (integer >= 2; default 5)
 *   --engine <e>  `node` or `bun`; anything else is an error
 *   --help        print usage
 *
 * @param {string[]} argv process.argv.slice(2)
 * @param {{ node?: boolean, bun?: boolean }} [runtime] which runtime the
 *   calling process is (defaults derived from process.versions in run.mjs).
 * @returns {BenchArgs}
 */
export function parseArgs(argv, runtime = {}) {
  const current = runtime.node ? 'node' : runtime.bun ? 'bun' : 'node';
  /** @type {BenchArgs} */
  const out = { reps: 5, engine: current };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--reps') {
      const raw = argv[i + 1];
      if (raw === undefined) throw new Error('bench: --reps needs a number');
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 2) {
        throw new Error(`bench: --reps must be an integer >= 2, got ${raw}`);
      }
      out.reps = value;
      i++;
    } else if (flag === '--engine') {
      const value = argv[i + 1];
      if (value !== 'node' && value !== 'bun') {
        throw new Error(`bench: --engine must be "node" or "bun", got ${value}`);
      }
      out.engine = value;
      i++;
    } else if (flag === '--help') {
      out.help = true;
    } else {
      throw new Error(`bench: unknown argument ${flag} (try --help)`);
    }
  }
  return out;
}

/**
 * The executable of a real Node.js, for a `--engine node` re-exec from Bun.
 *
 * `bun run <script>` (bunfig `[run] bun = true`) puts a `node` shim that is Bun
 * itself at the front of PATH, and `process.execPath` is then Bun, so under Bun
 * this takes `PERF_NODE` or the first `node` on PATH that is not Bun — the same
 * rule as `tools/benchmark/ab/util.mjs`.
 * @returns {string}
 */
export function nodeBinary() {
  if (process.env.PERF_NODE) return process.env.PERF_NODE;
  if (!process.versions.bun) return process.execPath;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    if (!existsSync(candidate)) continue;
    if (!/^bun/i.test(realpathSync(candidate).split('/').pop() ?? '')) return candidate;
  }
  throw new Error('scalar-search bench needs a real Node.js on PATH (or PERF_NODE=/path/to/node)');
}
