import { describe, it, expect } from 'vitest';
import { nelderMead, minimize } from '@danielsimonjr/mathts-functions';

/**
 * Parity pins for Sprint 2R Nelder–Mead consolidation: `minimize` delegates to
 * `nelderMead` with absolute step/tolerance; relative defaults stay on `nelderMead`.
 */
describe('nelderMead / minimize parity', () => {
  const quadAt3 = (x: number[]) => (x[0] - 3) ** 2;

  it('minimize reaches the analytic minimum at x=3 with absolute step', () => {
    const x = minimize(quadAt3, [0], { step: 1 });
    expect(x[0]).toBeCloseTo(3, 2);
  });

  it('nelderMead with absolute rules matches minimize on the same objective', () => {
    const viaMinimize = minimize(quadAt3, [0], { step: 1 });
    const viaNm = nelderMead(quadAt3, [0], {
      step: 1,
      stepRule: 'absolute',
      tolRule: 'absolute',
      maxIter: 1000,
    }).x;
    expect(viaMinimize[0]).toBeCloseTo(3, 2);
    expect(viaNm[0]).toBeCloseTo(3, 2);
  });

  it('nelderMead relative defaults still minimize Rosenbrock toward (1,1)', () => {
    const r = nelderMead((v) => (1 - v[0]) ** 2 + 100 * (v[1] - v[0] ** 2) ** 2, [-1.2, 1], {
      tol: 1e-10,
      maxIter: 5000,
    });
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
    expect(r.fx).toBeLessThan(1e-8);
  });
});
