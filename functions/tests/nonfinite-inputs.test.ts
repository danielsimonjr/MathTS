/**
 * Non-finite inputs (NaN, +Infinity, -Infinity).
 *
 * Contract:
 * 1. A NaN numeric data argument gives NaN, or an all-NaN result of the declared shape.
 * 2. An input that the algorithm can never finish on gives an error, not a loop.
 * 3. No call loops forever. The sweep runs in a worker, and a call that does not
 *    return in its budget fails the test with the name of that call.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as fns from '../src/index.js';
import { erfc, normalCDF, primePi, compare, factory_compare, zeta, isPrime } from '../src/index.js';
import { parallelStatMedian } from '../src/typed/statistics.js';

/** Budget for one call in the sweep worker. A hang fails at this limit. */
const CALL_BUDGET_MS = 10_000;

type Job = {
  name: string;
  sig?: string;
  args: (number | string)[];
  integrand?: 'nan' | 'identity';
};
type Result = { job: Job; out: string };

/**
 * Exports whose result for a NaN argument is correctly not NaN.
 * Each entry gives the reason.
 */
const NOT_NAN_ALLOWLIST: Record<string, string> = {
  im: 'the imaginary part of a real number is 0',
  size: 'the size of a scalar is []',
  compare: 'NaN compares as -1, the same as mathjs compare',
  factory_compare: 'NaN compares as -1, the same as mathjs compare',
  and: 'logical operator on the truth value of NaN (false)',
  or: 'logical operator on the truth value of NaN (false)',
  xor: 'logical operator on the truth value of NaN (false)',
  not: 'logical operator on the truth value of NaN (false)',
  equal: 'IEEE 754 comparison with NaN is false',
  equalScalar: 'IEEE 754 comparison with NaN is false',
  larger: 'IEEE 754 comparison with NaN is false',
  largerEq: 'IEEE 754 comparison with NaN is false',
  smaller: 'IEEE 754 comparison with NaN is false',
  smallerEq: 'IEEE 754 comparison with NaN is false',
  factory_equal: 'IEEE 754 comparison with NaN is false',
  factory_larger: 'IEEE 754 comparison with NaN is false',
  factory_largerEq: 'IEEE 754 comparison with NaN is false',
  factory_smaller: 'IEEE 754 comparison with NaN is false',
  factory_smallerEq: 'IEEE 754 comparison with NaN is false',
  isBounded: 'predicate: NaN is not bounded',
  isInteger: 'predicate: NaN is not an integer',
  isNaN: 'predicate: NaN is NaN',
  isNegative: 'predicate: NaN is not negative',
  isNumeric: 'predicate: NaN has type number',
  isPositive: 'predicate: NaN is not positive',
  isZero: 'predicate: NaN is not zero',
  isPrime: 'predicate: NaN is not prime (pinned to false below)',
  bin: 'formats the value as text: "0bNaN"',
  hex: 'formats the value as text: "0xNaN"',
  oct: 'formats the value as text: "0oNaN"',
  unit: 'builds a Unit whose value is NaN',
  range: 'a range with a NaN bound has no elements',
};

/** A result propagates NaN when it holds a NaN, or when the call refuses the input. */
function propagatesNaN(out: string): boolean {
  return out.includes('NaN') || out.startsWith('throws:');
}

function allNumberJobs(values: string[]): Job[] {
  const jobs: Job[] = [];
  for (const [name, v] of Object.entries(fns)) {
    const sigs = (v as { signatures?: Record<string, unknown> } | undefined)?.signatures;
    if (typeof v !== 'function' || !sigs) continue;
    for (const sig of Object.keys(sigs)) {
      if (!/^number(,\s*number)*$/.test(sig)) continue;
      const n = sig.split(',').length;
      for (let pos = 0; pos < n; pos++) {
        for (const val of values) {
          jobs.push({
            name,
            sig,
            args: Array.from({ length: n }, (_, i) => (i === pos ? val : i === 0 ? 0.5 : 2)),
          });
        }
      }
    }
  }
  return jobs;
}

/** Calls that looped forever before the fix. */
const HANG_ROWS: { job: Job; expect: (out: string) => boolean; want: string }[] = [];
for (const name of ['gcd', 'lcm', 'xgcd']) {
  for (const val of ['NaN', 'Inf', '-Inf']) {
    for (const args of [
      [val, 4],
      [12, val],
    ]) {
      const want = name === 'xgcd' ? '[NaN,NaN,NaN]' : 'NaN';
      HANG_ROWS.push({
        job: { name, sig: 'number,number', args },
        expect: (o) => o === want,
        want,
      });
    }
  }
}
for (const n of ['Inf', 'NaN', 2 ** 53]) {
  HANG_ROWS.push({
    job: { name: 'nextPrime', sig: 'number', args: [n] },
    expect: (o) => o === 'throws:RangeError',
    want: 'throws:RangeError',
  });
}
for (const args of [
  ['-Inf', 2],
  [0.5, 'Inf'],
]) {
  HANG_ROWS.push({
    job: { name: 'range', sig: 'number,number', args },
    expect: (o) => o === 'throws:RangeError',
    want: 'throws:RangeError',
  });
}
for (const v of ['Inf', '-Inf']) {
  HANG_ROWS.push({
    job: { name: 'isPrime', args: [v] },
    expect: (o) => o === 'boolean:false',
    want: 'boolean:false',
  });
}
HANG_ROWS.push(
  { job: { name: 'owensT', args: [] }, expect: (o) => o === 'NaN', want: 'NaN' },
  { job: { name: 'owensT', args: [0.5, 'NaN'] }, expect: (o) => o === 'NaN', want: 'NaN' },
  {
    job: { name: 'quad', args: [0, 'NaN'], integrand: 'identity' },
    expect: (o) => o === '{value:NaN}',
    want: '{value:NaN}',
  },
  {
    job: { name: 'quad', args: [0, 1], integrand: 'nan' },
    expect: (o) => o === '{value:NaN}',
    want: '{value:NaN}',
  },
  {
    job: { name: 'shortestPath', args: [] },
    expect: (o) => o.startsWith('throws:'),
    want: 'throws',
  },
  {
    job: {
      name: 'shortestPath',
      args: [
        [
          [0, 1],
          [1, 0],
        ] as unknown as number,
        0,
        0.5,
      ],
    },
    expect: (o) => o === 'throws:RangeError',
    want: 'throws:RangeError',
  },
  {
    job: { name: 'shortestPath', args: [{ length: 2 } as unknown as number, 0, 1] },
    expect: (o) => o === 'throws:TypeError',
    want: 'throws:TypeError',
  }
);

let bundleDir = '';
let results: Result[] = [];
let sweepJobCount = -1;
let hangError: string | null = null;

beforeAll(async () => {
  bundleDir = mkdtempSync(join(tmpdir(), 'mathts-nonfinite-'));
  const outfile = join(bundleDir, 'functions.mjs');
  await build({
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
  });
  const jobs = [...allNumberJobs(['NaN', 'Inf', '-Inf']), ...HANG_ROWS.map((r) => r.job)];
  sweepJobCount = jobs.length;
  const worker = new Worker(new URL('./helpers/nonfinite-sweep.worker.mjs', import.meta.url), {
    workerData: { bundleUrl: pathToFileURL(outfile).href, jobs },
    stdout: true,
    stderr: true,
  });
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (label: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        hangError = `call did not return in ${CALL_BUDGET_MS} ms: ${label}`;
        void worker.terminate();
        resolve();
      }, CALL_BUDGET_MS);
    };
    arm('loading the bundle');
    worker.on('message', (msg: { type: string; job?: Job; out?: string }) => {
      if (msg.type === 'result' && msg.job) {
        results.push({ job: msg.job, out: msg.out ?? '' });
      } else if (msg.type === 'start' && msg.job) {
        arm(`${msg.job.name}(${msg.job.sig ?? ''}) args=${JSON.stringify(msg.job.args)}`);
      } else if (msg.type === 'done') {
        clearTimeout(timer);
        void worker.terminate();
        resolve();
      }
    });
    worker.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}, 120_000);

afterAll(() => {
  if (bundleDir) rmSync(bundleDir, { recursive: true, force: true });
});

describe('non-finite inputs: sweep of every all-number typed signature', () => {
  it('no call loops forever', () => {
    expect(hangError).toBeNull();
  });

  it('a NaN argument gives NaN, unless the export is in the reviewed allowlist', () => {
    expect(results.length).toBe(sweepJobCount);
    const bad = results
      .filter((r) => r.job.sig && r.job.args.includes('NaN') && !(r.job.name in NOT_NAN_ALLOWLIST))
      .filter((r) => !HANG_ROWS.some((h) => sameJob(h.job, r.job)))
      .filter((r) => !propagatesNaN(r.out))
      .map((r) => `${r.job.name}(${r.job.sig}) ${JSON.stringify(r.job.args)} -> ${r.out}`);
    expect(bad).toEqual([]);
  });

  it('each former hang gives its contract result', () => {
    expect(hangError).toBeNull();
    const bad = HANG_ROWS.map((h) => ({ h, r: results.find((r) => sameJob(r.job, h.job)) }))
      .filter(({ h, r }) => !r || !h.expect(r.out))
      .map(
        ({ h, r }) =>
          `${h.job.name} ${JSON.stringify(h.job.args)} -> ${r?.out ?? 'no result'} (want ${h.want})`
      );
    expect(bad).toEqual([]);
  });
});

function sameJob(a: Job, b: Job): boolean {
  return (
    a.name === b.name &&
    a.sig === b.sig &&
    a.integrand === b.integrand &&
    JSON.stringify(a.args) === JSON.stringify(b.args)
  );
}

describe('non-finite inputs: direct rows', () => {
  it('erfc(NaN) is NaN; erfc(+-Infinity) keeps its limits', () => {
    expect(erfc(NaN)).toBeNaN();
    expect(erfc(Infinity)).toBe(0);
    expect(erfc(-Infinity)).toBe(2);
  });

  it('normalCDF gives NaN for a NaN in any position', () => {
    expect(normalCDF(NaN)).toBeNaN();
    expect(normalCDF(NaN, 0, 1)).toBeNaN();
    expect(normalCDF(0.5, NaN, 1)).toBeNaN();
    expect(normalCDF(0.5, 0, NaN)).toBeNaN();
  });

  it('primePi(NaN) is NaN', () => {
    expect(primePi(NaN)).toBeNaN();
  });

  it('the three-argument median gives NaN for a NaN in any position', () => {
    expect(parallelStatMedian(NaN, 1, 2)).toBeNaN();
    expect(parallelStatMedian(1, NaN, 2)).toBeNaN();
    expect(parallelStatMedian(1, 2, NaN)).toBeNaN();
  });

  it('the typed and the factory compare agree on NaN (-1, as mathjs)', () => {
    for (const [a, b] of [
      [NaN, 1],
      [1, NaN],
      [NaN, NaN],
    ]) {
      expect(compare(a, b)).toBe(-1);
      expect(factory_compare(a, b)).toBe(-1);
    }
  });

  it('zeta(NaN) is NaN; zeta(Infinity) is 1', () => {
    expect(zeta(NaN)).toBeNaN();
    expect(zeta(Infinity)).toBe(1);
  });

  it('isPrime(NaN) is false', () => {
    expect(isPrime(NaN)).toBe(false);
  });
});

describe('non-finite inputs: finite results do not change', () => {
  it('pins a finite sample of each touched function', () => {
    expect(fns.gcd(12, 18)).toBe(6);
    expect(fns.lcm(4, 6)).toBe(12);
    expect(fns.xgcd(240, 46)).toEqual([2, -9, 47]);
    expect(fns.nextPrime(10)).toBe(11);
    expect(erfc(0.5)).toBeCloseTo(0.4795001221869535, 15);
    expect(normalCDF(1)).toBeCloseTo(0.8413447460685429, 14);
    expect(primePi(10)).toBe(4);
    expect(parallelStatMedian(3, 1, 2)).toBe(2);
    expect(compare(1, 2)).toBe(-1);
    expect(compare(2, 1)).toBe(1);
    expect(compare(2, 2)).toBe(0);
    expect(compare(Infinity, Infinity)).toBe(0);
    expect(zeta(2)).toBeCloseTo(Math.PI ** 2 / 6, 12);
    expect(isPrime(7)).toBe(true);
    expect(fns.owensT(0.5, 1)).toBeCloseTo(0.10667106296144822, 12);
    expect(fns.quad((x: number) => x * x, 0, 1).value).toBeCloseTo(1 / 3, 14);
    expect(
      fns.shortestPath(
        [
          [0, 1, 0],
          [1, 0, 1],
          [0, 1, 0],
        ],
        0,
        2
      )
    ).toEqual([0, 1, 2]);
  });
});
