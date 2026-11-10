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

/**
 * Budgets for the sweep worker. A call that does not return in its budget fails the test.
 * Measured on an idle machine: the bundle loads in about 1 s, the slowest call takes 2 ms,
 * and the full sweep of 1,344 calls takes about 1 s. The budgets allow for CI load.
 */
const LOAD_BUDGET_MS = 30_000;
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
  and: 'NaN is falsy, so and(NaN, x) is false',
  or: 'NaN is falsy, so or(NaN, 2) is the truth value of 2 (true)',
  xor: 'NaN is falsy, so xor(NaN, 2) is the truth value of 2 (true)',
  not: 'NaN is falsy, so not(NaN) is true',
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
  range: 'a range with a NaN bound has no elements',
};

/**
 * Exports that refuse a NaN argument with an error, and the error classes each may throw.
 * Most validate an integer, a sign or a selector argument. Any other throw fails the test.
 */
const THROWS_ON_NAN: Record<string, string[]> = {
  bellNumbers: ['TypeError'],
  bernoulli: ['RangeError'],
  bin: ['Error'],
  bitAnd: ['Error'],
  bitNot: ['Error'],
  bitOr: ['Error'],
  bitXor: ['Error'],
  carmichaelLambda: ['Error'],
  catalan: ['TypeError'],
  combinations: ['TypeError'],
  combinationsWithRep: ['TypeError'],
  composition: ['TypeError'],
  divisorSigma: ['Error'],
  divisors: ['Error'],
  doubleFactorial: ['Error'],
  eulerPhi: ['Error'],
  factory_ceil: ['RangeError'],
  factory_fix: ['RangeError'],
  factory_floor: ['RangeError'],
  factory_gcd: ['Error'],
  factory_lcm: ['Error'],
  factory_round: ['Error'],
  factory_xgcd: ['Error'],
  fallingFactorial: ['Error'],
  fibonacci: ['Error'],
  harmonicNumber: ['Error'],
  hex: ['Error'],
  identity: ['Error'],
  integerDigits: ['Error'],
  invmod: ['Error'],
  jacobiSymbol: ['Error'],
  lambertW: ['Error'],
  leftShift: ['Error'],
  lucas: ['Error'],
  lucasL: ['Error'],
  moebiusMu: ['Error'],
  oct: ['Error'],
  partitions: ['Error'],
  permutations: ['TypeError'],
  prime: ['Error'],
  primeFactors: ['Error'],
  randomInt: ['RangeError', 'TypeError'],
  range: ['TypeError'],
  rightArithShift: ['Error'],
  rightLogShift: ['Error'],
  risingFactorial: ['Error'],
  stirlingS2: ['TypeError'],
  subfactorial: ['Error'],
};

/** The error class of a thrown result, or null when the call returned. */
function thrownClass(out: string): string | null {
  return out.startsWith('throws:') ? out.slice('throws:'.length) : null;
}

/** True when the result is acceptable for a NaN argument to the named export. */
function acceptsNaNResult(name: string, out: string): boolean {
  const cls = thrownClass(out);
  if (cls !== null) return THROWS_ON_NAN[name]?.includes(cls) ?? false;
  return out.includes('NaN') || name in NOT_NAN_ALLOWLIST;
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

/**
 * Plain exports whose finite base call (0.5, 2, 2, ...) returns a number, but which do not
 * take numbers. A number argument is not valid input for them, so their result for a NaN
 * argument is not checked.
 */
const PLAIN_NOT_SCALAR: Record<string, string> = {
  chebyshevDistance: 'takes two point arrays',
  distanceND: 'takes two point arrays',
  divergence: 'takes a vector field callback and a point',
  graphDistance: 'takes an adjacency matrix',
  hermiteInterp: 'takes node, value and derivative arrays',
  identityMutation: 'genetic operator; takes a genome',
  inCircle: 'takes point arrays',
  integerNthRoot: 'takes a bigint',
  invFourier: 'takes a coefficient array',
  lagrangeInterp: 'takes node and value arrays',
  logsumexp: 'takes an array',
  manhattanDistance: 'takes two point arrays',
  minkowskiDistance: 'takes two point arrays',
  mutualInformation: 'takes two sample arrays',
  orient2D: 'takes point arrays',
  orient3D: 'takes point arrays',
  polygonArea: 'takes a vertex array',
  polygonPerimeter: 'takes a vertex array',
  polyval: 'takes a coefficient array',
  replacer: 'JSON replacer; takes a key and a value',
  reviver: 'JSON reviver; takes a key and a value',
  substitute: 'takes an expression and a scope',
  trapz: 'takes sample arrays',
  trapzF64: 'takes a Float64Array',
};

/** Plain scalar exports that refuse a NaN argument, with the error classes each may throw. */
const PLAIN_THROWS_ON_NAN: Record<string, string[]> = {
  clebschGordan: ['RangeError'],
  integerSqrt: ['RangeError'],
  mvnPdf: ['Error'],
  truncatedNormalMean: ['RangeError'],
  wigner3j: ['RangeError'],
  wigner6j: ['RangeError'],
};

/** A base result is scalar when it prints as a number. */
const isScalarOut = (out: string) => /^-?(\d|Infinity)/.test(out);

/**
 * Plain (not typed) function exports. The arity is fn.length; classes are skipped. Each
 * gets one finite base call, then one non-finite value per parameter. Every call is
 * checked for hangs. When the base call returns a number, a NaN argument must give NaN.
 */
function plainFunctionJobs(values: string[]): Job[] {
  const jobs: Job[] = [];
  for (const [name, v] of Object.entries(fns)) {
    if (typeof v !== 'function' || 'signatures' in v || v.length === 0) continue;
    if (/^class\b/.test(Function.prototype.toString.call(v))) continue;
    const proto = (v as { prototype?: object }).prototype;
    if (proto && Object.getOwnPropertyNames(proto).length > 1) continue;
    jobs.push({ name, args: Array.from({ length: v.length }, (_, i) => (i === 0 ? 0.5 : 2)) });
    for (let pos = 0; pos < v.length; pos++) {
      for (const val of values) {
        jobs.push({
          name,
          args: Array.from({ length: v.length }, (_, i) => (i === pos ? val : i === 0 ? 0.5 : 2)),
        });
      }
    }
  }
  return jobs;
}

/** Calls that looped forever, or gave a wrong value, before the fix. */
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
/** T(h, +-Infinity) = +-(1 - Phi(|h|)) / 2. */
const OWENS_T_INF = (1 - (normalCDF(0.5) as number)) / 2;
const near = (o: string, want: number) => Math.abs(Number(o) - want) < 1e-12;
HANG_ROWS.push(
  {
    job: { name: 'owensT', args: [] },
    expect: (o) => o === 'throws:TypeError',
    want: 'throws:TypeError',
  },
  { job: { name: 'owensT', args: [0.5, 'NaN'] }, expect: (o) => o === 'NaN', want: 'NaN' },
  {
    job: { name: 'owensT', args: [0.5, 'Inf'] },
    expect: (o) => near(o, OWENS_T_INF),
    want: String(OWENS_T_INF),
  },
  {
    job: { name: 'owensT', args: [0.5, '-Inf'] },
    expect: (o) => near(o, -OWENS_T_INF),
    want: String(-OWENS_T_INF),
  },
  {
    job: { name: 'quad', args: [0, 'NaN'], integrand: 'identity' },
    expect: (o) => o === 'throws:RangeError',
    want: 'throws:RangeError',
  },
  {
    job: { name: 'quad', args: [0, 'Inf'], integrand: 'identity' },
    expect: (o) => o === 'throws:RangeError',
    want: 'throws:RangeError',
  },
  { job: { name: 'ferrersP', args: ['Inf', 2, 2] }, expect: (o) => o === 'NaN', want: 'NaN' },
  { job: { name: 'siegelZ', args: ['Inf'] }, expect: (o) => o === 'NaN', want: 'NaN' },
  { job: { name: 'siegelZ', args: ['-Inf'] }, expect: (o) => o === 'NaN', want: 'NaN' },
  { job: { name: 'trigamma', args: ['-Inf'] }, expect: (o) => o === 'NaN', want: 'NaN' },
  {
    job: { name: 'zipfPMF', args: [1, 2, 'Inf'] },
    expect: (o) => o === 'throws:RangeError',
    want: 'throws:RangeError',
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
    // Finite-input change: main returned [] for a non-integer start.
    job: {
      name: 'shortestPath',
      args: [
        [
          [0, 1],
          [1, 0],
        ] as unknown as number,
        0.5,
        1,
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
  const jobs = [
    ...allNumberJobs(['NaN', 'Inf', '-Inf']),
    ...plainFunctionJobs(['NaN', 'Inf', '-Inf']),
    ...HANG_ROWS.map((r) => r.job),
  ];
  sweepJobCount = jobs.length;
  const worker = new Worker(new URL('./helpers/nonfinite-sweep.worker.mjs', import.meta.url), {
    workerData: { bundleUrl: pathToFileURL(outfile).href, jobs },
    stdout: true,
    stderr: true,
  });
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (label: string, budget: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        hangError = `call did not return in ${budget} ms: ${label}`;
        void worker.terminate();
        resolve();
      }, budget);
    };
    arm('loading the bundle', LOAD_BUDGET_MS);
    worker.on('message', (msg: { type: string; job?: Job; out?: string }) => {
      if (msg.type === 'result' && msg.job) {
        results.push({ job: msg.job, out: msg.out ?? '' });
      } else if (msg.type === 'start' && msg.job) {
        arm(
          `${msg.job.name}(${msg.job.sig ?? ''}) args=${JSON.stringify(msg.job.args)}`,
          CALL_BUDGET_MS
        );
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

describe('non-finite inputs: sweep of typed signatures and plain functions', () => {
  it('no call loops forever', () => {
    expect(hangError).toBeNull();
  });

  it('a NaN argument gives NaN, unless the export is in the reviewed allowlist', () => {
    expect(results.length).toBe(sweepJobCount);
    const bad = results
      .filter((r) => r.job.sig && r.job.args.includes('NaN'))
      .filter((r) => !HANG_ROWS.some((h) => sameJob(h.job, r.job)))
      .filter((r) => !acceptsNaNResult(r.job.name, r.out))
      .map((r) => `${r.job.name}(${r.job.sig}) ${JSON.stringify(r.job.args)} -> ${r.out}`);
    expect(bad).toEqual([]);
  });

  it('a plain export that returns a number gives NaN for a NaN argument', () => {
    const plain = results.filter(
      (r) => !r.job.sig && !HANG_ROWS.some((h) => sameJob(h.job, r.job))
    );
    const scalar = new Set(
      plain
        .filter((r) => r.job.args.every((a) => typeof a === 'number') && isScalarOut(r.out))
        .map((r) => r.job.name)
    );
    expect(scalar.size).toBeGreaterThan(50);
    const bad = plain
      .filter((r) => scalar.has(r.job.name) && r.job.args.includes('NaN'))
      .filter((r) => !(r.job.name in PLAIN_NOT_SCALAR))
      .filter((r) => {
        const cls = thrownClass(r.out);
        if (cls !== null) return !(PLAIN_THROWS_ON_NAN[r.job.name]?.includes(cls) ?? false);
        return !r.out.includes('NaN');
      })
      .map((r) => `${r.job.name} ${JSON.stringify(r.job.args)} -> ${r.out}`);
    expect(bad).toEqual([]);
    const dead = [
      ...Object.keys(PLAIN_NOT_SCALAR).filter(
        (name) =>
          !plain.some(
            (r) =>
              r.job.name === name &&
              r.job.args.includes('NaN') &&
              thrownClass(r.out) === null &&
              !r.out.includes('NaN')
          )
      ),
      ...Object.entries(PLAIN_THROWS_ON_NAN).flatMap(([name, classes]) =>
        classes
          .filter(
            (cls) =>
              !plain.some(
                (r) =>
                  r.job.name === name && r.job.args.includes('NaN') && thrownClass(r.out) === cls
              )
          )
          .map((cls) => `${name}:${cls}`)
      ),
    ];
    expect(dead).toEqual([]);
  });

  it('every allowlist entry is still needed', () => {
    const nanResults = results.filter((r) => r.job.sig && r.job.args.includes('NaN'));
    const deadNotNaN = Object.keys(NOT_NAN_ALLOWLIST).filter(
      (name) =>
        !nanResults.some(
          (r) => r.job.name === name && thrownClass(r.out) === null && !r.out.includes('NaN')
        )
    );
    const deadThrows = Object.entries(THROWS_ON_NAN).flatMap(([name, classes]) =>
      classes
        .filter((cls) => !nanResults.some((r) => r.job.name === name && thrownClass(r.out) === cls))
        .map((cls) => `${name}:${cls}`)
    );
    expect([...deadNotNaN, ...deadThrows]).toEqual([]);
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

  it('acoth, asech, acsc and asec give the complex value off the real domain', () => {
    const c = (v: unknown) => [(v as { re: number }).re, (v as { im: number }).im];
    expect(c(fns.acoth(0.5))[0]).toBeCloseTo(0.5493061443340548, 14);
    expect(c(fns.acoth(0.5))[1]).toBeCloseTo(-1.5707963267948966, 14);
    expect(c(fns.factory_acsc(0.5))[1]).toBeCloseTo(-1.3169578969248166, 14);
    expect(c(fns.factory_asec(0.5))[1]).toBeCloseTo(1.3169578969248166, 14);
    expect(c(fns.asech(2))[1]).toBeCloseTo(1.0471975511965976, 14);
    for (const f of [fns.acoth, fns.asech, fns.factory_acsc, fns.factory_asec]) {
      expect(c(f(NaN)).some(Number.isNaN)).toBe(true);
    }
  });
});

describe('non-finite inputs: plain scalar functions give NaN for a NaN argument', () => {
  type F = (...a: number[]) => number;
  const f = (name: string) => (fns as unknown as Record<string, F>)[name];
  const rows: [string, number[]][] = [
    ['fQuantile', [NaN, 2, 2]],
    ['fQuantile', [0.5, NaN, 2]],
    ['fQuantile', [0.5, 2, NaN]],
    ['gammaQuantile', [NaN, 2]],
    ['gammaQuantile', [0.5, NaN]],
    ['gammaQuantile', [0.5, 2, NaN]],
    ['studentTQuantile', [NaN, 2]],
    ['studentTQuantile', [0.5, NaN]],
    ['studentizedRangeCDF', [NaN, 3, 10]],
    ['studentizedRangeCDF', [2, NaN, 10]],
    ['studentizedRangeCDF', [2, 3, NaN]],
    ['studentizedRangeQuantile', [NaN, 3, 10]],
    ['studentizedRangeQuantile', [0.5, NaN, 10]],
    ['studentizedRangeQuantile', [0.5, 3, NaN]],
    ['jacobiSN', [0.5, NaN]],
    ['jacobiSN', [NaN, 0.3]],
    ['jacobiCN', [0.5, NaN]],
    ['jacobiCN', [NaN, 0.3]],
    ['skellamPMF', [NaN, 2, 2]],
    ['skellamPMF', [1, NaN, 2]],
    ['skellamPMF', [1, 2, NaN]],
    ['zipfPMF', [NaN, 2, 5]],
    ['zipfPMF', [1, NaN, 5]],
    ['zipfPMF', [1, 2, NaN]],
    ['clamp', [0.5, NaN, 2]],
    ['clamp', [0.5, 0, NaN]],
    ['clamp', [NaN, 0, 1]],
    ['ferrersP', [0.5, 2, NaN]],
    ['ferrersP', [2, 1, NaN]],
  ];
  for (const [name, args] of rows) {
    it(`${name}(${args.join(', ')}) is NaN`, () => {
      expect(f(name)(...args)).toBeNaN();
    });
  }
  it('finite results do not change', () => {
    expect(f('fQuantile')(0.5, 2, 2)).toBeCloseTo(1, 9);
    expect(f('gammaQuantile')(0.5, 1)).toBeCloseTo(Math.LN2, 9);
    expect(f('studentTQuantile')(0.975, 10)).toBeCloseTo(2.2281388519649385, 8);
    expect(f('jacobiSN')(0.5, 0.3)).toBeCloseTo(0.4742156227, 9);
    expect(f('jacobiCN')(0.5, 0.3)).toBeCloseTo(0.8804087364, 9);
    expect(f('zipfPMF')(1, 2, 2)).toBeCloseTo(0.8, 14);
    expect(f('clamp')(5, 0, 1)).toBe(1);
    expect(f('skellamPMF')(0, 1, 1)).toBeCloseTo(Math.exp(-2) * 2.2795853023360673, 12);
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
