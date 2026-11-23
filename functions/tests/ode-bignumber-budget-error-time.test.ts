/**
 * The step-budget error of a BigNumber `solveODE` run reports the time of the last accepted step.
 * It reported the final time for `last t`, so a run that stopped at t = 3e-4 said `last t=10`.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const mt = math as unknown as Record<string, Fn>;

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('the run did not throw');
}

describe('BigNumber solveODE budget error', () => {
  for (const method of ['RK23', 'RK45']) {
    it(`${method}: last t is the last accepted time, and the target is the final time`, () => {
      const stiff = (_t: unknown, y: unknown): unknown => mt.multiply(mt.bignumber(-1000), y);
      const message = messageOf(() =>
        mt.solveODE(stiff, [0, 10], mt.bignumber(1), { method, maxIter: 5 })
      );
      const last = /last t=([0-9.e+-]+), target t=([0-9.e+-]+)/.exec(message);
      expect(last, message).not.toBeNull();
      expect(Number(last![2])).toBe(10);
      expect(Number(last![1])).toBeGreaterThan(0);
      expect(Number(last![1])).toBeLessThan(0.1);
    });
  }

  it('the number path also reports the time reached', () => {
    const message = messageOf(() =>
      mt.solveODE((_t: number, y: number[]) => [-1000 * y[0]], [0, 10], [1], {
        method: 'RK45',
        maxIter: 5,
      })
    );
    const t = Number(message.match(/last t=([^,]+), target t=10/)?.[1]);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(10);
  });
});
