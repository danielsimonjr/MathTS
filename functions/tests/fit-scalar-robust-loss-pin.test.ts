/**
 * Pins for L1 / Huber BFGS gradients (`gradRobust` consolidation in fit-scalar.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fitScalarParameters, scalar } from '../src/index.js';

const golden = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures/fit-scalar-robust-loss-golden.json'),
    'utf8'
  )
) as Record<string, { parameters: number[]; loss: number; validRows: number }>;

const slopeNode = () => scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);

function bfgsFit(loss: 'l1' | 'huber', x: Float64Array, y: Float64Array, weights?: Float64Array) {
  const opts: {
    parameters: string[];
    algorithm: 'bfgs';
    loss: 'l1' | 'huber';
    restarts: number;
    maxIterations: number;
    weights?: Float64Array;
  } = {
    parameters: ['a'],
    algorithm: 'bfgs',
    loss,
    restarts: 0,
    maxIterations: 50,
  };
  if (weights) {
    opts.weights = weights;
  }
  return fitScalarParameters(slopeNode(), [x], y, ['x'], opts);
}

describe('fit-scalar robust loss BFGS pins', () => {
  it('L1: zero residual at a=1', () => {
    const r = bfgsFit('l1', new Float64Array([1, 2, 3]), new Float64Array([1, 2, 3]));
    expect(Array.from(r.parameters)).toEqual(golden.l1_zero.parameters);
    expect(r.loss).toBe(golden.l1_zero.loss);
    expect(r.validRows).toBe(golden.l1_zero.validRows);
  });

  it('L1: weighted exact fit', () => {
    const r = bfgsFit(
      'l1',
      new Float64Array([1, 2, 3]),
      new Float64Array([2, 4, 6]),
      new Float64Array([1, 2, 1])
    );
    expect(Array.from(r.parameters)).toEqual(golden.l1_weighted.parameters);
    expect(r.loss).toBe(golden.l1_weighted.loss);
  });

  it('Huber: zero residual', () => {
    const r = bfgsFit('huber', new Float64Array([1, 2, 3]), new Float64Array([1, 2, 3]));
    expect(Array.from(r.parameters)).toEqual(golden.huber_zero.parameters);
    expect(r.loss).toBe(golden.huber_zero.loss);
  });

  it('Huber: residuals beyond clamp (|r|>1)', () => {
    const r = bfgsFit('huber', new Float64Array([0, 1, 2]), new Float64Array([0, 5, 0]));
    expect(r.parameters[0]).toBeCloseTo(golden.huber_clamp.parameters[0], 12);
    expect(r.loss).toBeCloseTo(golden.huber_clamp.loss, 12);
  });

  it('Huber: weighted exact fit', () => {
    const r = bfgsFit(
      'huber',
      new Float64Array([1, 2, 3]),
      new Float64Array([2, 4, 6]),
      new Float64Array([1, 2, 1])
    );
    expect(Array.from(r.parameters)).toEqual(golden.huber_weighted.parameters);
    expect(r.loss).toBe(golden.huber_weighted.loss);
  });

  it('L1: inactive row during fit drops invalid observation', () => {
    const r = fitScalarParameters(
      slopeNode(),
      [new Float64Array([1, 2, 3])],
      new Float64Array([2, Number.NaN, 6]),
      ['x'],
      { parameters: ['a'], loss: 'l1', algorithm: 'bfgs', restarts: 0 }
    );
    expect(r.validRows).toBe(2);
    expect(Math.abs(r.parameters[0] - 2)).toBeLessThanOrEqual(1e-12);
  });
});
