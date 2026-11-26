/**
 * Compat-only mathjs 15.3.0 `schur`, `sylvester`, `lyap` and `solveODE` (#1553, #1584, G05).
 *
 * The critical libraries keep their own implementations: `matrixSchur` (Francis
 * double-shift QR) in `@danielsimonjr/mathts-matrix` and the scipy-style step
 * control in `functions/src/numeric/solveODE.ts`. This module is the thin
 * adapter layer that runs the mathjs 15.3.0 published algorithms on the compat
 * instance instead:
 *
 * - `schur` through mathjs's unshifted QR iteration (`qr`, then `R*Q`, until
 *   the L2 norm of the step drops to 1e-4). That loop is what produces the
 *   oracle's diagonal order (largest eigenvalue first for the 2x2 test matrix)
 *   and the subdiagonal residue the oracle leaves (`5.147e-118`), and it
 *   accepts BigNumber matrices because every step runs on the entries.
 * - `sylvester` / `lyap` through the activated factories
 *   (`functions/src/algebra/{sylvester,lyap}.ts`, ports of the mathjs
 *   factories) wired to that `schur`, so BigNumber matrices flow through.
 * - `solveODE` through a port of the mathjs adaptive Runge-Kutta factory,
 *   whose initial step is `(tEnd - tStart) / 1`.
 */

import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { typeOf as compatTypeOf } from '@danielsimonjr/mathts-core/internal';
import { isDenseMatrix, isSparseMatrix } from '@danielsimonjr/mathts-matrix';
import { createLyap, createSylvester } from './all-factories.js';

type NodeRequireFn = (id: string) => unknown;

function getMathjsNodeRequire(): NodeRequireFn {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  const nodeModule = proc?.getBuiltinModule?.('module') as
    { createRequire: (url: string | URL) => NodeRequireFn } | undefined;
  if (!nodeModule?.createRequire) {
    throw new TypeError('BigNumber schur requires Node.js with getBuiltinModule("module")');
  }
  return nodeModule.createRequire(import.meta.url);
}

let mathjsNodeRequire: NodeRequireFn | undefined;

function requireMathjsModule(id: string): unknown {
  if (!mathjsNodeRequire) mathjsNodeRequire = getMathjsNodeRequire();
  return mathjsNodeRequire(id);
}
type MathjsSchurNormScope = {
  matrix: (data: unknown) => unknown;
  bignumber: (x: string) => unknown;
  norm: (x: unknown) => unknown;
  larger: (a: unknown, b: unknown) => boolean;
};
let mathjsSchurNormScope: MathjsSchurNormScope | undefined;

/** mathjs 15.3.0 decimal.js `norm` for BigNumber schur convergence only (not bundled). */
function getMathjsSchurNormScope(): MathjsSchurNormScope {
  if (!mathjsSchurNormScope) {
    const { create, all } = requireMathjsModule('mathjs') as {
      create: (fns: unknown, config: unknown) => MathjsSchurNormScope;
      all: unknown;
    };
    mathjsSchurNormScope = create(all, { number: 'BigNumber', precision: 64 });
  }
  return mathjsSchurNormScope;
}

const factory = factory_mathjsCompat.factory;

type G05Fn = (...args: unknown[]) => unknown;
type CreateG05 = (scope: Record<string, unknown>) => G05Fn;

/** 1-D or 2-D raw array data, as a `DenseMatrix` stores it. */
type RawData = unknown[];

/** A mathjs-typed dispatch constructor, as the eigs port uses it. */
interface CompatTyped {
  (name: string, signatures: Record<string, (...args: never[]) => unknown>): G05Fn;
}

const compatTyped =
  mathFunctions.factory_mathjsCompat.createCompatTyped() as unknown as CompatTyped;

function toMathjsMatrix(data: RawData): unknown {
  const mj = getMathjsSchurNormScope();
  return mj.matrix(
    data.map((row: unknown) =>
      (row as unknown[]).map((cell: unknown) => mj.bignumber(String(cell)))
    )
  );
}

/** Numeric/comparison dependency surface, loosely typed over `unknown`. */
interface G05Deps {
  typed: CompatTyped;
  add: (...args: unknown[]) => unknown;
  subtract: (a: unknown, b: unknown) => unknown;
  multiply: (...args: unknown[]) => unknown;
  divide: (a: unknown, b: unknown) => unknown;
  max: (...args: unknown[]) => unknown;
  map: (x: unknown, callback: (value: unknown) => unknown) => unknown;
  abs: (x: unknown) => unknown;
  isPositive: (x: unknown) => boolean;
  isNegative: (x: unknown) => boolean;
  larger: (a: unknown, b: unknown) => boolean;
  smaller: (a: unknown, b: unknown) => boolean;
  matrix: (x: unknown) => unknown;
  bignumber: (x: unknown) => unknown;
  unaryMinus: (x: unknown) => unknown;
}

interface MatrixLike {
  toArray?(): unknown;
  valueOf?(): unknown;
  storage?(): string;
  _data?: unknown;
}

function isMatrixValue(x: unknown): x is MatrixLike {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x) as { isMatrix?: boolean } | null;
  return proto?.isMatrix === true;
}

function isSparseMatrixValue(x: unknown): boolean {
  return isMatrixValue(x) && typeof x.storage === 'function' && x.storage() === 'sparse';
}

const isBigNumber = mathFunctions.isBigNumber as (x: unknown) => boolean;

/** Flatten nested array data (one level of nesting for matrix rows). */
function flatEntries(data: RawData): unknown[] {
  const out: unknown[] = [];
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) {
      for (const v of x) walk(v);
    } else {
      out.push(x);
    }
  };
  walk(data);
  return out;
}

function hasBigNumberEntry(data: RawData): boolean {
  return flatEntries(data).some(isBigNumber);
}

const isComplex = mathFunctions.isComplex as (x: unknown) => boolean;

function hasComplexEntry(data: RawData): boolean {
  return flatEntries(data).some(isComplex);
}

/**
 * L2 norm of a square matrix step for the mathjs `schur` loop.
 * BigNumber steps delegate to mathjs 15.3.0 `norm` (decimal.js `eigs` + sort quirk).
 */
function schurStepContinues(delta: unknown): boolean {
  const data = matrixToRawData(delta);
  const stepNorm = schurStepNorm(delta);
  if (hasBigNumberEntry(data)) {
    return Boolean(getMathjsSchurNormScope().larger(stepNorm, 1e-4));
  }
  return (mathFunctions.larger as (a: unknown, b: unknown) => boolean)(stepNorm, 1e-4);
}

function schurStepNorm(delta: unknown): unknown {
  let data: RawData;
  if (Array.isArray(delta)) {
    data = delta;
  } else {
    const m = delta as MatrixLike;
    data = (m.toArray?.() ?? m.valueOf?.() ?? delta) as RawData;
  }
  if (!hasBigNumberEntry(data)) {
    return mathFunctions.norm(data);
  }
  return getMathjsSchurNormScope().norm(toMathjsMatrix(data));
}

/** The raw nested data of an Array or Matrix, as a `DenseMatrix` stores it. */
function rawData(x: unknown): RawData {
  const m = x as MatrixLike;
  if (Array.isArray(m._data)) return m._data;
  const converted = (typeof m.valueOf === 'function' ? m.valueOf() : m.toArray?.()) as unknown;
  if (Array.isArray(converted)) return converted;
  throw new TypeError('Unexpected type of argument in function schur (expected: Array or Matrix)');
}

/** `identity(n)` as raw arrays, with the mathjs `identity` argument error. */
function identityData(n: number): RawData[] {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('Parameters in function identity must be positive integers');
  }
  const rows: RawData[] = [];
  for (let i = 0; i < n; i++) {
    const row: RawData = new Array<unknown>(n).fill(0);
    row[i] = 1;
    rows.push(row);
  }
  return rows;
}

/**
 * Dense Householder QR on raw data (mathjs `_denseQRimpl`). The lower triangle
 * of `R` is flushed to scalar or Complex zero, matching the mathjs factory.
 */
function qrDense(data: RawData): { Q: RawData[]; R: RawData } {
  const rows = data.length;
  const cols = (data[0] as RawData | undefined)?.length as number | undefined;
  const Q = identityData(rows);
  const R: RawData = Array.isArray(data[0])
    ? (data as RawData[]).map((row) => (row as RawData).slice())
    : data.slice();
  const w: RawData = new Array<unknown>(rows).fill(0);
  const addScalar = mathFunctions.addScalar as (a: unknown, b: unknown) => unknown;
  const subtractScalar = mathFunctions.subtractScalar as (a: unknown, b: unknown) => unknown;
  const multiplyScalar = mathFunctions.multiplyScalar as (a: unknown, b: unknown) => unknown;
  const divideScalar = mathFunctions.divideScalar as (a: unknown, b: unknown) => unknown;
  const conj = mathFunctions.conj as (x: unknown) => unknown;
  const unaryMinus = mathFunctions.unaryMinus as (x: unknown) => unknown;
  const isZero = mathFunctions.isZero as (x: unknown) => boolean;
  const sign = mathFunctions.sign as (x: unknown) => unknown;
  const sqrt = mathFunctions.sqrt as (x: unknown) => unknown;

  const householderCols = cols === undefined ? Number.NaN : Math.min(cols, rows);
  for (let k = 0; k < householderCols; ++k) {
    const pivot = (R[k] as RawData)[k];
    const sgn = unaryMinus(isZero(pivot) ? 1 : sign(pivot));
    const conjSgn = conj(sgn);
    let alphaSquared: unknown = 0;
    for (let i = k; i < rows; i++) {
      alphaSquared = addScalar(
        alphaSquared,
        multiplyScalar((R[i] as RawData)[k], conj((R[i] as RawData)[k]))
      );
    }
    const alpha = multiplyScalar(sgn, sqrt(alphaSquared));
    if (!isZero(alpha)) {
      const u1 = subtractScalar(pivot, alpha);
      w[k] = 1;
      for (let i = k + 1; i < rows; i++) w[i] = divideScalar((R[i] as RawData)[k], u1);
      const tau = unaryMinus(conj(divideScalar(u1, alpha)));
      let s: unknown;
      for (let j = k; j < (cols as number); j++) {
        s = 0.0;
        for (let i = k; i < rows; i++) {
          s = addScalar(s, multiplyScalar(conj(w[i]), (R[i] as RawData)[j]));
        }
        s = multiplyScalar(s, tau);
        for (let i = k; i < rows; i++) {
          (R[i] as RawData)[j] = multiplyScalar(
            subtractScalar((R[i] as RawData)[j], multiplyScalar(w[i], s)),
            conjSgn
          );
        }
      }
      for (let i = 0; i < rows; i++) {
        s = 0.0;
        for (let j = k; j < rows; j++) s = addScalar(s, multiplyScalar(Q[i][j], w[j]));
        s = multiplyScalar(s, tau);
        for (let j = k; j < rows; ++j) {
          Q[i][j] = divideScalar(subtractScalar(Q[i][j], multiplyScalar(s, conj(w[j]))), conjSgn);
        }
      }
    }
  }

  if (data.length > 0) {
    const zero =
      ((R[0] as RawData)[0] as { type?: string }).type === 'Complex'
        ? (mathFunctions.complex as (re: number) => unknown)(0)
        : 0;
    for (let i = 0; i < R.length; ++i) {
      for (let j = 0; j < i && j < ((R[0] as RawData | undefined) ?? []).length; ++j) {
        (R[i] as RawData)[j] = zero;
      }
    }
  }
  return { Q, R };
}

function matrixToRawData(x: unknown): RawData {
  if (Array.isArray(x)) return x;
  const m = x as MatrixLike;
  return (m.toArray?.() ?? m.valueOf?.()) as RawData;
}

/** mathjs flushes near-exact integer imaginary parts on the Schur diagonal. */
function compactSchurDiagonal(T: RawData): void {
  const complexCtor = mathFunctions.complex as (re: number, im?: number) => unknown;
  const isComplex = mathFunctions.isComplex as (x: unknown) => boolean;
  for (let i = 0; i < T.length; i++) {
    const row = T[i] as RawData;
    const z = row[i];
    if (!isComplex(z)) continue;
    const { re, im } = z as { re: number; im: number };
    const snap = (v: number): number => (Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : v);
    const reN = snap(re);
    const imN = snap(im);
    if (reN !== re || imN !== im) {
      row[i] = complexCtor(reN, imN);
    }
  }
}

function schurArrays(data: RawData): { U: RawData; T: RawData } {
  if (!hasBigNumberEntry(data) && hasComplexEntry(data)) {
    const { create, all } = requireMathjsModule('mathjs') as {
      create: (
        fns: unknown,
        config: unknown
      ) => {
        complex: (re: number, im?: number) => unknown;
        matrix: (d: RawData) => { valueOf(): RawData };
        schur: (m: unknown) => { U: { valueOf(): RawData }; T: { valueOf(): RawData } };
      };
      all: unknown;
    };
    const mj = create(all, {});
    const mjData = data.map((row: unknown) =>
      (row as unknown[]).map((cell: unknown) => {
        if (isComplex(cell)) {
          const { re, im } = cell as { re: number; im: number };
          return mj.complex(re, im);
        }
        return cell;
      })
    );
    const r = mj.schur(mj.matrix(mjData));
    return { U: r.U.valueOf(), T: r.T.valueOf() };
  }
  const n = data.length;
  let U: RawData = identityData(n) as unknown as RawData;
  const multiply = mathFunctions.multiply as unknown as (...args: unknown[]) => RawData;
  const subtract = mathFunctions.subtract as (a: unknown, b: unknown) => unknown;
  let A: RawData = data;
  let k = 0;
  let A0: RawData;
  do {
    A0 = A;
    const qr = qrDense(A);
    A = multiply(qr.R, qr.Q);
    U = multiply(U, qr.Q);
    if (k++ > 100) break;
  } while (schurStepContinues(subtract(A, A0)));
  compactSchurDiagonal(A);
  return { U, T: A };
}

/**
 * True when an argument needs the native factory path: a public `DenseMatrix`
 * or `SparseMatrix` of `@danielsimonjr/mathts-matrix`, whose `size` is a
 * `{rows, cols}` record rather than a method. The native factories adapt those
 * at their boundary (dense in, dense out), and the mathjs ports in this module
 * keep that behavior by delegating instead of re-implementing it.
 */
function needsNativePath(x: unknown): boolean {
  return isDenseMatrix(x) || isSparseMatrix(x);
}

/** Schur decomposition with the mathjs 15.3.0 QR iteration (#1553, #1584). */
export const compatMathjsSchur: G05Fn = function schur(this: unknown, X?: unknown): unknown {
  if (arguments.length === 0) {
    throw new TypeError(
      'Too few arguments in function schur (expected: Array or Matrix, index: 0)'
    );
  }
  const isNativeDense = isDenseMatrix(X);
  const isNativeSparse = isSparseMatrix(X);
  if (!Array.isArray(X) && !isMatrixValue(X) && !isNativeDense && !isNativeSparse) {
    throw new TypeError(
      `Unexpected type of argument in function schur (expected: Array or Matrix, actual type provided: ${compatTypeOf(X)}, index: 0)`
    );
  }
  if (arguments.length > 1) {
    throw new TypeError(
      `Too many arguments in function schur (expected: Array or Matrix, actual: ${arguments.length})`
    );
  }
  if (isNativeDense) {
    const r = schurArrays((X as { toArray(): unknown }).toArray() as RawData);
    return { U: r.U, T: r.T };
  }
  if (isNativeSparse || isSparseMatrixValue(X)) {
    throw new Error('qr not implemented for sparse matrices yet');
  }
  if (Array.isArray(X)) {
    const r = schurArrays(X);
    return { U: r.U, T: r.T };
  }
  const r = schurArrays(rawData(X));
  return { U: mathFunctions.matrix(r.U), T: mathFunctions.matrix(r.T) };
};

/** `sylvester` factory wired to the compat schur (mathjs QR iteration). */
export const compatMathjsSylvester: G05Fn = function sylvester(
  this: unknown,
  ...args: unknown[]
): unknown {
  if (args.some(needsNativePath)) return mathFunctions.sylvester(...args);
  return compatSylvesterCore(...args);
};

const compatSylvesterCore: G05Fn = createSylvester({
  typed: compatTyped,
  schur: compatMathjsSchur,
  matrixFromColumns: mathFunctions.matrixFromColumns,
  matrix: mathFunctions.matrix,
  multiply: mathFunctions.multiply,
  range: mathFunctions.range,
  concat: mathFunctions.concat,
  transpose: mathFunctions.transpose,
  index: mathFunctions.index,
  subset: mathFunctions.subset,
  add: mathFunctions.add,
  subtract: mathFunctions.subtract,
  identity: mathFunctions.identity,
  lusolve: mathFunctions.lusolve,
  abs: mathFunctions.abs,
} as unknown as Parameters<typeof createSylvester>[0]) as G05Fn;

/** `lyap` factory wired to the compat sylvester. */
export const compatMathjsLyap: G05Fn = function lyap(this: unknown, ...args: unknown[]): unknown {
  if (args.some(needsNativePath)) return mathFunctions.lyap(...args);
  return compatLyapCore(...args);
};

const compatLyapCore: G05Fn = createLyap({
  typed: compatTyped,
  matrix: mathFunctions.matrix,
  sylvester: compatMathjsSylvester,
  multiply: mathFunctions.multiply,
  transpose: mathFunctions.transpose,
} as unknown as Parameters<typeof createLyap>[0]) as G05Fn;

interface ButcherTableau {
  a: unknown[];
  c: unknown[];
  b: unknown[];
  bp: unknown[];
}

/**
 * `solveODE` port of the mathjs 15.3.0 adaptive Runge-Kutta factory (#1584).
 * The initial step is `(tEnd - tStart) / 1` unless `firstStep` is given.
 */
const createMathjsSolveODE = /* #__PURE__ */ factory(
  'solveODE',
  [
    'typed',
    'add',
    'subtract',
    'multiply',
    'divide',
    'max',
    'map',
    'abs',
    'isPositive',
    'isNegative',
    'larger',
    'smaller',
    'matrix',
    'bignumber',
    'unaryMinus',
  ],
  (deps: Record<string, unknown>) => {
    const {
      typed,
      add,
      subtract,
      multiply,
      divide,
      max,
      map,
      abs,
      isPositive,
      isNegative,
      larger,
      smaller,
      matrix,
      bignumber,
      unaryMinus,
    } = deps as unknown as G05Deps;
    const isBigNumber = mathFunctions.isBigNumber as (x: unknown) => boolean;
    const isNumber = mathFunctions.isNumber as (x: unknown) => boolean;
    const isUnit = mathFunctions.isUnit as (x: unknown) => boolean;
    const isNumOrBig = (x: unknown): boolean => isBigNumber(x) || isNumber(x);

    function rk(butcherTableau: ButcherTableau): G05Fn {
      return function (this: unknown, ...args: unknown[]): { t: unknown[]; y: unknown[] } {
        const [fRaw, tspan, y0, options] = args as [
          G05Fn,
          unknown[],
          unknown[],
          Record<string, unknown>,
        ];
        const f = fRaw as (t: unknown, y: unknown) => unknown;
        const wrongTSpan = !(
          tspan.length === 2 &&
          (tspan.every(isNumOrBig) || tspan.every(isUnit))
        );
        if (wrongTSpan) {
          throw new Error(
            '"tspan" must be an Array of two numeric values or two units [tStart, tEnd]'
          );
        }
        const t0 = tspan[0];
        const tf = tspan[1];
        const isForwards = larger(tf, t0);
        const firstStep = options.firstStep;
        if (firstStep !== undefined && !isPositive(firstStep)) {
          throw new Error('"firstStep" must be positive');
        }
        const maxStep = options.maxStep;
        if (maxStep !== undefined && !isPositive(maxStep)) {
          throw new Error('"maxStep" must be positive');
        }
        const minStep = options.minStep;
        if (minStep && isNegative(minStep)) {
          throw new Error('"minStep" must be positive or zero');
        }
        const timeVars = [t0, tf, firstStep, minStep, maxStep].filter((x) => x !== undefined);
        if (!(timeVars.every(isNumOrBig) || timeVars.every(isUnit))) {
          throw new Error('Inconsistent type of "t" dependant variables');
        }
        const tol = options.tol ? options.tol : 1e-4;
        const minDelta = options.minDelta ? options.minDelta : 0.2;
        const maxDelta = options.maxDelta ? options.maxDelta : 5;
        const maxIter = options.maxIter ? options.maxIter : 10000;
        const hasBigNumbers = [t0, tf, ...y0, maxStep, minStep].some(isBigNumber);
        const tableau: ButcherTableau = hasBigNumbers
          ? {
              a: bignumber(butcherTableau.a) as unknown[],
              c: bignumber(butcherTableau.c) as unknown[],
              b: bignumber(butcherTableau.b) as unknown[],
              bp: bignumber(butcherTableau.bp) as unknown[],
            }
          : butcherTableau;
        let h: unknown = firstStep
          ? isForwards
            ? firstStep
            : unaryMinus(firstStep)
          : divide(subtract(tf, t0), 1);
        const t: unknown[] = [t0];
        const y: unknown[] = [y0];
        const deltaB = subtract(tableau.b, tableau.bp);
        let n = 0;
        let iter = 0;
        const ongoing = isForwards ? smaller : larger;
        const trimStep = (time: unknown, tfValue: unknown, step: unknown): unknown => {
          const outOfBounds = isForwards ? larger : smaller;
          const next = add(time, step);
          return outOfBounds(next, tfValue) ? subtract(tfValue, time) : step;
        };
        while (ongoing(t[n], tf)) {
          const k: unknown[] = [];
          h = trimStep(t[n], tf, h);
          k.push(f(t[n], y[n]));
          for (let i = 1; i < tableau.c.length; ++i) {
            k.push(
              f(add(t[n], multiply(tableau.c[i], h)), add(y[n], multiply(h, tableau.a[i], k)))
            );
          }
          const TE = max(
            abs(
              map(multiply(deltaB, k), (x: unknown) =>
                isUnit(x) ? (x as { value: unknown }).value : x
              )
            )
          );
          if ((TE as number) < (tol as number) && (tol as number) / (TE as number) > 1 / 4) {
            t.push(add(t[n], h));
            y.push(add(y[n], multiply(h, tableau.b, k)));
            n++;
          }
          let delta: unknown = 0.84 * ((tol as number) / (TE as number)) ** (1 / 5);
          if (smaller(delta, minDelta)) {
            delta = minDelta;
          } else if (larger(delta, maxDelta)) {
            delta = maxDelta;
          }
          delta = hasBigNumbers ? bignumber(delta) : delta;
          h = multiply(h, delta);
          if (maxStep && larger(abs(h), maxStep)) {
            h = isForwards ? maxStep : unaryMinus(maxStep);
          } else if (minStep && smaller(abs(h), minStep)) {
            h = isForwards ? minStep : unaryMinus(minStep);
          }
          iter++;
          if ((iter as number) > (maxIter as number)) {
            throw new Error('Maximum number of iterations reached, try changing options');
          }
        }
        return { t, y };
      };
    }

    function rk23(f: unknown, tspan: unknown[], y0: unknown[], options: unknown): unknown {
      const butcherTableau: ButcherTableau = {
        a: [[], [1 / 2], [0, 3 / 4], [2 / 9, 1 / 3, 4 / 9]],
        c: [null, 1 / 2, 3 / 4, 1],
        b: [2 / 9, 1 / 3, 4 / 9, 0],
        bp: [7 / 24, 1 / 4, 1 / 3, 1 / 8],
      };
      return rk(butcherTableau)(f, tspan, y0, options);
    }

    function rk45(f: unknown, tspan: unknown[], y0: unknown[], options: unknown): unknown {
      const butcherTableau: ButcherTableau = {
        a: [
          [],
          [1 / 5],
          [3 / 40, 9 / 40],
          [44 / 45, -56 / 15, 32 / 9],
          [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
          [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
          [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
        ],
        c: [null, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
        b: [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
        bp: [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40],
      };
      return rk(butcherTableau)(f, tspan, y0, options);
    }

    function solveODE(
      f: unknown,
      tspan: unknown[],
      y0: unknown[],
      opt: Record<string, unknown>
    ): { t: unknown[]; y: unknown[] } {
      const method = opt.method ? opt.method : 'RK45';
      const methods: Record<string, typeof rk23> = { RK23: rk23, RK45: rk45 };
      if (typeof method === 'string' && method.toUpperCase() in methods) {
        const methodOptions = { ...opt };
        delete methodOptions.method;
        return methods[method.toUpperCase()](f, tspan, y0, methodOptions) as {
          t: unknown[];
          y: unknown[];
        };
      }
      const methodsWithQuotes = Object.keys(methods).map((x) => `"${x}"`);
      const availableMethodsString = `${methodsWithQuotes.slice(0, -1).join(', ')} and ${
        methodsWithQuotes.slice(-1)[0]
      }`;
      throw new Error(
        `Unavailable method "${String(method)}". Available methods are ${availableMethodsString}`
      );
    }

    function matrixSolveODE(
      f: unknown,
      T: MatrixLike,
      y0: MatrixLike,
      options: Record<string, unknown>
    ): { t: unknown; y: unknown } {
      const sol = solveODE(f, T.toArray?.() as unknown[], y0.toArray?.() as unknown[], options);
      return { t: matrix(sol.t), y: matrix(sol.y) };
    }

    const firstOfEach = (values: unknown[]): unknown[] => (values as unknown[][]).map((Y) => Y[0]);

    return typed('solveODE', {
      'function, Array, Array, Object': (
        f: unknown,
        tspan: unknown[],
        y0: unknown[],
        options: Record<string, unknown>
      ) => solveODE(f, tspan, y0, options),
      'function, Matrix, Matrix, Object': matrixSolveODE,
      'function, Array, Array': (f: unknown, T: unknown[], y0: unknown[]) => solveODE(f, T, y0, {}),
      'function, Matrix, Matrix': (f: unknown, T: MatrixLike, y0: MatrixLike) =>
        matrixSolveODE(f, T, y0, {}),
      'function, Array, number | BigNumber | Unit': (f: unknown, T: unknown[], y0: unknown) => {
        const sol = solveODE(f, T, [y0], {});
        return { t: sol.t, y: firstOfEach(sol.y) };
      },
      'function, Matrix, number | BigNumber | Unit': (f: unknown, T: MatrixLike, y0: unknown) => {
        const sol = solveODE(f, T.toArray?.() as unknown[], [y0], {});
        return { t: matrix(sol.t), y: matrix(firstOfEach(sol.y)) };
      },
      'function, Array, number | BigNumber | Unit, Object': (
        f: unknown,
        T: unknown[],
        y0: unknown,
        options: Record<string, unknown>
      ) => {
        const sol = solveODE(f, T, [y0], options);
        return { t: sol.t, y: firstOfEach(sol.y) };
      },
      'function, Matrix, number | BigNumber | Unit, Object': (
        f: unknown,
        T: MatrixLike,
        y0: unknown,
        options: Record<string, unknown>
      ) => {
        const sol = solveODE(f, T.toArray?.() as unknown[], [y0], options);
        return { t: matrix(sol.t), y: matrix(firstOfEach(sol.y)) };
      },
    }) as G05Fn;
  }
) as CreateG05;

export const compatMathjsSolveODE: G05Fn = createMathjsSolveODE({
  ...mathFunctions,
  typed: compatTyped,
} as Record<string, unknown>);
