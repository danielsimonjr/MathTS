/** Fixes #692 — unary element-wise ops share one Array | Matrix dispatch. */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BigNumber, Complex, Fraction, Unit } from '@danielsimonjr/mathts-core';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import {
  abs,
  acos,
  acosh,
  acsc,
  asin,
  cos,
  exp,
  log,
  runWithConfig,
  sin,
  sqrt,
  unaryMinus,
} from '../dist/index.js';

const PERF_GATE = fileURLToPath(new URL('./helpers/sin-f64-perf-gate.mjs', import.meta.url));

const UNARIES = [sin, cos, exp, log, sqrt, abs, asin, acos, acosh, acsc, unaryMinus] as const;

describe('#692 elementwise sin on number[]', () => {
  it('exact repro: sin([0, PI/2]) equals [0, 1]', () => {
    const out = sin([0, Math.PI / 2]) as number[];
    expect(Array.isArray(out)).toBe(true);
    expect(out[0]).toBeCloseTo(0, 12);
    expect(out[1]).toBeCloseTo(1, 12);
  });

  it('matches Float64Array path on the same values, including NaN and -0', () => {
    const xs = [0, -0, 0.25, -1, Math.PI / 3, NaN];
    const fromArray = sin(xs) as number[];
    const fromF64 = sin(new Float64Array(xs)) as Float64Array;
    expect(fromArray).not.toBe(xs);
    expect(fromArray.length).toBe(fromF64.length);
    for (let i = 0; i < fromArray.length; i++) {
      expect(Object.is(fromArray[i], fromF64[i])).toBe(true);
    }
    expect(Object.is(sin(-0) as number, -0)).toBe(true);
    expect(sin(0.5)).toBe(Math.sin(0.5));
  });

  it('nested number[][] keeps the container and the values', () => {
    const out = sin([
      [0, Math.PI / 2],
      [Math.PI, -0],
    ]) as number[][];
    expect(out.map((row) => row.map((x) => (Object.is(x, -0) ? -0 : x)))).toEqual([
      [Math.sin(0), Math.sin(Math.PI / 2)],
      [Math.sin(Math.PI), -0],
    ]);
  });

  it('empty arrays stay empty arrays', () => {
    for (const fn of UNARIES) {
      expect(fn([])).toEqual([]);
      expect(fn([[], []])).toEqual([[], []]);
    }
  });

  it('sqrt and log of negatives are the scalar Complex results, including NaN as NaN', () => {
    const roots = sqrt([4, -4, NaN, 0]) as unknown[];
    expect(roots[0]).toBe(2);
    expect(roots[1]).toEqual(sqrt(-4));
    expect(roots[1]).toEqual(new Complex(0, 2));
    expect(Number.isNaN(roots[2] as number)).toBe(true);
    expect(roots[2]).not.toBeInstanceOf(Complex);
    expect(roots[3]).toBe(0);

    const logs = log([1, -1, NaN, 0]) as unknown[];
    expect(logs[0]).toBe(0);
    expect(logs[1]).toEqual(log(-1));
    expect(logs[1]).toBeInstanceOf(Complex);
    expect(Number.isNaN(logs[2] as number)).toBe(true);
    expect(logs[3]).toBe(-Infinity);

    expect(runWithConfig({ predictable: true }, () => sqrt([-1]) as number[])).toEqual([NaN]);
  });

  it('mixed arrays keep per-element types', () => {
    const bn = BigNumber.fromNumber(-2);
    const frac = new Fraction(-1n, 2n);
    const z = new Complex(0, Math.PI / 2);
    const angle = new Unit(90, 'deg');

    const absolutes = abs([bn, frac, z, -3]) as unknown[];
    expect(absolutes[0]).toEqual(abs(bn));
    expect(absolutes[0]).toBeInstanceOf(BigNumber);
    expect(absolutes[1]).toEqual(abs(frac));
    expect(absolutes[1]).toBeInstanceOf(Fraction);
    expect(absolutes[2]).toBe(abs(z));
    expect(absolutes[3]).toBe(3);

    const sines = sin([0, z, angle]) as unknown[];
    expect(sines[0]).toBeCloseTo(0, 12);
    expect(sines[1]).toEqual(sin(z));
    expect(sines[1]).toBeInstanceOf(Complex);
    expect(sines[2]).toBeCloseTo(sin(angle) as number, 12);
  });

  it('DenseMatrix and SparseMatrix of numbers come back as the same class', () => {
    const dense = new DenseMatrix(1, 2, [0, Math.PI / 2]);
    const out = sin(dense) as DenseMatrix;
    expect(out).toBeInstanceOf(DenseMatrix);
    expect(out.get(0, 0)).toBeCloseTo(0, 12);
    expect(out.get(0, 1)).toBeCloseTo(1, 12);

    const sparse = SparseMatrix.fromDense(
      new DenseMatrix(2, 2, [
        [0, 1],
        [0, 0],
      ])
    );
    const sout = sin(sparse) as SparseMatrix;
    expect(sout).toBeInstanceOf(SparseMatrix);
    expect(sout.get(0, 1)).toBeCloseTo(Math.sin(1), 12);

    const empty = sin(new DenseMatrix(0, 2)) as DenseMatrix;
    expect(empty).toBeInstanceOf(DenseMatrix);
    expect(empty.rows).toBe(0);
    expect(empty.cols).toBe(2);
  });

  it('sqrt of a matrix promotes negatives to Complex and leaves the f64 matrix', () => {
    const m = new DenseMatrix(1, 2, [4, -4]);
    const out = sqrt(m) as unknown[][];
    expect(Array.isArray(out)).toBe(true);
    expect(out).toEqual([[2, new Complex(0, 2)]]);
  });

  it('cos on number[] matches elementwise Math.cos', () => {
    const xs = [0, 1, -1];
    expect(cos(xs) as number[]).toEqual(xs.map((x) => Math.cos(x)));
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
