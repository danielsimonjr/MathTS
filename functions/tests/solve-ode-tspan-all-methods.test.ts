/**
 * #991: the input and derivative contract of every solveODE method.
 *
 * - A bad tspan shape throws a TypeError, a non-finite tspan throws a RangeError, at entry.
 * - A non-finite y0 throws a RangeError at entry, before f is called.
 * - A non-finite derivative at an accepted point (t0 included) throws at once and names t.
 * - A non-finite trial (stage, new state or error norm) is rejected and the step shrinks.
 * - When the step cannot shrink more, the run throws the step size underflow error.
 *
 * Tolerances are measured worst errors with margin; each comment gives the measured value.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { solveODE, stiffODESolver, matrix, type ODEMatrixSolution } from '../src/index.js';
import { solveODESystem, solveParabolicPDE } from '../src/typed/numeric.js';

const METHODS = ['RK23', 'RK45', 'Rosenbrock', 'RODAS', 'BDF', 'Radau'] as const;
type Method = (typeof METHODS)[number];

/** The array solution. The typed dispatch returns `unknown`, so each call site asserts it. */
type Solution = { t: number[]; y: number[][] };
type Fn = (t: number, y: number[]) => number[];

const SHAPE_TEXT = '"tspan" must be an Array of two numeric values or two units [tStart, tEnd]';
const FINITE_TEXT = '"tspan" must contain finite numbers (NaN and Infinity are not allowed)';
const Y0_TEXT = '"y0" must contain finite numbers (NaN and Infinity are not allowed)';

const dec: Fn = (_t, y) => [-y[0]];
const sq: Fn = (_t, y) => [-Math.sqrt(y[0])];
const rob: Fn = (_t, y) => [
  -0.04 * y[0] + 1e4 * y[1] * y[2],
  0.04 * y[0] - 1e4 * y[1] * y[2] - 3e7 * y[1] * y[1],
  3e7 * y[1] * y[1],
];

/** The error a call throws. Fails the test when the call returns. */
function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected a throw, the call returned');
}

/** The t that an underflow or not-finite message names. */
function failT(run: () => unknown): number {
  const m = thrown(run).message;
  expect(m).toMatch(/step size underflow|the derivative is not finite/);
  const mt = /at t=([-0-9.e+]+)/.exec(m);
  expect(mt).not.toBeNull();
  return Number(mt![1]);
}

function yEnd(sol: unknown): number {
  const s = sol as Solution;
  return s.y[s.y.length - 1][0];
}

// abs error of y(1.9) against the exact 0.0025, default tol; measured worst in the comment.
const SQRT_TOL: Record<Method, number> = {
  RK23: 2e-4, // 8.7e-5
  RK45: 1e-5, // 1.6e-6
  Rosenbrock: 2e-4, // 5.6e-5
  RODAS: 1e-5, // 8.6e-7
  BDF: 1e-5, // 3.2e-6
  Radau: 1e-6, // 2.8e-8
};
// abs error of y(0) against e for the reversed span [1, 0], default tol.
const REV_TOL: Record<Method, number> = {
  RK23: 1e-4, // 4.6e-6
  RK45: 1e-4, // 2.2e-6
  Rosenbrock: 3e-3, // 1.5e-3
  RODAS: 1e-4, // 1.8e-5
  BDF: 3e-3, // 9.0e-4
  Radau: 1e-4, // 1.2e-6
};

for (const method of METHODS) {
  const S =
    (f: Fn, ts: unknown, y0: unknown, o: Record<string, unknown> = {}) =>
    () =>
      solveODE(f, ts as number[], y0 as number[], { method, ...o });

  describe(`solveODE ${method}: entry checks`, () => {
    it('rejects a nonpositive or nonfinite tolerance before calling the derivative', () => {
      const derivative = () => {
        throw new Error('unexpected derivative call');
      };
      for (const tol of [-1, 0, NaN, Infinity]) {
        const err = thrown(S(derivative, [0, 1], [1], { tol }));
        expect(err).toBeInstanceOf(RangeError);
        expect(err.message).toBe('"tol" must be finite and positive');
      }
    });

    it('the #991 call throws the tspan TypeError', () => {
      const e = thrown(S(rob, [1, 0, 0], [0, 40]));
      expect(e).toBeInstanceOf(TypeError);
      expect(e.message).toBe(SHAPE_TEXT);
    });
    for (const [label, ts] of [
      ['length 1', [0]],
      ['strings', ['a', 1]],
    ] as const) {
      it(`a tspan of ${label} throws the TypeError`, () => {
        const e = thrown(S(dec, ts, [1]));
        expect(e).toBeInstanceOf(TypeError);
        expect(e.message).toBe(SHAPE_TEXT);
      });
    }
    for (const [label, ts] of [
      ['NaN', [0, NaN]],
      ['Infinity', [0, Infinity]],
      ['-Infinity', [-Infinity, 0]],
    ] as const) {
      it(`a ${label} tspan entry throws the RangeError`, () => {
        const e = thrown(S(dec, ts, [1]));
        expect(e).toBeInstanceOf(RangeError);
        expect(e.message).toBe(FINITE_TEXT);
      });
    }
    for (const [label, y0] of [
      ['NaN', [NaN]],
      ['Infinity', [Infinity]],
      ['-Infinity', [-Infinity]],
      ['partly NaN', [1, NaN]],
    ] as const) {
      it(`a ${label} y0 throws the RangeError before f is called`, () => {
        let calls = 0;
        const f: Fn = (_t, y) => {
          calls++;
          return y.map((v) => -v);
        };
        const e = thrown(S(f, [0, 1], y0));
        expect(e).toBeInstanceOf(RangeError);
        expect(e.message).toBe(Y0_TEXT);
        expect(calls).toBe(0);
      });
    }
    it('a scalar NaN y0 throws the RangeError', () => {
      const e = thrown(() =>
        solveODE((_t: number, y: number) => -y, [0, 1], NaN as unknown as number[], { method })
      );
      expect(e).toBeInstanceOf(RangeError);
      expect(e.message).toBe(Y0_TEXT);
    });
    it('a Matrix NaN y0 throws the RangeError', () => {
      const e = thrown(() =>
        solveODE(dec, matrix([0, 1]) as never, matrix([NaN]) as never, { method })
      );
      expect(e).toBeInstanceOf(RangeError);
      expect(e.message).toBe(Y0_TEXT);
    });
    it('events: 5 throws the events TypeError before f is called', () => {
      let calls = 0;
      const f: Fn = (_t, y) => {
        calls++;
        return [-y[0]];
      };
      const e = thrown(S(f, [0, 1], [1], { events: 5 }));
      expect(e).toBeInstanceOf(TypeError);
      expect(e.message).toMatch(/"events" entry must be a function/);
      expect(calls).toBe(0);
    });
    it('a non-array y0 keeps the RK45 text', () => {
      expect(thrown(S(dec, [0, 1], 'a')).message).toBe('Cannot convert "a" to a number');
    });
    it('a non-function f throws a TypeError', () => {
      const e = thrown(() => solveODE(5 as unknown as Fn, [0, 1], [1], { method }));
      expect(e).toBeInstanceOf(TypeError);
      expect(e.message).not.toMatch(/is not a function/);
    });
  });

  describe(`solveODE ${method}: non-finite derivative`, () => {
    const at0 = new RegExp(`^solveODE ${method}: the derivative is not finite at t=0$`);
    it('f NaN at t0 throws and names t=0', () => {
      expect(thrown(S(() => [NaN], [0, 1], [1])).message).toMatch(at0);
    });
    it('f Infinity at t0 throws and names t=0', () => {
      expect(thrown(S(() => [Infinity], [0, 1], [1])).message).toMatch(at0);
    });
    it('f NaN at t0 with firstStep 0.1 throws and names t=0', () => {
      expect(thrown(S(() => [NaN], [0, 1], [1], { firstStep: 0.1 })).message).toMatch(at0);
    });
    it('f NaN at t0 of a reversed span throws and names t=1', () => {
      expect(thrown(S(() => [NaN], [1, 0], [1])).message).toMatch(
        new RegExp(`^solveODE ${method}: the derivative is not finite at t=1$`)
      );
    });
    // measured worst 4.4e-9 (RODAS)
    it('f NaN after t=0.5 stops the run near 0.5', () => {
      const t = failT(S((t, y) => [t > 0.5 ? NaN : -y[0]], [0, 1], [1]));
      expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(1e-6);
    });
    it('f Infinity after t=0.5 stops the run near 0.5', () => {
      const t = failT(S((t, y) => [t > 0.5 ? Infinity : -y[0]], [0, 1], [1]));
      expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(1e-6);
    });
    it('f NaN below t=0.5 on a reversed span stops the run near 0.5', () => {
      const t = failT(S((t, y) => [t < 0.5 ? NaN : -y[0]], [1, 0], [1]));
      expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(1e-6);
    });
    // measured worst 6.3e-4
    it('f NaN after t=0.5 with minStep 1e-3 stops the run near 0.5', () => {
      const t = failT(S((t, y) => [t > 0.5 ? NaN : -y[0]], [0, 1], [1], { minStep: 1e-3 }));
      expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(2e-3);
    });
    it('f NaN for every t > t0 throws underflow at t=0', () => {
      const m = thrown(S((t) => [t > 0 ? NaN : 1], [0, 1], [1])).message;
      expect(m).toMatch(new RegExp(`^solveODE ${method}: step size underflow at t=0 `));
    });
  });

  describe(`solveODE ${method}: valid problems`, () => {
    it("y' = -sqrt(y) reaches y(1.9) = 0.0025 (a trial stage leaves the domain of f)", () => {
      expect(Math.abs(yEnd(S(sq, [0, 1.9], [1])()) - 0.0025)).toBeLessThanOrEqual(SQRT_TOL[method]);
    });
    // measured worst 7.4e-5; SciPy 1.16.3 Radau stops at 0.170422
    it("y' = log(y) - 5 stops near t = 0.17042", () => {
      const t = failT(S((_t, y) => [Math.log(y[0]) - 5], [0, 3], [1]));
      expect(Math.abs(t - 0.17042)).toBeLessThanOrEqual(2e-4);
    });
    if (method !== 'RK23' && method !== 'RK45') {
      // measured worst 1.3e-3 (BDF)
      it("y' = y^2 stops near the blow-up at t = 1", () => {
        const t = failT(S((_t, y) => [y[0] * y[0]], [0, 2], [1]));
        expect(Math.abs(t - 1)).toBeLessThanOrEqual(3e-3);
      });
    }
    it('an equal span returns the single start point', () => {
      const sol = solveODE(dec, [1, 1], [1], { method }) as Solution;
      expect(sol.t).toEqual([1]);
      expect(sol.y).toEqual([[1]]);
    });
    it('a reversed span integrates backward to y(0) = e, as SciPy solve_ivp does', () => {
      const sol = S(dec, [1, 0], [1])() as Solution;
      expect(sol.t[sol.t.length - 1]).toBe(0);
      expect(Math.abs(yEnd(sol) - Math.E)).toBeLessThanOrEqual(REV_TOL[method]);
    });
  });
}

describe('solveODE sqrt at tol 1e-3: inputs that returned NaN before the fix', () => {
  const cases: [Method, number, number][] = [
    ['RK45', 1.6058484848484849, 5e-4], // measured 1.5e-4
    ['RK23', 1.9435555555555555, 1e-3], // measured 2.7e-4
    ['Rosenbrock', 1.993959595959596, 5e-5], // measured 9.1e-6
    ['RODAS', 1.999, 1e-6], // measured 2.4e-7
  ];
  for (const [method, tf, tol] of cases) {
    it(`${method} tf=${tf} matches (1 - tf/2)^2`, () => {
      const y = yEnd(solveODE(sq, [0, tf], [1], { method, tol }));
      expect(Math.abs(y - (1 - tf / 2) ** 2)).toBeLessThanOrEqual(tol);
    });
  }
});

describe('stiffODESolver contract', () => {
  it('a NaN or Infinity y0 throws a RangeError', () => {
    for (const v of [NaN, Infinity]) {
      const e = thrown(() => stiffODESolver(dec, [0, 1], [v]));
      expect(e).toBeInstanceOf(RangeError);
      expect(e.message).toMatch(/stiffODESolver: y0 must contain finite numbers/);
    }
  });
  it('f NaN at t0 throws and names t=0', () => {
    expect(thrown(() => stiffODESolver(() => [NaN], [0, 1], [1])).message).toMatch(
      /the derivative is not finite at t=0$/
    );
  });
  it('f NaN after t=0.5 stops the run near 0.5', () => {
    const t = failT(() =>
      stiffODESolver((t: number, y: number[]) => [t > 0.5 ? NaN : -y[0]], [0, 1], [1])
    );
    expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(1e-6);
  });
  // measured 4.7e-7
  it("y' = -sqrt(y) reaches y(1.9) = 0.0025", () => {
    expect(Math.abs(yEnd(stiffODESolver(sq, [0, 1.9], [1])) - 0.0025)).toBeLessThanOrEqual(1e-5);
  });
});

describe('solveODESystem contract', () => {
  it('a NaN y0 throws a RangeError (unchanged)', () => {
    const e = thrown(() => solveODESystem(dec, [NaN], [0, 1]));
    expect(e).toBeInstanceOf(RangeError);
    expect(e.message).toMatch(/not finite/);
  });
  it('f NaN after t=0.5 stops the run near 0.5 (unchanged)', () => {
    const t = failT(() =>
      solveODESystem((t: number, y: number[]) => [t > 0.5 ? NaN : -y[0]], [1], [0, 1])
    );
    expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(1e-6);
  });
  for (const [label, ts, opts] of [
    ['NaN', [0, NaN], undefined],
    ['length 3', [0, 1, 2], undefined],
    ['Infinity', [0, Infinity], undefined],
    ['NaN with dt 0.1', [0, NaN], { dt: 0.1 }],
  ] as const) {
    it(`a ${label} tspan throws a TypeError`, () => {
      const e = thrown(() =>
        solveODESystem(dec, [1], ts as unknown as [number, number], opts as never)
      );
      expect(e).toBeInstanceOf(TypeError);
      expect(e.message).toMatch(/solveODESystem: tspan must be a finite numeric pair/);
    });
  }
});

describe('solveParabolicPDE finite T', () => {
  const pde = {
    x0: 0,
    x1: 1,
    T: 0.1,
    nx: 5,
    diffusion: 1,
    u0: (x: number) => Math.sin(Math.PI * x),
    bcLeft: { type: 'dirichlet' as const, value: 0 },
    bcRight: { type: 'dirichlet' as const, value: 0 },
  };
  it('T = NaN throws', () => {
    expect(thrown(() => solveParabolicPDE({ ...pde, T: NaN } as never)).message).toMatch(/T > 0/);
  });
  // Hangs on the unfixed code: the RED run excludes it by name.
  it('T = Infinity throws (hangs on main)', () => {
    expect(thrown(() => solveParabolicPDE({ ...pde, T: Infinity } as never)).message).toMatch(
      /finite T > 0/
    );
  });
});

describe('solveODE with Array and Matrix vectors', () => {
  it.each([
    [false, true],
    [true, false],
    [true, true],
  ])('matches mathjs matrix output with matrix tspan=%s and y0=%s', (matrixTime, matrixState) => {
    const times = [0, 1];
    const initial = [1, 2];
    const f: Fn = (_t, y) => y.map((value) => -value);
    const { solveODE: oracle } = mathjs as unknown as {
      solveODE(
        fn: Fn,
        t: number[] | mathjs.Matrix,
        y: number[] | mathjs.Matrix
      ): {
        t: mathjs.Matrix;
        y: mathjs.Matrix;
      };
    };
    const expected = oracle(
      f,
      matrixTime ? mathjs.matrix(times) : times,
      matrixState ? mathjs.matrix(initial) : initial
    );
    const inputTime = matrixTime ? matrix(times) : times;
    const inputState = matrixState ? matrix(initial) : initial;
    for (const result of [
      solveODE(f, inputTime, inputState),
      solveODE(f, inputTime, inputState, {}),
    ]) {
      const { t, y } = result as ODEMatrixSolution;
      // mathjs 15.3.0 (#3734 collection changes): the tspan decides the container, so a
      // Matrix y0 with an Array tspan gives array outputs on both sides.
      const asRows = (v: unknown): unknown =>
        typeof (v as { toArray?: () => unknown }).toArray === 'function'
          ? (v as { toArray(): unknown }).toArray()
          : v;
      const gotTimes = asRows(t) as number[];
      const gotStates = asRows(y) as number[][];
      const expectedTimes = asRows(expected.t) as number[];
      const expectedStates = asRows(expected.y) as number[][];
      expect(gotTimes[0]).toBe(expectedTimes[0]);
      expect(gotTimes.at(-1)).toBe(expectedTimes.at(-1));
      expect(gotStates[0]).toEqual(expectedStates[0]);
      for (let i = 0; i < initial.length; i++) {
        expect((gotStates.at(-1) as number[])[i]).toBeCloseTo(
          (expectedStates.at(-1) as number[])[i],
          3
        );
      }
    }
  });
});
