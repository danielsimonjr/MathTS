import { describe, it, expect } from 'vitest';
import {
  qrPivoted,
  lq,
  rq,
  ql,
  condest,
  eigvals,
  powerIteration,
  matrixPinv,
} from '../src/index.js';

/**
 * Gap analysis 2026-11-04 §5.1 — the matrix package's rank-revealing QR,
 * the lq/rq/ql family, condest, eigvals/powerIteration and matrixPinv were
 * implemented but never surfaced on the `functions` barrel. This pins that
 * each name is reachable and callable from `@danielsimonjr/mathts-functions`.
 */
describe('matrix decompositions re-exported from functions', () => {
  it('every name is a function', () => {
    for (const f of [qrPivoted, lq, rq, ql, condest, eigvals, powerIteration, matrixPinv]) {
      expect(typeof f).toBe('function');
    }
  });

  it('eigvals of diag(2,3) is {2,3}', () => {
    const v = eigvals([
      [2, 0],
      [0, 3],
    ]);
    const re = v.map((z) => z.re).sort((a, b) => a - b);
    expect(re).toEqual([2, 3]);
    expect(v.every((z) => z.im === 0)).toBe(true);
  });
});
