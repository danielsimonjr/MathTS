/**
 * WASM (AssemblyScript) vs JS benchmark harness.
 *
 * Measures the AssemblyScript-accelerated kernels that the `functions` and
 * `matrix` packages dispatch to against their pure-JavaScript fallbacks. Every
 * case is a realistic full round-trip — a JS `Float64Array` (or `number[][]`)
 * goes in, is marshalled across the JS↔wasm boundary, and the result is read
 * back into a fresh JS array — so the reported AS time includes the copy-in /
 * copy-out cost, not just the kernel's inner loop.
 *
 * Methodology:
 *  - The AS path calls the real dispatch helper (e.g. `elementwiseUnaryDispatch`,
 *    `sortF64Dispatch`, `svdWasm`) exactly as production code does, after the AS
 *    binary has been loaded with `initWasm()`. The JS path calls the bridge's
 *    own JS fallback (e.g. `sortF64JS`) or the equivalent `Math.*` loop.
 *  - Timing uses `performance.now()` with a warm-up phase and several timed
 *    reps; the **median** is reported (robust against scheduler jitter).
 *  - A correctness pass runs both paths on one identical input and reports the
 *    maximum absolute difference (`maxdiff`) so any numerical divergence between
 *    the AS kernel and the JS reference is visible.
 *
 * Only real measured numbers are ever printed — nothing here is hard-coded.
 * The numbers are a hardware-specific snapshot; re-run on target hardware for
 * authoritative figures.
 *
 * This module is tsx-runnable and reusable: each *.bench.ts builds an array of
 * {@link WasmCase}s and hands them to {@link runCases}.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One AS-vs-JS benchmark case. `prepare` builds the (reusable) input for a
 * size; `js` and `as` run the two paths on that input and must NOT mutate it
 * (copy internally if the underlying op is in-place, e.g. sort). `maxdiff`
 * reports the worst absolute disagreement between the two outputs.
 */
export interface WasmCase {
  /** Operation name, e.g. "sin", "bessel_j0", "sort_f64", "multiply". */
  op: string;
  /** What the `size` axis counts ("elements", "matrix dim", "samples"). */
  unit: string;
  /** Sizes to sweep (element count, or square-matrix dimension). */
  sizes: number[];
  /** Build the input for a size. Called once per size (reused across reps). */
  prepare: (n: number) => unknown;
  /** Pure-JS path. Must not mutate the prepared input. */
  js: (input: unknown) => unknown | Promise<unknown>;
  /** AssemblyScript-accelerated path. Must not mutate the prepared input. */
  as: (input: unknown) => unknown | Promise<unknown>;
  /** Worst absolute difference between the JS and AS outputs. */
  maxdiff: (jsOut: unknown, asOut: unknown) => number;
  /** Optional per-size iteration override (default: {@link defaultIterations}). */
  iterations?: (n: number) => number;
  /** Optional note printed under the table. */
  note?: string;
}

/** One (size) measurement row. */
export interface RowResult {
  size: number;
  sizeLabel: string;
  /** Median JS wall-clock time (ms). */
  jsMs: number;
  /** Median AS wall-clock time (ms). */
  asMs: number;
  /** asMs / jsMs. < 1 means AS is faster; > 1 means JS wins. */
  ratio: number;
  /** Max absolute difference between AS and JS outputs (correctness). */
  maxdiff: number;
}

/** Full result for one operation. */
export interface OpResult {
  op: string;
  unit: string;
  rows: RowResult[];
  note?: string;
}

// ---------------------------------------------------------------------------
// Timing primitives
// ---------------------------------------------------------------------------

/** Median of a numeric sample (robust central tendency). */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Default iteration policy: more reps for cheap inputs, fewer for expensive
 * ones, keeping each op's total runtime bounded.
 */
export function defaultIterations(size: number): number {
  if (size <= 1e3) return 30;
  if (size <= 1e4) return 20;
  if (size <= 1e5) return 12;
  if (size <= 1e6) return 6;
  return 4;
}

/**
 * Time a (possibly async) thunk: `warmup` untimed runs, then `iterations`
 * timed runs. Returns the median wall-clock time in milliseconds.
 */
export async function timeMedian(
  fn: () => unknown | Promise<unknown>,
  iterations: number,
  warmup = 2
): Promise<number> {
  for (let i = 0; i < warmup; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

// ---------------------------------------------------------------------------
// maxdiff helpers
// ---------------------------------------------------------------------------

/** Max absolute difference between two equal-length f64 arrays (NaN-aware). */
export function maxdiffF64(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (Number.isNaN(x) && Number.isNaN(y)) continue;
    const d = Math.abs(x - y);
    if (d > m) m = d;
  }
  if (a.length !== b.length) return Infinity;
  return m;
}

/** Count of mismatched entries between two equal-length integer arrays. */
export function mismatchCount(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Infinity;
  let c = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) c++;
  return c;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Element-count label, e.g. 1000000 -> "1e6", 16384 -> "16,384". */
export function sciLabel(size: number): string {
  if (size >= 1000 && Math.log10(size) % 1 === 0) return `1e${Math.log10(size)}`;
  return size.toLocaleString('en-US');
}

/** Square-matrix label, e.g. 256 -> "256x256". */
export function squareLabel(dim: number): string {
  return `${dim}x${dim}`;
}

/**
 * True when `importMetaUrl` belongs to the module being executed directly
 * (e.g. `tsx elementwise.bench.ts`), false when it was imported (e.g. by
 * `run.ts`). Robust across Windows drive paths and the `file://` triple-slash.
 */
export function isMainModule(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  // Normalise both to forward-slash, lower-cased, sans file:// + leading slashes.
  const norm = (s: string): string =>
    s
      .replace(/^file:\/\//, '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
      .replace(/\.[cm]?ts$/, '')
      .toLowerCase();
  return norm(importMetaUrl) === norm(entry);
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/** Run one case across its size ladder. */
export async function runCase(bench: WasmCase): Promise<OpResult> {
  const iterFor = bench.iterations ?? defaultIterations;
  const label = bench.unit === 'matrix dim' ? squareLabel : sciLabel;
  const rows: RowResult[] = [];

  for (const size of bench.sizes) {
    const input = bench.prepare(size);

    // Correctness: both paths on the same input.
    const jsOut = await bench.js(input);
    const asOut = await bench.as(input);
    const md = bench.maxdiff(jsOut, asOut);

    const iterations = iterFor(size);
    const jsMs = await timeMedian(() => bench.js(input), iterations);
    const asMs = await timeMedian(() => bench.as(input), iterations);

    rows.push({
      size,
      sizeLabel: label(size),
      jsMs,
      asMs,
      ratio: asMs / jsMs,
      maxdiff: md,
    });
  }

  return { op: bench.op, unit: bench.unit, rows, note: bench.note };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const COL = { size: 13, js: 13, as: 13, ratio: 12, verdict: 11, diff: 12 };

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

/** Format a maxdiff value compactly. */
function fmtDiff(d: number): string {
  if (d === 0) return '0 (exact)';
  if (!Number.isFinite(d)) return 'LENGTH MISMATCH';
  return d.toExponential(2);
}

/** Print a per-operation results table to stdout. */
export function printOpTable(result: OpResult): void {
  console.log('');
  console.log(`## ${result.op}   (size = ${result.unit})`);
  if (result.note) console.log(`   ${result.note}`);
  console.log(
    pad('n', COL.size) +
      pad('JS (ms)', COL.js) +
      pad('AS (ms)', COL.as) +
      pad('AS/JS', COL.ratio) +
      pad('verdict', COL.verdict) +
      pad('maxdiff', COL.diff)
  );
  console.log('-'.repeat(COL.size + COL.js + COL.as + COL.ratio + COL.verdict + COL.diff));
  for (const r of result.rows) {
    const verdict = r.ratio < 1 ? 'AS faster' : 'JS faster';
    console.log(
      pad(r.sizeLabel, COL.size) +
        pad(r.jsMs.toFixed(4), COL.js) +
        pad(r.asMs.toFixed(4), COL.as) +
        pad(`${r.ratio.toFixed(2)}x`, COL.ratio) +
        pad(verdict, COL.verdict) +
        pad(fmtDiff(r.maxdiff), COL.diff)
    );
  }
}

/**
 * Run a list of cases sequentially, printing each op's table, then a summary.
 * `title` heads the section.
 */
export async function runCases(title: string, cases: WasmCase[]): Promise<OpResult[]> {
  console.log('');
  console.log('='.repeat(74));
  console.log(title);
  console.log('AS/JS < 1.00x means AssemblyScript beats the JS fallback (full round-trip).');
  console.log('='.repeat(74));
  const results: OpResult[] = [];
  for (const c of cases) {
    const r = await runCase(c);
    printOpTable(r);
    results.push(r);
  }
  return results;
}
