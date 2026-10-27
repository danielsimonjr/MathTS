/**
 * Pin tests for unary Float64Array overload consolidation (G33/G34/G43).
 * Independent oracles: Math.* on plain scalars / hand loops — never round-trip
 * through the implementation under test beyond the typed dispatch entry.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  sign,
  cbrt,
  round,
  floor,
  ceil,
  fix,
  cosh,
  log10,
  log2,
  log1p,
  expm1,
  sinh,
  tanh,
} from '../src/typed/arithmetic.js';
import { asin, acos, atan, asinh, acosh, atanh, csc, sec, cot } from '../src/typed/trigonometry.js';

type UnaryF64 = (a: Float64Array) => Promise<Float64Array>;

function oracleUnary(xs: number[], fn: (x: number) => number): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = fn(xs[i]);
  return out;
}

function expectF64Close(actual: Float64Array, expected: Float64Array): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (Number.isNaN(e)) {
      expect(Number.isNaN(a)).toBe(true);
    } else if (Object.is(e, -0)) {
      expect(Object.is(a, -0)).toBe(true);
    } else if (!Number.isFinite(e)) {
      expect(a).toBe(e);
    } else {
      expect(a).toBeCloseTo(e, 12);
    }
  }
}

const EDGE_SCALARS = [
  NaN,
  -0,
  0,
  -Infinity,
  Infinity,
  -1,
  1,
  0.5,
  -0.5,
  1e-300,
  -1e-300,
  Math.PI / 2,
  -Math.PI / 2,
  2,
  -2,
];

const MERGE_UNARIES: Array<{ name: string; fn: UnaryF64; scalar: (x: number) => number }> = [
  { name: 'sign', fn: (a) => sign(a) as Promise<Float64Array>, scalar: Math.sign },
  { name: 'cbrt', fn: (a) => cbrt(a) as Promise<Float64Array>, scalar: Math.cbrt },
  { name: 'round', fn: (a) => round(a) as Promise<Float64Array>, scalar: Math.round },
  { name: 'floor', fn: (a) => floor(a) as Promise<Float64Array>, scalar: Math.floor },
  { name: 'ceil', fn: (a) => ceil(a) as Promise<Float64Array>, scalar: Math.ceil },
  { name: 'fix', fn: (a) => fix(a) as Promise<Float64Array>, scalar: Math.trunc },
  { name: 'cosh', fn: (a) => cosh(a) as Promise<Float64Array>, scalar: Math.cosh },
  { name: 'log10', fn: (a) => log10(a) as Promise<Float64Array>, scalar: Math.log10 },
  { name: 'log2', fn: (a) => log2(a) as Promise<Float64Array>, scalar: Math.log2 },
  { name: 'log1p', fn: (a) => log1p(a) as Promise<Float64Array>, scalar: Math.log1p },
  { name: 'expm1', fn: (a) => expm1(a) as Promise<Float64Array>, scalar: Math.expm1 },
  { name: 'sinh', fn: (a) => sinh(a) as Promise<Float64Array>, scalar: Math.sinh },
  { name: 'tanh', fn: (a) => tanh(a) as Promise<Float64Array>, scalar: Math.tanh },
  { name: 'asin', fn: (a) => asin(a) as Promise<Float64Array>, scalar: Math.asin },
  { name: 'acos', fn: (a) => acos(a) as Promise<Float64Array>, scalar: Math.acos },
  { name: 'atan', fn: (a) => atan(a) as Promise<Float64Array>, scalar: Math.atan },
  { name: 'asinh', fn: (a) => asinh(a) as Promise<Float64Array>, scalar: Math.asinh },
  { name: 'acosh', fn: (a) => acosh(a) as Promise<Float64Array>, scalar: Math.acosh },
  { name: 'atanh', fn: (a) => atanh(a) as Promise<Float64Array>, scalar: Math.atanh },
  { name: 'csc', fn: (a) => csc(a) as Promise<Float64Array>, scalar: (x) => 1 / Math.sin(x) },
  { name: 'sec', fn: (a) => sec(a) as Promise<Float64Array>, scalar: (x) => 1 / Math.cos(x) },
  { name: 'cot', fn: (a) => cot(a) as Promise<Float64Array>, scalar: (x) => 1 / Math.tan(x) },
];

describe('unary Float64Array merge pins (independent Math.* oracles)', () => {
  describe.each(MERGE_UNARIES)('$name', ({ fn, scalar }) => {
    it('matches Math oracle on edge scalars (n=15)', async () => {
      const xs = Float64Array.from(EDGE_SCALARS);
      const expected = oracleUnary(EDGE_SCALARS, scalar);
      const actual = await fn(xs);
      expectF64Close(actual, expected);
    });

    it('empty array → empty result', async () => {
      const actual = await fn(new Float64Array(0));
      expect(actual.length).toBe(0);
    });

    it('n=3 hand-loop oracle', async () => {
      const xs = Float64Array.from([1.25, -2.75, 0.001]);
      const expected = oracleUnary([1.25, -2.75, 0.001], scalar);
      const actual = await fn(xs);
      expectF64Close(actual, expected);
    });
  });

  describe('threshold band with pool uninitialized (global 50_000)', () => {
    beforeAll(async () => {
      await computePool.terminate();
    });

    afterAll(async () => {
      computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    });

    it('sign at n=49_999 and n=50_001 matches Math.sign (sequential path)', async () => {
      for (const n of [49_999, 50_001]) {
        const xs = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.017));
        const expected = oracleUnary(Array.from(xs), Math.sign);
        const actual = await (sign(xs) as Promise<Float64Array>);
        expect(actual.length).toBe(n);
        // Spot-check ends and a few interior indices (full compare is expensive at 50k+).
        for (const i of [0, 1, 2, n - 3, n - 2, n - 1, Math.floor(n / 2)]) {
          const a = actual[i];
          const e = expected[i];
          if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
          else expect(a).toBe(e);
        }
      }
    });

    it('floor at n=49_999 and n=50_001 matches Math.floor (sequential path)', async () => {
      for (const n of [49_999, 50_001]) {
        const xs = Float64Array.from({ length: n }, (_, i) => (i % 7) * 0.333 - 1.1);
        const expected = oracleUnary(Array.from(xs), Math.floor);
        const actual = await (floor(xs) as Promise<Float64Array>);
        for (const i of [0, 42, n - 1]) {
          expect(actual[i]).toBe(expected[i]);
        }
      }
    });
  });

  it('log10 at 0 and 1 matches Math.log10 (wasm-off)', async () => {
    const xs = Float64Array.from([0, 1, 10, -1]);
    const expected = oracleUnary([0, 1, 10, -1], Math.log10);
    const actual = await (log10(xs) as Promise<Float64Array>);
    expectF64Close(actual, expected);
  });

  it('atanh at ±1 and outside domain matches Math.atanh', async () => {
    const xs = Float64Array.from([-1.5, -1, -0.5, 0, 0.5, 1, 1.5]);
    const expected = oracleUnary([-1.5, -1, -0.5, 0, 0.5, 1, 1.5], Math.atanh);
    const actual = await (atanh(xs) as Promise<Float64Array>);
    expectF64Close(actual, expected);
  });

  it('csc(π/2)≈1, sec(0)=1, cot pole → ±Infinity', async () => {
    const halfPi = Math.PI / 2;
    const cscOut = await (csc(Float64Array.from([halfPi])) as Promise<Float64Array>);
    expect(cscOut[0]).toBeCloseTo(1, 12);

    const secOut = await (sec(Float64Array.from([0])) as Promise<Float64Array>);
    expect(secOut[0]).toBeCloseTo(1, 12);

    const cotOut = await (cot(Float64Array.from([0])) as Promise<Float64Array>);
    expect(cotOut[0]).toBe(Infinity);
  });
});
