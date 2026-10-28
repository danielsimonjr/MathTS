import { describe, it, expect } from 'vitest';
import { betainc } from '../src/index.js';
import { betaincScalar, betaincClosedScalar } from '../src/wasm/special/scalars.js';

/** V8-captured grid; Bun/JSC is at most 2 ULPs off on a few continued-fraction rows. */
function eq2Ulp(got: number, expected: number): boolean {
  if (Object.is(got, expected)) return true;
  if (!Number.isFinite(got) || !Number.isFinite(expected)) return false;
  const buf = new Float64Array(2);
  buf[0] = got;
  buf[1] = expected;
  const bits = new BigUint64Array(buf.buffer);
  const hi = bits[0]! > bits[1]! ? bits[0]! : bits[1]!;
  const lo = bits[0]! > bits[1]! ? bits[1]! : bits[0]!;
  return hi - lo <= 2n;
}

/** Grid oracle literals from pre-consolidation betaincScalar (issue #473 / PR 8). */
const BETAINC_GRID: Array<{ a: number; b: number; x: number; v: number }> = [
  { a: 0.5, b: 0.5, x: 0.1, v: 0.20483276469913334 },
  { a: 0.5, b: 0.5, x: 0.3, v: 0.36901011956554525 },
  { a: 0.5, b: 0.5, x: 0.5, v: 0.4999999999999997 },
  { a: 0.5, b: 0.5, x: 0.7, v: 0.6309898804344549 },
  { a: 0.5, b: 0.5, x: 0.9, v: 0.7951672353008666 },
  { a: 0.5, b: 2, x: 0.1, v: 0.4585302607244161 },
  { a: 0.5, b: 2, x: 0.3, v: 0.7394254526319759 },
  { a: 0.5, b: 2, x: 0.5, v: 0.8838834764831842 },
  { a: 0.5, b: 2, x: 0.7, v: 0.9621590305141868 },
  { a: 0.5, b: 2, x: 0.9, v: 0.9961174629530395 },
  { a: 0.5, b: 5, x: 0.1, v: 0.6833570849799895 },
  { a: 0.5, b: 5, x: 0.3, v: 0.9347377538310917 },
  { a: 0.5, b: 5, x: 0.5, v: 0.9898804402645662 },
  { a: 0.5, b: 5, x: 0.7, v: 0.999308696614237 },
  { a: 0.5, b: 5, x: 0.9, v: 0.9999974294103008 },
  { a: 1, b: 0.5, x: 0.1, v: 0.05131670194948631 },
  { a: 1, b: 0.5, x: 0.3, v: 0.16333997346592466 },
  { a: 1, b: 0.5, x: 0.5, v: 0.29289321881345304 },
  { a: 1, b: 0.5, x: 0.7, v: 0.4522774424948329 },
  { a: 1, b: 0.5, x: 0.9, v: 0.6837722339831616 },
  { a: 1, b: 2, x: 0.1, v: 0.19000000000000034 },
  { a: 1, b: 2, x: 0.3, v: 0.5100000000000009 },
  { a: 1, b: 2, x: 0.5, v: 0.7499999999999996 },
  { a: 1, b: 2, x: 0.7, v: 0.9099999999999998 },
  { a: 1, b: 2, x: 0.9, v: 0.99 },
  { a: 1, b: 5, x: 0.1, v: 0.40951000000000193 },
  { a: 1, b: 5, x: 0.3, v: 0.8319299999999993 },
  { a: 1, b: 5, x: 0.5, v: 0.9687499999999998 },
  { a: 1, b: 5, x: 0.7, v: 0.99757 },
  { a: 1, b: 5, x: 0.9, v: 0.99999 },
  { a: 2, b: 0.5, x: 0.1, v: 0.0038825370469605207 },
  { a: 2, b: 0.5, x: 0.3, v: 0.03784096948581319 },
  { a: 2, b: 0.5, x: 0.5, v: 0.11611652351681583 },
  { a: 2, b: 0.5, x: 0.7, v: 0.2605745473680241 },
  { a: 2, b: 0.5, x: 0.9, v: 0.5414697392755841 },
  { a: 2, b: 2, x: 0.1, v: 0.028 },
  { a: 2, b: 2, x: 0.3, v: 0.21599999999999986 },
  { a: 2, b: 2, x: 0.5, v: 0.4999999999999998 },
  { a: 2, b: 2, x: 0.7, v: 0.784 },
  { a: 2, b: 2, x: 0.9, v: 0.972 },
  { a: 2, b: 5, x: 0.1, v: 0.11426500000000049 },
  { a: 2, b: 5, x: 0.3, v: 0.5798250000000017 },
  { a: 2, b: 5, x: 0.5, v: 0.8906249999999996 },
  { a: 2, b: 5, x: 0.7, v: 0.989065 },
  { a: 2, b: 5, x: 0.9, v: 0.999945 },
  { a: 5, b: 0.5, x: 0.1, v: 0.0000025705896992293854 },
  { a: 5, b: 0.5, x: 0.3, v: 0.0006913033857629779 },
  { a: 5, b: 0.5, x: 0.5, v: 0.010119559735433742 },
  { a: 5, b: 0.5, x: 0.7, v: 0.06526224616890831 },
  { a: 5, b: 0.5, x: 0.9, v: 0.31664291502001074 },
  { a: 5, b: 2, x: 0.1, v: 0.00005500000000000035 },
  { a: 5, b: 2, x: 0.3, v: 0.010935000000000035 },
  { a: 5, b: 2, x: 0.5, v: 0.10937500000000044 },
  { a: 5, b: 2, x: 0.7, v: 0.42017499999999797 },
  { a: 5, b: 2, x: 0.9, v: 0.8857349999999996 },
  { a: 5, b: 5, x: 0.1, v: 0.0008909200000000081 },
  { a: 5, b: 5, x: 0.3, v: 0.09880866000000074 },
  { a: 5, b: 5, x: 0.5, v: 0.5000000000000042 },
  { a: 5, b: 5, x: 0.7, v: 0.9011913399999991 },
  { a: 5, b: 5, x: 0.9, v: 0.99910908 },
];

describe('betainc scalar oracle (pre-refactor)', () => {
  it('betaincScalar matches closed form in domain', () => {
    expect(Object.is(betaincScalar(2, 5, 0.3), 0.5798250000000017)).toBe(true);
    expect(Object.is(betaincClosedScalar(0.3, 2, 5), 0.5798250000000017)).toBe(true);
  });

  it('symmetry branch x > (a+1)/(a+b+2)', () => {
    expect(Object.is(betaincScalar(2, 5, 0.8), 0.9984)).toBe(true);
    expect(Object.is(betaincClosedScalar(0.8, 2, 5), 0.9984)).toBe(true);
  });

  it('endpoints', () => {
    expect(Object.is(betaincScalar(2, 5, 0), 0)).toBe(true);
    expect(Object.is(betaincScalar(2, 5, 1), 1)).toBe(true);
    expect(Object.is(betaincClosedScalar(0, 2, 5), 0)).toBe(true);
    expect(Object.is(betaincClosedScalar(1, 2, 5), 1)).toBe(true);
  });

  it('out-of-range domain policies differ', () => {
    expect(Object.is(betaincScalar(2, 5, -0.1), NaN)).toBe(true);
    expect(Object.is(betaincClosedScalar(-0.1, 2, 5), 0)).toBe(true);
    expect(Object.is(betaincScalar(2, 5, 1.1), NaN)).toBe(true);
    expect(Object.is(betaincClosedScalar(1.1, 2, 5), 1)).toBe(true);
  });

  it('NaN arguments propagate', () => {
    expect(Object.is(betaincScalar(NaN, 2, 0.5), NaN)).toBe(true);
    expect(Object.is(betaincScalar(2, NaN, 0.5), NaN)).toBe(true);
    expect(Object.is(betaincScalar(2, 5, NaN), NaN)).toBe(true);
    expect(Object.is(betaincClosedScalar(0.5, NaN, 2), NaN)).toBe(true);
  });

  it('grid samples', () => {
    for (const { a, b, x, v } of BETAINC_GRID) {
      expect(eq2Ulp(betaincScalar(a, b, x), v), `betaincScalar(${a},${b},${x})`).toBe(true);
    }
  });
});

describe('betainc argument order is (a, b, x) — regularized I_x(a,b)', () => {
  it('betainc(2,3,0.5) = 0.6875 (mpmath)', () => {
    expect(betainc(2, 3, 0.5)).toBeCloseTo(0.6875, 12);
  });
  it('betainc(2,3,0.7) = 0.9163 (mpmath)', () => {
    expect(betainc(2, 3, 0.7)).toBeCloseTo(0.9163, 12);
  });
  it('I_x(1,1) = x (uniform)', () => {
    expect(betainc(1, 1, 0.3)).toBeCloseTo(0.3, 12);
  });
});
