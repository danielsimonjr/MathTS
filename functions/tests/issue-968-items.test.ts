/**
 * #968: typed `mod`, `floor`, `ceil` and `fix` (item 1), mixed Array and matrix operands (item 5),
 * the stiffness hint of a step budget error (item 6), a BigNumber derivative that is not finite
 * (item 7), `csd` and `coherence` (item 8b), the `sampleN` count (item 8c) and the Bluestein plan
 * cache (item 8d). Items 2, 3, 4, 7 (number) and 8a were fixed before this change; the last
 * describe block pins each of them.
 *
 * The oracles are mathjs 15.2.0 (the devDependency, called live) and SciPy 1.16.3 (the values
 * below were computed with `scipy.signal.csd` and `coherence`, `detrend=False`, `window='boxcar'`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as mathjs from 'mathjs';
import {
  DenseMatrix as PublicDense,
  SparseMatrix as PublicSparse,
} from '@danielsimonjr/mathts-matrix';
import * as math from '../src/index.js';
import * as stepLimit from '../src/numeric/ode-step-limit.js';
import * as fftCore from '../src/signal/fft-core-f64.js';
import { MAX_ALLOC_ELEMENTS } from '../src/utils/limits.js';

type Fn = (...a: unknown[]) => unknown;
const mt = math as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

/** The nested Array of a matrix, or the value itself. */
function plain(x: unknown): unknown {
  const t = (x as { toArray?: () => unknown } | null)?.toArray;
  return typeof t === 'function' ? t.call(x) : x;
}

/** The class name of a MathTS result. */
const className = (x: unknown): string => (x as { constructor: { name: string } }).constructor.name;

/** The kind of a result: 'Array', 'Dense' or 'Sparse' for a collection, else the typeof. */
function kindOf(x: unknown): string {
  if (Array.isArray(x)) return 'Array';
  const name = className(x);
  if (/Sparse/.test(name)) return 'Sparse';
  if (/Dense/.test(name)) return 'Dense';
  return typeof x;
}

/** The kind of a mathjs result. */
function mathjsKindOf(x: unknown): string {
  if (Array.isArray(x)) return 'Array';
  const type = mj.typeOf(x) as string;
  if (type === 'SparseMatrix') return 'Sparse';
  if (type === 'DenseMatrix') return 'Dense';
  return type;
}

const same = (a: number, b: number): boolean => Object.is(a, b);

// =============================================================================
// Item 1: mod, floor, ceil, fix
// =============================================================================

describe('#968 item 1: typed mod equals mathjs', () => {
  it('8: agrees with mathjs, sign of zero included, on the grid a/10, b/10 (a, b in -30..30)', () => {
    const differences: string[] = [];
    for (let a = -30; a <= 30; a++) {
      for (let b = -30; b <= 30; b++) {
        const x = a / 10;
        const y = b / 10;
        const got = mt.mod(x, y) as number;
        const want = mj.mod(x, y) as number;
        if (!same(got, want)) differences.push(`mod(${x}, ${y}): ${got} != ${want}`);
      }
    }
    expect(differences.slice(0, 5)).toEqual([]);
    expect(differences.length).toBe(0);
  });

  it('8: mod(0.3, 0.1) is the mathjs value and mod(0, -4) is +0', () => {
    expect(mt.mod(0.3, 0.1)).toBe(-5.551115123125783e-17);
    expect(Object.is(mt.mod(0, -4), 0)).toBe(true);
    expect(Object.is(mt.mod(-0, -4), 0)).toBe(true);
    expect(Object.is(mt.mod(4, -2), 0)).toBe(true);
  });

  /** The floored remainder of two integers, exact (BigInt). */
  const exactMod = (a: number, b: number): number => {
    const x = BigInt(a);
    const y = BigInt(b);
    let r = x % y;
    if (r !== 0n && r < 0n !== y < 0n) r += y;
    return Number(r);
  };

  it('8: keeps the exact value for large integers (mathjs gives -1, -1, -1, 0, 0 here)', () => {
    const cases: [number, number][] = [
      [1700006399999, 86400000],
      [9999999999999, 1e13],
      [2999999999999, 1e12],
      [1e16, 3],
      [1e20, 7],
    ];
    expect(cases.map(([a, b]) => exactMod(a, b))).toEqual([
      86399999, 9999999999999, 999999999999, 1, 2,
    ]);
    for (const [a, b] of cases) {
      expect(mt.mod(a, b), `mod(${a}, ${b})`).toBe(exactMod(a, b));
      expect(mt.factory_mod(a, b), `factory_mod(${a}, ${b})`).toBe(exactMod(a, b));
    }
  });

  it('8: the factory and the typed function give one value on the grid', () => {
    const differences: string[] = [];
    for (let a = -30; a <= 30; a++) {
      for (let b = -30; b <= 30; b++) {
        const x = a / 10;
        const y = b / 10;
        if (!same(mt.factory_mod(x, y) as number, mt.mod(x, y) as number)) {
          differences.push(`${x}, ${y}`);
        }
      }
    }
    expect(differences.slice(0, 5)).toEqual([]);
  });

  it('8: an Array, a matrix and the expression evaluator follow the scalar row', () => {
    expect(mt.mod([0.3], 0.1)).toEqual([-5.551115123125783e-17]);
    expect(plain(mt.mod(mt.matrix([0.3]), 0.1))).toEqual([-5.551115123125783e-17]);
    expect(mt.evaluate('mod(0.3, 0.1)')).toBe(-5.551115123125783e-17);
  });
});

describe('#968 item 1 (class): typed floor, ceil and fix snap to an integer as mathjs does', () => {
  const scalars: number[] = [];
  for (let x = -30; x <= 30; x++) scalars.push(x / 10);
  scalars.push(
    0.3 / 0.1,
    2.9999999999999996,
    -2.9999999999999996,
    1.0000000000000002,
    -1.0000000000000002,
    1e-17,
    -1e-17,
    -5e-324,
    -0
  );

  for (const name of ['floor', 'ceil', 'fix'] as const) {
    it(`9: ${name} of a number equals mathjs, sign of zero included`, () => {
      const differences = scalars
        .filter((x) => !same(mt[name](x) as number, mj[name](x) as number))
        .map((x) => `${name}(${x}): ${String(mt[name](x))} != ${String(mj[name](x))}`);
      expect(differences).toEqual([]);
    });

    it(`9: ${name} of an Array and of a Float64Array equals mathjs element by element`, () => {
      const want = mj[name](scalars) as number[];
      const array = mt[name](scalars) as number[];
      const typed = mt[name](new Float64Array(scalars)) as Float64Array;
      expect(array.filter((v, i) => !same(v, want[i]))).toEqual([]);
      expect(Array.from(typed).filter((v, i) => !same(v, want[i]))).toEqual([]);
    });
  }

  it('9: the mathjs values of a zero, and of a value that rounds to zero', () => {
    const read = (r: unknown): number[] => (r as number[]).map((v) => (Object.is(v, -0) ? -0 : v));
    expect(read(mt.floor([-0, -1e-17, 0.2]))).toEqual([-0, 0, 0]);
    expect(Object.is((mt.floor([-0, -1e-17, 0.2]) as number[])[0], -0)).toBe(true);
    expect(Object.is((mt.floor([-0, -1e-17, 0.2]) as number[])[1], 0)).toBe(true);
    expect((mt.ceil([-0, -0.2, 1e-17]) as number[]).map((v) => Object.is(v, -0))).toEqual([
      true,
      true,
      false,
    ]);
    expect((mt.fix([-0, -0.2, 0.2, -1e-17]) as number[]).map((v) => Object.is(v, -0))).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });

  it('9: a BigNumber snaps to the integer as mathjs does', () => {
    const up = '2.9999999999999999';
    const down = '-1.0000000000000001';
    for (const name of ['floor', 'ceil', 'fix'] as const) {
      expect(String(mt[name](mt.bignumber(up))), `${name}(${up})`).toBe(
        String(mj[name](mj.bignumber(up)))
      );
      expect(String(mt[name](mt.bignumber(down))), `${name}(${down})`).toBe(
        String(mj[name](mj.bignumber(down)))
      );
    }
    expect(['floor', 'ceil', 'fix'].map((n) => String(mt[n](mt.bignumber(up))))).toEqual([
      '3',
      '3',
      '3',
    ]);
    expect(['floor', 'ceil', 'fix'].map((n) => String(mt[n](mt.bignumber(down))))).toEqual([
      '-1',
      '-1',
      '-1',
    ]);
  });

  it('9: a Complex and a Fraction keep their value (mathjs does not snap them)', () => {
    for (const name of ['floor', 'ceil', 'fix'] as const) {
      const z = mt[name](mt.complex(2.9999999999999996, -1.0000000000000002)) as {
        re: number;
        im: number;
      };
      const w = mj[name](mj.complex(2.9999999999999996, -1.0000000000000002)) as {
        re: number;
        im: number;
      };
      expect([z.re, z.im], `${name} complex`).toEqual([w.re, w.im]);
      const f = mt[name](mt.fraction(7, 3)) as { toString(): string };
      const g = mj[name](mj.fraction(7, 3)) as { toString(): string };
      expect(f.toString(), `${name} fraction`).toBe(g.toString());
    }
  });

  it('9: the expression evaluator snaps', () => {
    expect(mt.evaluate('floor(2.9999999999999996)')).toBe(3);
    expect(mt.evaluate('fix(-2.9999999999999996)')).toBe(-3);
  });
});

// =============================================================================
// Item 5: mixed Array and matrix operands
// =============================================================================

describe('#968 item 5: an Array with a matrix gives a matrix', () => {
  const A = [
    [1, 2],
    [3, 4],
  ];
  const B = [
    [1, 0],
    [0, 4],
  ];
  const C = [
    [1, 1],
    [1, 1],
  ];
  type Kind = 'A' | 'D' | 'S';
  const kinds: Kind[] = ['A', 'D', 'S'];
  const build = (lib: Record<string, Fn>, kind: Kind, data: unknown): unknown =>
    kind === 'A' ? data : lib[kind === 'D' ? 'matrix' : 'sparse'](data);
  const attempt = (run: () => unknown): { value?: unknown; error?: Error } => {
    try {
      return { value: run() };
    } catch (e) {
      return { error: e as Error };
    }
  };
  /** Compare nested numbers with a relative tolerance (an inverse product is not exact). */
  function expectClose(got: unknown, want: unknown, label: string): void {
    if (Array.isArray(want)) {
      expect(Array.isArray(got), label).toBe(true);
      expect((got as unknown[]).length, label).toBe(want.length);
      want.forEach((w, i) => expectClose((got as unknown[])[i], w, `${label}[${i}]`));
    } else {
      expect(Math.abs((got as number) - (want as number)), label).toBeLessThanOrEqual(
        1e-12 * Math.max(1, Math.abs(want as number))
      );
    }
  }

  const pairs: [Kind, Kind][] = [];
  for (const k1 of kinds)
    for (const k2 of kinds) if (k1 !== 'A' || k2 !== 'A') pairs.push([k1, k2]);
  const operands: [string, unknown, unknown][] = [
    ['A,B', A, B],
    ['B,A', B, A],
    ['A,C', A, C],
    ['C,A', C, A],
  ];

  for (const fn of ['add', 'subtract', 'multiply', 'divide'] as const) {
    it(`10: ${fn} gives the result type and the values of mathjs for every pair`, () => {
      const failures: string[] = [];
      for (const [k1, k2] of pairs) {
        for (const [label, x, y] of operands) {
          const id = `${fn}(${k1},${k2}) ${label}`;
          const want = attempt(() => mj[fn](build(mj, k1, x), build(mj, k2, y)));
          const got = attempt(() => mt[fn](build(mt, k1, x), build(mt, k2, y)));
          if (want.error) {
            if (!got.error) failures.push(`${id}: mathjs throws, MathTS returns`);
            continue;
          }
          if (got.error) {
            failures.push(`${id}: MathTS throws ${got.error.message}`);
            continue;
          }
          // multiply and divide of a dense with a sparse matrix: the storage is finding 3 of the
          // plan (mathjs gives sparse; MathTS gives dense by design). Compare the values only.
          const denseSparse =
            (fn === 'multiply' || fn === 'divide') &&
            ((k1 === 'D' && k2 === 'S') || (k1 === 'S' && k2 === 'D'));
          const wantKind = mathjsKindOf(want.value);
          const gotKind = kindOf(got.value);
          if (denseSparse) {
            if (gotKind === 'Array') failures.push(`${id}: an Array, mathjs gives a matrix`);
          } else if (gotKind !== wantKind) {
            failures.push(`${id}: ${gotKind}, mathjs gives ${wantKind}`);
          }
          expectClose(plain(got.value), plain(want.value), id);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('10: a 1-D Array and a matrix (multiply and divide) follow mathjs, with one documented superset', () => {
    const one = [1, 1];
    const failures: string[] = [];
    for (const fn of ['multiply', 'divide'] as const) {
      for (const kind of ['D', 'S'] as const) {
        for (const first of [true, false]) {
          const id = `${fn} ${first ? `([1,1], ${kind})` : `(${kind}, [1,1])`}`;
          const operand = (lib: Record<string, Fn>): unknown[] =>
            first ? [one, build(lib, kind, A)] : [build(lib, kind, A), one];
          const want = attempt(() => mj[fn](...operand(mj)));
          const got = attempt(() => mt[fn](...operand(mt)));
          const documentedSuperset = first && kind === 'S';
          if (want.error) {
            if (!got.error && !documentedSuperset)
              failures.push(`${id}: mathjs throws, MathTS returns`);
            continue;
          }
          if (got.error) {
            failures.push(`${id}: MathTS throws ${got.error.message}`);
            continue;
          }
          if (kindOf(got.value) !== mathjsKindOf(want.value)) {
            failures.push(`${id}: ${kindOf(got.value)}, mathjs gives ${mathjsKindOf(want.value)}`);
          }
          expectClose(plain(got.value), plain(want.value), id);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('10: known values of A = [[1,2],[3,4]]', () => {
    const D = mt.matrix(A);
    const S = mt.sparse(A);
    const check = (r: unknown, kind: string, value: unknown): void => {
      expect(kindOf(r)).toBe(kind);
      expect(plain(r)).toEqual(value);
    };
    check(mt.multiply(D, [1, 1]), 'Dense', [3, 7]);
    check(mt.multiply([1, 1], D), 'Dense', [4, 6]);
    check(mt.multiply(S, [1, 1]), 'Sparse', [[3], [7]]);
    check(mt.add(S, D), 'Dense', [
      [2, 4],
      [6, 8],
    ]);
    check(mt.divide([1, 1], D), 'Dense', [-0.5, 0.5]);
    // The documented superset: mathjs throws for a 1-D Array times a sparse matrix.
    check(mt.multiply([1, 1], S), 'Dense', [4, 6]);
    check(mt.divide([1, 1], S), 'Dense', [-0.5, 0.5]);
  });

  it('10: a variadic call, BigNumber entries and a shape mismatch follow the matrix path', () => {
    const D = mt.matrix(A);
    expect(kindOf(mt.add(D, A, A))).toBe('Dense');
    expect(plain(mt.add(D, A, A))).toEqual([
      [3, 6],
      [9, 12],
    ]);
    const big = mt.add(mt.matrix([mt.bignumber(1)]), [mt.bignumber(2)]);
    expect(kindOf(big)).toBe('Dense');
    expect((plain(big) as unknown[]).map(String)).toEqual(['3']);
    expect(() => mt.add(D, [[1, 2, 3]])).toThrow(RangeError);
    expect(() => mt.add(D, mt.matrix([[1, 2, 3]]))).toThrow(RangeError);
  });

  it('10: an operand of the matrix package keeps the matrix type', () => {
    const dense = PublicDense.fromArray(A);
    const sparse = PublicSparse.fromDense(PublicDense.fromArray(A));
    for (const fn of ['add', 'subtract', 'multiply'] as const) {
      expect(kindOf(mt[fn](dense, B)), `${fn}(public dense, Array)`).toBe('Dense');
      expect(kindOf(mt[fn](B, dense)), `${fn}(Array, public dense)`).toBe('Dense');
      expect(plain(mt[fn](dense, B))).toEqual(plain(mj[fn](A, B)));
      expect(plain(mt[fn](B, dense))).toEqual(plain(mj[fn](B, A)));
    }
    expect(kindOf(mt.add(sparse, B))).toBe('Dense');
    expect(kindOf(mt.subtract(B, sparse))).toBe('Dense');
    expect(kindOf(mt.multiply(sparse, B))).toBe('Sparse');
    expect(kindOf(mt.multiply(B, sparse))).toBe('Sparse');
    expect(plain(mt.multiply(sparse, B))).toEqual(plain(mj.multiply(A, B)));
    expect(plain(mt.multiply(B, sparse))).toEqual(plain(mj.multiply(B, A)));
  });
});

// =============================================================================
// Item 6 and item 7: the stiffness hint and a BigNumber derivative that is not finite
// =============================================================================

type OdeFn = (t: number, y: number[]) => number[];
const solveSystem = math.solveODESystem as unknown as (
  f: OdeFn,
  y0: number[],
  tspan: [number, number],
  options?: Record<string, unknown>
) => unknown;
const solve = math.solveODE as unknown as (
  f: unknown,
  tspan: unknown[],
  y0: unknown,
  options?: Record<string, unknown>
) => { t: unknown[]; y: unknown[] };

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('the call did not throw');
}

const oscillator: OdeFn = (_t, y) => [y[1], -y[0]];
const stiffLinear: OdeFn = (_t, y) => [-1000 * y[0] + y[1], -y[1]];
const robertson: OdeFn = (_t, y) => {
  const [y1, y2, y3] = y;
  return [-0.04 * y1 + 1e4 * y2 * y3, 0.04 * y1 - 1e4 * y2 * y3 - 3e7 * y2 * y2, 3e7 * y2 * y2];
};

describe('#968 item 6: the stiffness hint names a stiff problem only', () => {
  it('11: a smooth oscillator over a long span runs out of steps with no stiffness hint', () => {
    const system = messageOf(() => solveSystem(oscillator, [1, 0], [0, 1000], { maxSteps: 50 }));
    expect(system).toMatch(/exceeded maxSteps=50/);
    expect(system).not.toMatch(/stiff/);
    for (const method of ['RK45', 'RK23']) {
      const message = messageOf(() =>
        solve(oscillator, [0, 1000], [1, 0], { method, maxIter: 50 })
      );
      expect(message, method).toMatch(/exceeded maxIter=50/);
      expect(message, method).not.toMatch(/stiff/);
    }
  });

  it('11: an oscillator centred at 1e4 and a fast oscillator (omega = 1000) are not stiff', () => {
    const shifted: OdeFn = (_t, y) => [y[1], -(y[0] - 1e4)];
    const fast: OdeFn = (_t, y) => [y[1], -1e6 * y[0]];
    for (const [name, f, y0] of [
      ['centred', shifted, [1e4 + 1, 0]],
      ['fast', fast, [1, 0]],
    ] as const) {
      const system = messageOf(() => solveSystem(f, [...y0], [0, 1000], { maxSteps: 50 }));
      expect(system, `${name} system`).toMatch(/exceeded maxSteps=50/);
      expect(system, `${name} system`).not.toMatch(/stiff/);
      const rk = messageOf(() => solve(f, [0, 1000], [...y0], { method: 'RK45', maxIter: 50 }));
      expect(rk, `${name} RK45`).not.toMatch(/stiff/);
    }
  });

  it('11: a stiff problem keeps the hint', () => {
    const linear = messageOf(() =>
      solve(stiffLinear, [0, 10], [1, 1], { method: 'RK45', maxIter: 50 })
    );
    expect(linear).toMatch(/stiff/);
    const rob = messageOf(() =>
      solve(robertson, [0, 40], [1, 0, 0], { method: 'RK45', maxIter: 5 })
    );
    expect(rob).toMatch(/stiff/);
    const system = messageOf(() => solveSystem(robertson, [1, 0, 0], [0, 40], { maxSteps: 5 }));
    expect(system).toMatch(/stiff/);
  });

  it('11: an f that throws at the points of the hint does not replace the budget error', () => {
    const run = (throwFrom: number): { message: string; calls: number } => {
      let calls = 0;
      const f: OdeFn = (t, y) => {
        calls++;
        if (calls >= throwFrom) throw new Error('f failed');
        return stiffLinear(t, y);
      };
      const message = messageOf(() => solveSystem(f, [1, 1], [0, 10], { maxSteps: 5 }));
      return { message, calls };
    };
    const first = run(Infinity);
    expect(first.message).toMatch(/exceeded maxSteps=5/);
    expect(first.message).toMatch(/stiff/);
    // The last call of the first run is a call of the hint (it evaluates f at perturbed states).
    const second = run(first.calls);
    expect(second.message).toMatch(/exceeded maxSteps=5/);
    expect(second.message).not.toMatch(/stiff/);
    expect(second.message).not.toMatch(/f failed/);
  });

  it('11: a system above the dimension limit gets the budget error with no hint and no extra call of f', () => {
    const limit = (stepLimit as { ODE_HINT_MAX_DIMENSION?: number }).ODE_HINT_MAX_DIMENSION;
    expect(limit).toBe(200);
    const n = (limit ?? 0) + 1;
    let calls = 0;
    const f: OdeFn = (_t, y) => {
      calls++;
      return y.map((v) => -1000 * v);
    };
    const message = messageOf(() =>
      solveSystem(f, new Array<number>(n).fill(1), [0, 10], { maxSteps: 5 })
    );
    expect(message).toMatch(/exceeded maxSteps=5/);
    expect(message).not.toMatch(/stiff/);
    // One call at the start, and 7 per attempt. The hint adds none above the limit.
    const attempts = Number(/accepted of (\d+) attempts/.exec(message)?.[1]);
    expect(calls).toBe(1 + 7 * attempts);
  });
});

describe('#968 item 7: a BigNumber derivative that is not finite', () => {
  const nan = (): unknown => mt.bignumber(NaN);
  const inf = (): unknown => mt.bignumber(Infinity);
  const counted = (f: (t: unknown, y: unknown) => unknown, cap: number) => {
    let n = 0;
    return {
      f: (t: unknown, y: unknown) => {
        n++;
        if (n > cap) throw new Error('CAP');
        return f(t, y);
      },
      calls: () => n,
    };
  };

  for (const method of ['RK45', 'RK23']) {
    for (const [label, bad] of [
      ['NaN', nan],
      ['Infinity', inf],
    ] as const) {
      it(`12: a ${label} derivative stops ${method} at once`, () => {
        const c = counted(() => bad(), 300);
        const message = messageOf(() => solve(c.f, [0, 1], mt.bignumber(1), { method }));
        expect(message).toMatch(/derivative is not finite/);
        expect(c.calls()).toBeLessThanOrEqual(10);
      });
    }

    it(`12: a derivative that turns NaN at t > 0.5 ends ${method} on the step size floor`, () => {
      const c = counted((t, y) => (Number(t) > 0.5 ? nan() : mt.unaryMinus(y)), 20000);
      const message = messageOf(() => solve(c.f, [0, 1], mt.bignumber(1), { method }));
      expect(message).toMatch(/step size underflow/);
      expect(message).not.toMatch(/error estimate/);
      expect(c.calls()).toBeLessThanOrEqual(5000);
    });
  }
});

// =============================================================================
// Item 8b: csd and coherence
// =============================================================================

describe('#968 item 8b: csd and coherence take a segment of exactly nperseg points', () => {
  const x = [0.5, -1, 2, 3, -0.25, 1, 4, -2, 0.75, 1.5, -3, 2.5];
  const y = [1, 2, -1, 0.5, 3, -2, 1, 0, 2, -1, 0.25, 1];
  const csd = math.csd as unknown as (
    a: number[],
    b: number[],
    o?: Record<string, unknown>
  ) => { frequencies: number[]; power: number[] };
  const coherence = math.coherence as unknown as (
    a: number[],
    b: number[],
    o?: Record<string, unknown>
  ) => { frequencies: number[]; coherence: number[] };

  /** Each value within 1e-12 relative (a DFT of non-power-of-two length rounds more). */
  function expectClose(got: number[], want: number[], label: string): void {
    expect(got.length, `${label} length`).toBe(want.length);
    want.forEach((w, i) => {
      expect(Math.abs(got[i] - w), `${label}[${i}]`).toBeLessThanOrEqual(
        1e-12 * Math.max(1, Math.abs(w))
      );
    });
  }

  it('13: nperseg 6 (not a power of two) gives the SciPy bins', () => {
    const options = { nperseg: 6, window: 'rectangular' };
    const p = csd(x, y, options);
    expectClose(p.frequencies, [0, 1 / 6, 1 / 3, 0.5], 'frequencies');
    expectClose(
      p.power,
      [3.322916666666667, 0.5092224313282961, 3.238650946567675, 0.8923611111111117],
      'csd'
    );
    expectClose(
      coherence(x, y, options).coherence,
      [0.9904946584501177, 0.0569820798406155, 0.07594829299055676, 0.5136402519636056],
      'coherence'
    );
  });

  it('13: nperseg 8 (a power of two) gives the one-sided density', () => {
    const options = { nperseg: 8, window: 'rectangular' };
    const p = csd(x, y, options);
    expectClose(p.frequencies, [0, 0.125, 0.25, 0.375, 0.5], 'frequencies');
    expectClose(
      p.power,
      [
        3.234374999999999, 1.246873447745208, 4.050523210802525, 8.553056720351968,
        0.3749999999999998,
      ],
      'csd'
    );
    expectClose(
      coherence(x, y, options).coherence,
      [
        0.960006721324101, 0.9841888870788367, 0.5917843925914671, 0.5086331427184904,
        0.015035606783642895,
      ],
      'coherence'
    );
  });

  it('13: an odd nperseg doubles the last bin as well (nperseg 5)', () => {
    const options = { nperseg: 5, window: 'rectangular' };
    const p = csd(x, y, options);
    expectClose(p.frequencies, [0, 0.2, 0.4], 'frequencies');
    expectClose(p.power, [2.704166666666666, 2.1265661607474744, 1.946705115935177], 'csd');
    expectClose(
      coherence(x, y, options).coherence,
      [0.7513463373736833, 0.5909265545164623, 0.03133662000106243],
      'coherence'
    );
  });

  it('13: the 5-sample case of the issue has 3 bins at 0, 0.2 and 0.4', () => {
    const p = csd([1, 2, 3, 4, 5], [1, 0, 1, 0, 1], { window: 'rectangular' });
    expectClose(p.frequencies, [0, 0.2, 0.4], 'frequencies');
    expectClose(p.power, [9.0, 1.0514622242382674, 1.7013016167040798], 'csd');
  });

  it('13: the sample rate scales the frequencies and the density', () => {
    const p = csd(x, y, { nperseg: 6, noverlap: 0, window: 'rectangular', fs: 100 });
    expectClose(p.frequencies, [0, 16.666666666666668, 33.333333333333336, 50], 'frequencies');
    expectClose(
      p.power,
      [0.025468750000000005, 0.01245608605706909, 0.031319194227874596, 0.0022395833333333334],
      'csd'
    );
  });

  it('13: csd(x, x) is the Welch power spectral density of x', () => {
    const own = csd(x, x, { nperseg: 8, window: 'rectangular' }).power;
    const welch = math.welchPSD(x, { frameLength: 8, overlap: 4, window: 'rectangular' }).psd;
    expectClose(own, welch, 'csd(x, x) against welchPSD');
  });
});

// =============================================================================
// Item 8c: the sampleN count
// =============================================================================

describe('#968 item 8c: sampleN checks its count', () => {
  const bits = (v: number): string => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, v);
    return view.getBigUint64(0).toString(16).padStart(16, '0');
  };
  const normal = (): { sampleN: (n: number, o?: { seed?: number }) => Promise<Float64Array> } =>
    mt.normalDist(0, 1) as never;
  // The binomial distribution takes the local loop (`_sampleNDispatch(null, ...)`), the normal
  // distribution takes the worker route name: both go through the same check.
  const binomial = (): { sampleN: (n: number) => Promise<Float64Array> } =>
    mt.binomialDist(10, 0.5) as never;

  for (const [name, dist] of [
    ['normal', normal],
    ['binomial', binomial],
  ] as const) {
    it(`14: ${name}: a count that is not a non-negative integer rejects with a RangeError`, async () => {
      for (const n of [-1, 2.5, NaN, Infinity]) {
        await expect(dist().sampleN(n), `${name} sampleN(${n})`).rejects.toThrow(RangeError);
        await expect(dist().sampleN(n), `${name} sampleN(${n})`).rejects.toThrow(
          /non-negative integer/
        );
      }
    });

    it(`14: ${name}: a count above the allocation limit rejects before it allocates`, async () => {
      for (const n of [MAX_ALLOC_ELEMENTS + 1, 2 ** 40]) {
        await expect(dist().sampleN(n), `${name} sampleN(${n})`).rejects.toThrow(RangeError);
        await expect(dist().sampleN(n), `${name} sampleN(${n})`).rejects.toThrow(
          /result too large/
        );
      }
    });

    it(`14: ${name}: a count of 0 gives an empty array`, async () => {
      expect((await dist().sampleN(0)).length).toBe(0);
    });
  }

  it('14: a seeded batch keeps its values', async () => {
    const values = await normal().sampleN(3, { seed: 1 });
    expect(Array.from(values, bits)).toEqual([
      '3feee9426e082714',
      '3ff1f83c1a62aec5',
      'bfa93464f970a25c',
    ]);
    expect(Array.from(values)).toEqual([
      0.9659740590152261, 1.1231041937525543, -0.049227862786499016,
    ]);
  });
});

// =============================================================================
// Item 8d: the Bluestein plan cache
// =============================================================================

describe('#968 item 8d: the Bluestein chirp and its filter spectrum are cached', () => {
  type Cache = {
    bluesteinCacheState: () => {
      plans: { n: number; inverse: boolean; bytes: number }[];
      bytes: number;
    };
    setTwiddleCacheMaxBytes: (bytes: number) => void;
    TWIDDLE_CACHE_DEFAULT_MAX_BYTES: number;
    fftExactFloat64: (
      re: Float64Array,
      im: Float64Array,
      inverse?: boolean
    ) => { real: Float64Array; imag: Float64Array };
  };
  const core = fftCore as unknown as Cache;

  afterEach(() => {
    core.setTwiddleCacheMaxBytes(core.TWIDDLE_CACHE_DEFAULT_MAX_BYTES);
  });

  /** A deterministic input (a linear congruential sequence), the same for every call. */
  function input(n: number): { re: Float64Array; im: Float64Array } {
    let s = 12345;
    const next = (): number => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648 - 0.5;
    };
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = next();
      im[i] = next();
    }
    return { re, im };
  }
  const bitsOf = (a: Float64Array): string =>
    Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex');

  for (const n of [5, 6, 1000, 1001]) {
    for (const inverse of [false, true]) {
      it(`15: n = ${n}, ${inverse ? 'inverse' : 'forward'}: a cold and a warm cache give the same bits`, () => {
        const { re, im } = input(n);
        const keepRe = re.slice();
        const keepIm = im.slice();
        core.setTwiddleCacheMaxBytes(0);
        const cold = core.fftExactFloat64(re, im, inverse);
        core.setTwiddleCacheMaxBytes(core.TWIDDLE_CACHE_DEFAULT_MAX_BYTES);
        const first = core.fftExactFloat64(re, im, inverse);
        const planAfterFirst = core
          .bluesteinCacheState()
          .plans.filter((p) => p.n === n && p.inverse === inverse);
        const second = core.fftExactFloat64(re, im, inverse);
        expect(planAfterFirst.length).toBe(1);
        expect(bitsOf(first.real)).toBe(bitsOf(cold.real));
        expect(bitsOf(first.imag)).toBe(bitsOf(cold.imag));
        expect(bitsOf(second.real)).toBe(bitsOf(cold.real));
        expect(bitsOf(second.imag)).toBe(bitsOf(cold.imag));
        // The inputs, and a result that a caller changes, do not reach the cache.
        expect(bitsOf(re)).toBe(bitsOf(keepRe));
        expect(bitsOf(im)).toBe(bitsOf(keepIm));
        first.real.fill(0);
        first.imag.fill(0);
        const third = core.fftExactFloat64(re, im, inverse);
        expect(bitsOf(third.real)).toBe(bitsOf(cold.real));
      });
    }
  }

  it('15: a plan above the byte cap is not kept', () => {
    const n = 1000;
    const convLen = 2048;
    const planBytes = 8 * (2 * n + 2 * convLen);
    const { re, im } = input(n);
    core.setTwiddleCacheMaxBytes(0);
    core.setTwiddleCacheMaxBytes(planBytes - 1);
    core.fftExactFloat64(re, im, false);
    expect(core.bluesteinCacheState().plans.filter((p) => p.n === n).length).toBe(0);
    core.setTwiddleCacheMaxBytes(planBytes + 8 * convLen * 2);
    core.fftExactFloat64(re, im, false);
    const kept = core.bluesteinCacheState().plans.filter((p) => p.n === n);
    expect(kept.length).toBe(1);
    expect(kept[0].bytes).toBe(planBytes);
  });

  it('15: a cap of 0 empties the plan cache', () => {
    const { re, im } = input(6);
    core.fftExactFloat64(re, im, false);
    expect(core.bluesteinCacheState().plans.length).toBeGreaterThan(0);
    core.setTwiddleCacheMaxBytes(0);
    expect(core.bluesteinCacheState().plans.length).toBe(0);
    expect(core.bluesteinCacheState().bytes).toBe(0);
  });
});

// =============================================================================
// Items that were fixed before this change
// =============================================================================

describe('#968 pins for the items that are already fixed', () => {
  it('16 (item 2): mod broadcasts two Arrays', () => {
    expect(mt.mod([1, 2, 3], [[1], [2]])).toEqual([
      [0, 0, 0],
      [1, 0, 1],
    ]);
  });

  it('16 (item 3): mod with a sparse matrix gives a dense matrix when the first operand is not sparse', () => {
    const dense = [
      [5, 6],
      [7, 8],
    ];
    const sparse = [
      [2, 3],
      [4, 5],
    ];
    const a = mt.mod(mt.matrix(dense), mt.sparse(sparse));
    const b = mj.mod(mj.matrix(dense), mj.sparse(sparse));
    expect(kindOf(a)).toBe('Dense');
    expect(mathjsKindOf(b)).toBe('Dense');
    expect(plain(a)).toEqual(plain(b));
    const c = mt.mod(3, mt.sparse(sparse));
    const d = mj.mod(3, mj.sparse(sparse));
    expect(kindOf(c)).toBe(mathjsKindOf(d));
    expect(plain(c)).toEqual(plain(d));
  });

  it('16 (item 4): factory_mod keeps a 3-D array', () => {
    expect(
      mt.factory_mod(
        [
          [
            [5, 6],
            [7, 8],
          ],
        ],
        4
      )
    ).toEqual([
      [
        [1, 2],
        [3, 0],
      ],
    ]);
  });

  it('16 (item 7, number): a NaN derivative of a number state stops RK45 at once', () => {
    let calls = 0;
    const message = messageOf(() =>
      solve(
        () => {
          calls++;
          if (calls > 300) throw new Error('CAP');
          return [NaN];
        },
        [0, 1],
        [1],
        { method: 'RK45' }
      )
    );
    expect(message).toMatch(/not finite/);
    expect(calls).toBeLessThanOrEqual(5);
  });

  it('16 (item 8a): welchPSD of two samples throws instead of returning NaN', () => {
    expect(() => math.welchPSD([1, 2])).toThrow(/all zeros/);
  });
});
