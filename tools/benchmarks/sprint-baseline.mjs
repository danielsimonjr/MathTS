/**
 * Core sprint benchmark baseline (Node / V8).
 *
 *   bunx turbo build --filter=@danielsimonjr/mathts-functions
 *   node tools/benchmarks/sprint-baseline.mjs
 *   node tools/benchmarks/sprint-baseline.mjs --check
 *   node tools/benchmarks/sprint-baseline.mjs --runs 2 > docs/benchmarks/core-sprint-baseline.json
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { BigNumber, Complex, Fraction, sumSquaredDeviations } from '@danielsimonjr/mathts-core';
import { clone, deepMap } from '@danielsimonjr/mathts-core/internal';
import { compileExpr, evaluate, parse } from '@danielsimonjr/mathts-functions';

const WARMUP = 8;
const TIMED_REPS = 5;
const BASELINE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'docs',
  'benchmarks',
  'core-sprint-baseline.json'
);

/**
 * Median wall time of {@link TIMED_REPS} reps of `iterations` calls, after {@link WARMUP} warm-up calls.
 * @param {() => unknown} fn
 * @param {number} iterations
 * @returns {number}
 */
export function medianMs(fn, iterations) {
  for (let i = 0; i < WARMUP; i++) {
    fn();
  }
  /** @type {number[]} */
  const samples = [];
  for (let r = 0; r < TIMED_REPS; r++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(TIMED_REPS / 2)];
}

/** @param {unknown} value */
export function spellFingerprint(value) {
  if (value instanceof Complex) {
    return JSON.stringify({
      re: spellNumber(value.re),
      im: spellNumber(value.im),
    });
  }
  if (value instanceof Fraction) {
    if (typeof value.numerator !== 'bigint' || typeof value.denominator !== 'bigint') {
      throw new TypeError('Fraction numerator/denominator are not bigint');
    }
    return JSON.stringify({
      n: String(value.numerator),
      d: String(value.denominator),
    });
  }
  if (value instanceof BigNumber) {
    return value.toString();
  }
  if (typeof value === 'number') {
    return spellNumber(value);
  }
  return JSON.stringify(value);
}

/** @param {number} n */
function spellNumber(n) {
  if (Object.is(n, -0)) return '-0';
  if (Number.isNaN(n)) return 'NaN';
  return String(n);
}

function makeNestedCloneObject(depth) {
  let obj = { v: depth };
  for (let i = depth - 1; i >= 0; i--) {
    obj = { v: i, child: obj };
  }
  return obj;
}

function buildCases() {
  const a = new Complex(3, 4);
  const b = new Complex(1, 2);
  const z = new Complex(0.7, 0.4);
  const fa = new Fraction(355n, 113n);
  const fb = new Fraction(22n, 7n);
  const xs = new Float64Array(50_000);
  for (let i = 0; i < xs.length; i++) {
    xs[i] = 1e6 + (i % 97) / 97;
  }
  const nested100 = Array.from({ length: 100 }, () => Array.from({ length: 100 }, (_, j) => j));
  const cloneNested = makeNestedCloneObject(20);

  /** @type {{ name: string, iterations: number, run: () => unknown, fingerprint?: () => string }[]} */
  const cases = [
    {
      name: 'complex-add',
      iterations: 200_000,
      run: () => a.add(b),
      fingerprint: () => spellFingerprint(a.add(b)),
    },
    {
      name: 'complex-mul',
      iterations: 200_000,
      run: () => a.multiply(b),
      fingerprint: () => spellFingerprint(a.multiply(b)),
    },
    {
      name: 'complex-abs',
      iterations: 200_000,
      run: () => a.abs(),
      fingerprint: () => spellFingerprint(a.abs()),
    },
    {
      name: 'complex-sqrt',
      iterations: 100_000,
      run: () => z.sqrt(),
      fingerprint: () => spellFingerprint(z.sqrt()),
    },
    {
      name: 'complex-tan',
      iterations: 100_000,
      run: () => z.tan(),
      fingerprint: () => spellFingerprint(z.tan()),
    },
    {
      name: 'complex-log10',
      iterations: 100_000,
      run: () => z.log10(),
      fingerprint: () => spellFingerprint(z.log10()),
    },
    {
      name: 'fraction-add',
      iterations: 100_000,
      run: () => fa.add(fb),
      fingerprint: () => spellFingerprint(fa.add(fb)),
    },
    {
      name: 'fraction-mul',
      iterations: 100_000,
      run: () => fa.multiply(fb),
      fingerprint: () => spellFingerprint(fa.multiply(fb)),
    },
    {
      name: 'fraction-new',
      iterations: 100_000,
      run: () => new Fraction(355n, 113n),
      fingerprint: () => spellFingerprint(new Fraction(355n, 113n)),
    },
    {
      name: 'bignumber-from-number',
      iterations: 50_000,
      run: () => BigNumber.fromNumber(123456789),
      fingerprint: () => spellFingerprint(BigNumber.fromNumber(123456789)),
    },
    {
      name: 'bignumber-from-bigint',
      iterations: 50_000,
      run: () => BigNumber.fromBigInt(123456789n),
      fingerprint: () => spellFingerprint(BigNumber.fromBigInt(123456789n)),
    },
    {
      name: 'sum-squared-deviations',
      iterations: 80,
      run: () => sumSquaredDeviations(xs),
      fingerprint: () => spellFingerprint(sumSquaredDeviations(xs)),
    },
    {
      name: 'deep-map-nested',
      iterations: 200,
      run: () => deepMap(nested100, (x) => x + 1),
      fingerprint: () => spellFingerprint(deepMap(nested100, (x) => x + 1)),
    },
    {
      name: 'clone-nested',
      iterations: 2_000,
      run: () => clone(cloneNested),
      fingerprint: () => spellFingerprint(clone(cloneNested)),
    },
    {
      name: 'control-add',
      iterations: 200_000,
      run: () => a.add(b),
      fingerprint: () => spellFingerprint(a.add(b)),
    },
    {
      name: 'parse-arithmetic',
      iterations: 2_000,
      run: () => parse('1+2*3'),
      fingerprint: () => spellFingerprint(evaluate('1+2*3')),
    },
    {
      name: 'parse-pythagoras',
      iterations: 2_000,
      run: () => parse('sqrt(3^2 + 4^2)'),
      fingerprint: () => spellFingerprint(evaluate('sqrt(3^2 + 4^2)')),
    },
    {
      name: 'parse-trig',
      iterations: 2_000,
      run: () => parse('sin(1)+cos(2)'),
      fingerprint: () => spellFingerprint(evaluate('sin(1)+cos(2)')),
    },
    {
      name: 'parse-object',
      iterations: 2_000,
      run: () => parse('{a: 1, b: 2+3}'),
      fingerprint: () => spellFingerprint(evaluate('{a: 1, b: 2+3}')),
    },
    {
      name: 'parse-matrix',
      iterations: 2_000,
      run: () => parse('[[1, 2], [3, 4]]'),
      fingerprint: () => spellFingerprint(evaluate('[[1, 2], [3, 4]]')),
    },
    {
      name: 'parse-nested',
      iterations: 2_000,
      run: () => parse('('.repeat(20) + '1' + ')'.repeat(20)),
      fingerprint: () => spellFingerprint(evaluate('('.repeat(20) + '1' + ')'.repeat(20))),
    },
    {
      name: 'eval-arithmetic',
      iterations: 10_000,
      run: () => evaluate('1+2*3'),
      fingerprint: () => spellFingerprint(evaluate('1+2*3')),
    },
    {
      name: 'eval-pythagoras',
      iterations: 5_000,
      run: () => evaluate('sqrt(3^2 + 4^2)'),
      fingerprint: () => spellFingerprint(evaluate('sqrt(3^2 + 4^2)')),
    },
    {
      name: 'eval-trig',
      iterations: 5_000,
      run: () => evaluate('sin(1)+cos(2)'),
      fingerprint: () => spellFingerprint(evaluate('sin(1)+cos(2)')),
    },
    {
      name: 'compile-arithmetic',
      iterations: 5_000,
      run: () => {
        const compiled = compileExpr('1+2*3');
        return compiled.evaluate();
      },
      fingerprint: () => {
        const compiled = compileExpr('1+2*3');
        return spellFingerprint(compiled.evaluate());
      },
    },
  ];

  return cases;
}

/** @param {{ name: string, iterations: number, run: () => unknown, fingerprint?: () => string }[]} cases */
export function runSuite(cases) {
  /** @type {Record<string, string>} */
  const fingerprints = {};
  /** @type {Record<string, number>} */
  const medianMsByCase = {};

  for (const c of cases) {
    const fpFn = c.fingerprint ?? (() => spellFingerprint(c.run()));
    const fp = fpFn();
    if (fp === undefined || fp === null || fp.includes('undefined')) {
      throw new Error(`fingerprint empty for ${c.name}: ${fp}`);
    }
    fingerprints[c.name] = fp;

    const ms = medianMs(() => {
      const result = c.run();
      if (result === null) {
        throw new Error(`null result in ${c.name}`);
      }
    }, c.iterations);
    if (!Number.isFinite(ms)) {
      throw new Error(`non-finite timing for ${c.name}`);
    }
    medianMsByCase[c.name] = ms;
  }

  const complexAdd = medianMsByCase['complex-add'];
  const controlAdd = medianMsByCase['control-add'];
  const controlRatio = controlAdd / complexAdd;

  return { fingerprints, medianMsByCase, controlRatio };
}

function loadBaseline() {
  const flag = process.argv.indexOf('--baseline');
  const path =
    flag >= 0 && process.argv[flag + 1]
      ? process.argv[flag + 1]
      : process.env.SPRINT_BASELINE_JSON || BASELINE_PATH;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkMode() {
  const baseline = loadBaseline();
  const { fingerprints, medianMsByCase, controlRatio } = runSuite(buildCases());

  const baselineNames = Object.keys(baseline.fingerprints).sort();
  const liveNames = Object.keys(fingerprints).sort();
  if (baselineNames.join(',') !== liveNames.join(',')) {
    console.error('Case list mismatch');
    console.error('baseline:', baselineNames);
    console.error('live:', liveNames);
    process.exit(1);
  }

  for (const name of liveNames) {
    if (fingerprints[name] !== baseline.fingerprints[name]) {
      console.error(`Fingerprint mismatch for ${name}`);
      console.error('  baseline:', baseline.fingerprints[name]);
      console.error('  live:    ', fingerprints[name]);
      process.exit(1);
    }
  }

  if (controlRatio < 0.25 || controlRatio > 4) {
    console.error(`controlRatio ${controlRatio} outside [0.25, 4]`);
    process.exit(1);
  }

  console.log(JSON.stringify({ medianMs: medianMsByCase, controlRatio }, null, 2));
}

function printMode() {
  const flag = process.argv.indexOf('--runs');
  const runCount = flag >= 0 ? Number(process.argv[flag + 1]) : 1;
  if (!Number.isInteger(runCount) || runCount < 1) {
    throw new Error('--runs needs a positive integer');
  }
  const cases = buildCases();
  /** @type {{ medianMs: Record<string, number>, controlRatio: number }[]} */
  const runs = [];
  /** @type {Record<string, string>} */
  let fingerprints = {};
  for (let r = 0; r < runCount; r++) {
    const result = runSuite(cases);
    if (r > 0 && JSON.stringify(result.fingerprints) !== JSON.stringify(fingerprints)) {
      throw new Error('fingerprints differ between runs');
    }
    fingerprints = result.fingerprints;
    runs.push({
      medianMs: result.medianMsByCase,
      controlRatio: result.controlRatio,
    });
  }
  const payload = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    command: 'node tools/benchmarks/sprint-baseline.mjs',
    note: 'Timings are one machine. Fingerprints are the contract. Not a speedup claim.',
    runs,
    fingerprints,
  };
  console.log(JSON.stringify(payload, null, 2));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  if (process.argv.includes('--check')) {
    checkMode();
  } else {
    printMode();
  }
}
