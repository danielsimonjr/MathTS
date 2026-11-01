/**
 * P7-1 pins: dense QR number fast path, resume fallback, and Complex generic path.
 * Goldens captured from the pre-optimization implementation (Object.is on number cells).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { matrix, qr } from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createQr } from '../src/algebra/decomposition/qr.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/p7-qr-golden.jsonl');

type GoldenCase = {
  name: string;
  A: unknown[][];
  Q: unknown[][];
  R: unknown[][];
};

function jsonReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (o.__num === 'NaN') return NaN;
    if (o.__num === '-0') return -0;
    if (o.__num === 'Infinity') return Infinity;
    if (o.__num === '-Infinity') return -Infinity;
    if (o.__complex === true) return { re: o.re as number, im: o.im as number };
  }
  return value;
}

function toTestCell(cell: unknown): unknown {
  return isComplexLike(cell) ? new Complex(cell.re, cell.im) : cell;
}

function loadGoldens(): GoldenCase[] {
  return readFileSync(fixturePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line, jsonReviver) as GoldenCase);
}

function isComplexLike(v: unknown): v is { re: number; im: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    're' in v &&
    'im' in v &&
    typeof (v as { re: unknown }).re === 'number' &&
    typeof (v as { im: unknown }).im === 'number'
  );
}

function expectMatrixBitExact(actual: unknown[][], expected: unknown[][]): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].length).toBe(expected[i]!.length);
    for (let j = 0; j < actual[i]!.length; j++) {
      const a = actual[i]![j];
      const e = expected[i]![j];
      if (isComplexLike(a) && isComplexLike(e)) {
        expect(Object.is(a.re, e.re)).toBe(true);
        expect(Object.is(a.im, e.im)).toBe(true);
      } else if (isComplexLike(a) || isComplexLike(e)) {
        expect.unreachable('one side is a Complex cell and the other is not');
      } else {
        expect(Object.is(a, e)).toBe(true);
      }
    }
  }
}

const goldens = loadGoldens();
const byName = new Map(goldens.map((g) => [g.name, g]));

describe('P7-1 qr number path — golden Q/R', () => {
  for (const name of [
    '2x2',
    '8x8',
    '20x60',
    '60x20',
    'singular24',
    'edge16',
    'resumeNaN',
  ] as const) {
    it(`${name}: bit-exact Q and R`, () => {
      const g = byName.get(name);
      expect(g).toBeDefined();
      const { Q, R } = qr(g!.A) as { Q: unknown[][]; R: unknown[][] };
      expectMatrixBitExact(Q, g!.Q);
      expectMatrixBitExact(R, g!.R);
    });
  }

  it('complex8: bit-exact Q and R on Complex input', () => {
    const g = byName.get('complex8');
    expect(g).toBeDefined();
    const A = g!.A.map((row) =>
      row.map((cell) => {
        const c = cell as { re: number; im: number };
        return new Complex(c.re, c.im);
      })
    );
    const { Q, R } = qr(A) as { Q: unknown[][]; R: unknown[][] };
    expectMatrixBitExact(Q, g!.Q);
    expectMatrixBitExact(R, g!.R);
  });

  it('mixed8: one Complex entry among numbers keeps the whole matrix on the generic path', () => {
    const g = byName.get('mixed8');
    expect(g).toBeDefined();
    const A = g!.A.map((row) =>
      row.map((cell) => {
        if (isComplexLike(cell)) return new Complex(cell.re, cell.im);
        return cell;
      })
    );
    const { Q, R } = qr(A) as { Q: unknown[][]; R: unknown[][] };
    expectMatrixBitExact(Q, g!.Q);
    expectMatrixBitExact(R, g!.R);
  });

  it('DenseMatrix input gives the golden Q and R of the Array input', () => {
    const g = byName.get('8x8');
    expect(g).toBeDefined();
    const { Q, R } = qr(matrix(g!.A)) as {
      Q: { toArray(): unknown[][] };
      R: { toArray(): unknown[][] };
    };
    expectMatrixBitExact(Q.toArray(), g!.Q);
    expectMatrixBitExact(R.toArray(), g!.R);
  });
});

describe('P7-1 qr number path — resume at the first unfinished step', () => {
  /**
   * With the stock `sqrt`, a number matrix never leaves the number domain: `sqrt(NaN)` is `NaN`.
   * A `sqrt` override that returns a Complex for `NaN` (the dependency is user-replaceable, and
   * the number path must honour that) moves `u1`/`tau` off `number` at step 3 of the 12×12 pin,
   * where column 3 of R holds NaN. The step loop must hand step 3 to the generic loop, which
   * recomputes it from its start.
   */
  function qrWithComplexNaNSqrt() {
    const realSqrt = factoryScope.sqrt as (x: unknown) => unknown;
    const calls: unknown[] = [];
    const sqrt = (x: unknown) => {
      calls.push(x);
      return typeof x === 'number' && Number.isNaN(x) ? new Complex(NaN, 0) : realSqrt(x);
    };
    const scope = new Proxy(factoryScope, {
      get: (target, key) => (key === 'sqrt' ? sqrt : target[key as string]),
      has: (target, key) => key in target,
    });
    return { run: createQr(scope) as (a: unknown) => { Q: unknown[][]; R: unknown[][] }, calls };
  }

  it('resumeSqrtComplex: bit-exact Q and R when the scalar work leaves the number domain', () => {
    const g = byName.get('resumeSqrtComplex');
    expect(g).toBeDefined();
    const { run } = qrWithComplexNaNSqrt();
    const { Q, R } = run(g!.A.map((row) => row.map(toTestCell)));
    expectMatrixBitExact(Q, g!.Q);
    expectMatrixBitExact(R, g!.R);
  });

  it('coverage guard (new code only): step 3 is computed twice, so the resume branch ran', () => {
    const g = byName.get('resumeSqrtComplex');
    const { run, calls } = qrWithComplexNaNSqrt();
    run(g!.A.map((row) => row.map(toTestCell)));
    const steps = g!.A.length;
    expect(calls.length).toBe(steps + 1);
    expect(calls.filter((x) => typeof x === 'number' && Number.isNaN(x)).length).toBeGreaterThan(1);
  });
});

describe('P7-1 qr number path — replaced dependencies', () => {
  /**
   * `typed.find` throws for a dependency that is not a typed function, and a factory dependency
   * can be replaced by one. The number path must then be skipped (the ops cache holds `null`)
   * and `qr` must keep working through per-call dispatch, as before.
   */
  it('plain-function addScalar and conj keep qr working on the generic path', () => {
    const g = byName.get('8x8');
    expect(g).toBeDefined();
    const realAdd = factoryScope.addScalar as (a: unknown, b: unknown) => unknown;
    const realConj = factoryScope.conj as (a: unknown) => unknown;
    const scope = new Proxy(factoryScope, {
      get: (target, key) => {
        if (key === 'addScalar') return (a: unknown, b: unknown) => realAdd(a, b);
        if (key === 'conj') return (a: unknown) => realConj(a);
        return target[key as string];
      },
      has: (target, key) => key in target,
    });
    const run = createQr(scope) as (a: unknown) => { Q: unknown[][]; R: unknown[][] };
    const { Q, R } = run(g!.A);
    expectMatrixBitExact(Q, g!.Q);
    expectMatrixBitExact(R, g!.R);
  });
});

describe('P7-1 qr number path — regressions', () => {
  it('Fraction matrix keeps the pre-change throw', () => {
    expect(() =>
      qr([
        [new Fraction(1, 2), 1],
        [2, 3],
      ])
    ).toThrow();
  });
});
