/**
 * Numerical Methods Tests
 *
 * Tests for 36 numerical functions: root finding, optimization,
 * integration, interpolation, curve fitting, ODE solvers, and more.
 */

import { describe, it, expect } from 'vitest';
import {
  findRoot,
  linsolve,
  minimize,
  maximize,
  leastSquares,
  nintegrate,
  simpsons,
  interpolate,
  cspline,
  pchip,
  bezierCurve,
  bspline,
  loess,
  griddata,
  rbfInterpolate,
  curvefit,
  expfit,
  logfit,
  powerfit,
  solveODESystem,
  stiffODESolver,
  odeAdaptiveStep,
  eventDetection,
  cond,
  rank,
  nullspace,
  chebyshevApprox,
  padeApproximant,
  quadprog,
  linprog,
  solvePDE,
} from '../src/typed/numeric.js';

const EPSILON = 1e-6;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// =============================================================================
// Root Finding
// =============================================================================

describe('findRoot', () => {
  it('should find sqrt(2)', () => {
    const root = findRoot((x) => x * x - 2, 1, 2);
    expectClose(root, Math.SQRT2, 1e-10);
  });

  it('should find root of cos(x) near pi/2', () => {
    const root = findRoot(Math.cos, 1, 2);
    expectClose(root, Math.PI / 2, 1e-10);
  });

  it('should throw for same-sign endpoints', () => {
    expect(() => findRoot((x) => x * x + 1, 0, 1)).toThrow();
  });
});

describe('linsolve', () => {
  it('should solve 2x2 system', () => {
    const x = linsolve(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 10]
    );
    expectClose(x[0], 1);
    expectClose(x[1], 3);
  });

  it('should solve 3x3 identity system', () => {
    const x = linsolve(
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      [3, 5, 7]
    );
    expectClose(x[0], 3);
    expectClose(x[1], 5);
    expectClose(x[2], 7);
  });

  it('should throw for singular matrix', () => {
    expect(() =>
      linsolve(
        [
          [1, 2],
          [2, 4],
        ],
        [3, 6]
      )
    ).toThrow();
  });
});

// =============================================================================
// Optimization
// =============================================================================

describe('minimize', () => {
  it('should minimize a simple quadratic', () => {
    const result = minimize((x) => (x[0] - 3) * (x[0] - 3), [0], { step: 1 });
    expectClose(result[0], 3, 0.01);
  });

  it('should minimize Rosenbrock-like 2D', () => {
    const result = minimize((x) => (x[0] - 1) * (x[0] - 1) + (x[1] - 2) * (x[1] - 2), [0.5, 1], {
      step: 0.5,
      maxIter: 5000,
    });
    expectClose(result[0], 1, 0.3);
    expectClose(result[1], 2, 0.3);
  });
});

describe('maximize', () => {
  it('should maximize negative quadratic', () => {
    const result = maximize((x) => -(x[0] * x[0]), [5], { step: 1 });
    expectClose(result[0], 0, 0.01);
  });
});

describe('leastSquares', () => {
  it('should fit a line', () => {
    // y = 2x + 1
    const A = [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const b = [1, 3, 5, 7];
    const x = leastSquares(A, b);
    expectClose(x[0], 1, 1e-6);
    expectClose(x[1], 2, 1e-6);
  });
});

// =============================================================================
// Integration
// =============================================================================

describe('nintegrate', () => {
  it('should integrate x^2 from 0 to 1', () => {
    expectClose(
      nintegrate((x) => x * x, 0, 1),
      1 / 3,
      1e-8
    );
  });

  it('should integrate sin from 0 to pi', () => {
    expectClose(nintegrate(Math.sin, 0, Math.PI), 2, 1e-8);
  });
});

describe('simpsons', () => {
  it('should integrate x^2 from 0 to 1', () => {
    expectClose(
      simpsons((x) => x * x, 0, 1),
      1 / 3,
      1e-6
    );
  });
});

// =============================================================================
// Interpolation
// =============================================================================

describe('interpolate', () => {
  it('should do linear interpolation', () => {
    const f = interpolate([0, 1, 2], [0, 1, 4], 'linear');
    expectClose(f(0.5), 0.5);
    expectClose(f(1.5), 2.5);
  });

  it('should do lagrange interpolation', () => {
    const f = interpolate([0, 1, 2], [0, 1, 4], 'lagrange');
    expectClose(f(1.5), 2.25, 1e-6);
  });

  it('should do spline interpolation', () => {
    const f = interpolate([0, 1, 2, 3], [0, 1, 4, 9], 'spline');
    expect(typeof f(1.5)).toBe('number');
    expect(f(0)).toBeCloseTo(0, 5);
  });
});

describe('cspline', () => {
  it('should return a function', () => {
    const f = cspline([0, 1, 2, 3], [0, 1, 4, 9]);
    expect(typeof f).toBe('function');
    expectClose(f(0), 0);
  });
});

describe('pchip', () => {
  it('should interpolate at data points', () => {
    expectClose(pchip([0, 1, 2], [0, 1, 4], 0), 0);
    expectClose(pchip([0, 1, 2], [0, 1, 4], 1), 1);
  });
});

describe('bezierCurve', () => {
  it('should evaluate linear Bezier', () => {
    const p = bezierCurve(
      [
        [0, 0],
        [1, 1],
      ],
      0.5
    );
    expectClose(p[0], 0.5);
    expectClose(p[1], 0.5);
  });

  it('should return endpoints at t=0 and t=1', () => {
    const pts = [
      [0, 0],
      [1, 2],
      [3, 1],
    ];
    const p0 = bezierCurve(pts, 0);
    const p1 = bezierCurve(pts, 1);
    expectClose(p0[0], 0);
    expectClose(p0[1], 0);
    expectClose(p1[0], 3);
    expectClose(p1[1], 1);
  });
});

describe('bspline', () => {
  it('should evaluate B-spline', () => {
    const pts = [
      [0, 0],
      [1, 2],
      [2, 0],
      [3, 1],
    ];
    const p = bspline(pts, 2, 0.5);
    expect(p.length).toBe(2);
    expect(typeof p[0]).toBe('number');
  });
});

describe('loess', () => {
  it('should smooth data', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 1, 4, 9, 16];
    const v = loess(xs, ys, 2);
    expect(typeof v).toBe('number');
    // Should be close to the actual value at x=2
    expect(Math.abs(v - 4)).toBeLessThan(2);
  });
});

describe('griddata', () => {
  it('should interpolate scattered data', () => {
    const points = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const values = [0, 1, 1, 2];
    const result = griddata(points, values, [0.5], [0.5]);
    expect(result.length).toBe(1);
    expectClose(result[0][0], 1, 0.5);
  });
});

describe('rbfInterpolate', () => {
  it('should interpolate with gaussian RBF', () => {
    const points = [[0], [1], [2]];
    const values = [0, 1, 4];
    const result = rbfInterpolate(points, values, [[0], [1], [2]]);
    expectClose(result[0], 0, 0.5);
    expectClose(result[1], 1, 0.5);
    expectClose(result[2], 4, 0.5);
  });
});

// =============================================================================
// Curve Fitting
// =============================================================================

describe('curvefit', () => {
  it('should fit a linear model', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 3, 5, 7, 9]; // y = 2x + 1
    const params = curvefit((x, p) => p[0] * x + p[1], xs, ys, [1, 0]);
    expectClose(params[0], 2, 0.1);
    expectClose(params[1], 1, 0.1);
  });
});

describe('expfit', () => {
  it('should fit exponential data', () => {
    const xs = [0, 1, 2, 3];
    const ys = xs.map((x) => 2 * Math.exp(0.5 * x));
    const [a, b] = expfit(xs, ys);
    expectClose(a, 2, 0.1);
    expectClose(b, 0.5, 0.1);
  });
});

describe('logfit', () => {
  it('should fit logarithmic data', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = xs.map((x) => 3 * Math.log(x) + 1);
    const [a, b] = logfit(xs, ys);
    expectClose(a, 3, 0.1);
    expectClose(b, 1, 0.1);
  });
});

describe('powerfit', () => {
  it('should fit power law data', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = xs.map((x) => 2 * Math.pow(x, 3));
    const [a, b] = powerfit(xs, ys);
    expectClose(a, 2, 0.5);
    expectClose(b, 3, 0.3);
  });
});

// =============================================================================
// ODE Solvers
// =============================================================================

describe('solveODESystem', () => {
  it('should solve dy/dt = -y (exponential decay)', () => {
    const sol = solveODESystem((_t, y) => [-y[0]], [1], [0, 2], { dt: 0.01 });
    const lastY = sol.y[sol.y.length - 1][0];
    expectClose(lastY, Math.exp(-2), 0.01);
  });

  it('should solve a 2D system', () => {
    // dy1/dt = y2, dy2/dt = -y1 (harmonic oscillator)
    const sol = solveODESystem((_t, y) => [y[1], -y[0]], [1, 0], [0, Math.PI], { dt: 0.01 });
    const lastY = sol.y[sol.y.length - 1];
    expectClose(lastY[0], -1, 0.05);
    expectClose(lastY[1], 0, 0.1);
  });
});

describe('stiffODESolver', () => {
  it('should solve a simple decay equation', () => {
    const sol = stiffODESolver((_t, y) => [-10 * y[0]], [1], [0, 1]);
    const lastY = sol.y[sol.y.length - 1][0];
    expectClose(lastY, Math.exp(-10), 0.01);
  });
});

describe('odeAdaptiveStep', () => {
  it('should take a single adaptive step', () => {
    const result = odeAdaptiveStep((_t, y) => [-y[0]], [1], 0, 0.1);
    expect(result.y.length).toBe(1);
    expect(result.t).toBeCloseTo(0.1);
    expectClose(result.y[0], Math.exp(-0.1), 0.001);
  });
});

describe('eventDetection', () => {
  it('should detect zero crossing', () => {
    // dy/dt = 1, event at y = 5
    const sol = eventDetection(
      (_t, _y) => [1],
      [0],
      [0, 10],
      (_t, y) => y[0] - 5
    );
    expect(sol.eventTime).toBeDefined();
    expectClose(sol.eventTime!, 5, 0.1);
  });
});

// =============================================================================
// Other Numerical Methods
// =============================================================================

describe('cond', () => {
  it('should return 1 for identity matrix', () => {
    const c = cond([
      [1, 0],
      [0, 1],
    ]);
    expectClose(c, 1, 0.5);
  });

  it('should return large value for ill-conditioned matrix', () => {
    const c = cond([
      [1, 1],
      [1, 1.0001],
    ]);
    expect(c).toBeGreaterThan(100);
  });
});

describe('rank', () => {
  it('should return 2 for full-rank 2x2', () => {
    expect(
      rank([
        [1, 0],
        [0, 1],
      ])
    ).toBe(2);
  });

  it('should return 1 for rank-deficient 2x2', () => {
    expect(
      rank([
        [1, 2],
        [2, 4],
      ])
    ).toBe(1);
  });

  it('should handle rectangular matrices', () => {
    expect(
      rank([
        [1, 0, 0],
        [0, 1, 0],
      ])
    ).toBe(2);
  });
});

describe('nullspace', () => {
  it('should find null space of rank-deficient matrix', () => {
    const ns = nullspace([
      [1, 2],
      [2, 4],
    ]);
    expect(ns.length).toBe(1);
    // Verify it is in the null space
    const v = ns[0];
    const Av0 = 1 * v[0] + 2 * v[1];
    expectClose(Av0, 0, 1e-8);
  });

  it('should return empty for full-rank matrix', () => {
    const ns = nullspace([
      [1, 0],
      [0, 1],
    ]);
    expect(ns.length).toBe(0);
  });
});

describe('chebyshevApprox', () => {
  it('should approximate sin on [0, pi]', () => {
    const f = chebyshevApprox(Math.sin, 0, Math.PI, 10);
    expectClose(f(Math.PI / 2), 1, 1e-4);
    expectClose(f(0), 0, 1e-4);
  });
});

describe('padeApproximant', () => {
  it('should compute [2/1] Pade for exp(x)', () => {
    // Taylor: 1 + x + x^2/2 + x^3/6 + ...
    const result = padeApproximant([1, 1, 0.5, 1 / 6], 2, 1);
    expect(result.num.length).toBe(3);
    expect(result.den.length).toBe(2);
  });
});

describe('quadprog', () => {
  it('should solve simple QP', () => {
    // min 0.5 * x^2 + 0.5 * y^2 (i.e. find origin)
    const x = quadprog(
      [
        [1, 0],
        [0, 1],
      ],
      [0, 0],
      [],
      []
    );
    expectClose(x[0], 0, 0.1);
    expectClose(x[1], 0, 0.1);
  });
});

describe('linprog', () => {
  it('should solve simple LP', () => {
    // min x + 2y s.t. x + y >= 4 => -x - y <= -4, x,y >= 0
    // But standard form requires b >= 0. Use: min x + 2y s.t. x + y <= 10, x,y >= 0
    // Minimum is at origin: x=0, y=0
    const x = linprog([1, 2], [[1, 1]], [10]);
    expect(x).not.toBeNull();
    if (x) {
      expectClose(x[0], 0, 0.1);
      expectClose(x[1], 0, 0.1);
    }
  });
});

describe('solvePDE', () => {
  it('should solve heat equation', () => {
    const result = solvePDE(
      { alpha: 0.01 },
      { L: 1, nx: 21, nt: 100, T: 0.5 },
      {
        left: 0,
        right: 0,
        initial: (x) => Math.sin(Math.PI * x),
      }
    );
    expect(result.x.length).toBe(21);
    expect(result.u.length).toBe(21);
    // Boundary conditions should hold
    expectClose(result.u[0], 0);
    expectClose(result.u[20], 0);
  });
});
