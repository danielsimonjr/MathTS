/** Fixes #692 — synchronous unary element-wise ops accept flat number[] vectors. */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sin, cos } from '../dist/index.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const PERF_GATE = fileURLToPath(new URL('./helpers/sin-f64-perf-gate.mjs', import.meta.url));

describe('#692 elementwise sin on number[]', () => {
  it('exact repro: sin([0, PI/2]) equals [0, 1]', () => {
    const out = sin([0, Math.PI / 2]) as number[];
    expect(out[0]).toBeCloseTo(0, 12);
    expect(out[1]).toBeCloseTo(1, 12);
  });

  it('matches Float64Array path on the same values', () => {
    const xs = [0, 0.25, -1, Math.PI / 3, NaN];
    const fromArray = sin(xs) as number[];
    const fromF64 = sin(new Float64Array(xs)) as Float64Array;
    expect(fromArray.length).toBe(fromF64.length);
    for (let i = 0; i < fromArray.length; i++) {
      if (Number.isNaN(fromF64[i])) {
        expect(Number.isNaN(fromArray[i])).toBe(true);
      } else {
        expect(fromArray[i]).toBe(fromF64[i]);
      }
    }
  });

  it('nested number[][] throws mathjs-style matrix hint, not typed-function dump', () => {
    expect(() =>
      sin([
        [1, 2],
        [3, 4],
      ])
    ).toThrow(/doesn't apply to matrices.*map\(M, sin\)/);
  });

  it('non-number elements throw TypeError naming the function', () => {
    expect(() => sin([1, 'two'] as unknown as number[])).toThrow(
      /Function 'sin' expects a flat array of numbers/
    );
  });

  it('DenseMatrix rejects with matrix hint via typed dispatch', () => {
    const M = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    expect(() => sin(M)).toThrow(/doesn't apply to matrices.*map\(M, sin\)/);
  });

  it('cos on number[] matches elementwise Math.cos (mathjs map parity)', () => {
    const xs = [0, 1, -1];
    const mapped = xs.map((x) => Math.cos(x));
    expect(cos(xs) as number[]).toEqual(mapped);
  });

  it('sin(Float64Array 1e6) within 1.2× a Math.sin loop (isolated Node gate)', () => {
    const node = process.env.PERF_NODE ?? 'node';
    const line = execFileSync(node, [PERF_GATE], { encoding: 'utf8' }).trim();
    const { ratio, loopMs, sinMs } = JSON.parse(line) as {
      ratio: number;
      loopMs: number;
      sinMs: number;
    };
    expect(ratio).toBeLessThanOrEqual(1.2);
    expect(sinMs).toBeLessThanOrEqual(1.2 * loopMs);
  });
});
