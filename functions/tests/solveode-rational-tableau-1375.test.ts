import { describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { solveODE, type SolveODESolution } from '../src/index.js';

describe('BigNumber Runge–Kutta coefficients', () => {
  it.each(['RK23', 'RK45'] as const)(
    'integrates a constant derivative beyond double precision in %s',
    (method) => {
      const zero = BigNumber.fromNumber(0);
      const one = BigNumber.fromNumber(1);
      const sol = solveODE(() => one, [zero, one], zero, {
        method,
        firstStep: 1,
      }) as SolveODESolution;
      expect(sol.t).toHaveLength(2);
      const last = sol.y[1] as BigNumber;
      expect(last).toBeInstanceOf(BigNumber);
      expect(last.sub(one).abs().toNumber()).toBeLessThan(1e-30);
    }
  );
});
