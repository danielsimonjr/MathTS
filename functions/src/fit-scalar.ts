/**
 * Nonlinear fitting of {@link ScalarNode} parameters to columnar data.
 *
 * Reuses {@link compileScalarGradient}, {@link levenbergMarquardt}, {@link bfgs},
 * and {@link nelderMead}; loss sums use core {@link pairwiseSum} / {@link pairwiseDot}.
 *
 * @packageDocumentation
 */

import { pairwiseDot, pairwiseSum, type SeededRng } from '@danielsimonjr/mathts-core';
import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { bfgs } from './numeric/bfgs.js';
import { nelderMead, levenbergMarquardt } from './optimization-extra.js';
import { compileScalarGradient } from './scalar-compile.js';
import { inv as _invRaw } from './factories/index.js';

const _inv = _invRaw as unknown as (m: number[][]) => number[][];

const INVALID_ROW_PENALTY = 1e8;
const HUBER_DELTA = 1;

function prefix(msg: string): string {
  return `fitScalarParameters: ${msg}`;
}

/** Options for {@link fitScalarParameters}. */
export interface FitScalarOptions {
  readonly parameters: readonly string[];
  readonly initial?: ArrayLike<number>;
  readonly loss?: 'l2' | 'l1' | 'huber' | ((pred: number, obs: number, w: number) => number);
  readonly weights?: Float64Array;
  readonly algorithm?: 'lm' | 'bfgs' | 'nelder-mead';
  readonly restarts?: number;
  readonly maxIterations?: number;
  readonly bounds?: readonly (readonly [number, number])[];
  readonly rng?: SeededRng;
}

/** Result of {@link fitScalarParameters}. */
export interface FitScalarResult {
  readonly parameters: Float64Array;
  readonly loss: number;
  readonly converged: boolean;
  readonly evaluations: number;
  readonly validRows: number;
  readonly standardErrors: Float64Array | null;
}

function isFiniteBound(v: number): boolean {
  return Number.isFinite(v);
}

function isFixedBound(lo: number, hi: number): boolean {
  return isFiniteBound(lo) && isFiniteBound(hi) && lo === hi;
}

function nudgeInterior(x: number, lo: number, hi: number): number {
  const eps = Math.max(1e-8, 1e-8 * Math.abs(hi - lo));
  if (isFiniteBound(lo) && isFiniteBound(hi)) {
    return Math.min(hi - eps, Math.max(lo + eps, x));
  }
  if (isFiniteBound(lo) && !isFiniteBound(hi)) {
    return Math.max(lo + eps, x);
  }
  if (!isFiniteBound(lo) && isFiniteBound(hi)) {
    return Math.min(hi - eps, x);
  }
  return x;
}

function xToZ(x: number, lo: number, hi: number): number {
  if (isFiniteBound(lo) && isFiniteBound(hi)) {
    const t = (x - lo) / (hi - lo);
    const clamped = Math.min(1 - 1e-15, Math.max(1e-15, t));
    return Math.log(clamped / (1 - clamped));
  }
  if (isFiniteBound(lo) && !isFiniteBound(hi)) {
    return Math.log(Math.max(x - lo, 1e-300));
  }
  if (!isFiniteBound(lo) && isFiniteBound(hi)) {
    return Math.log(Math.max(hi - x, 1e-300));
  }
  return x;
}

function zToX(z: number, lo: number, hi: number): number {
  if (isFiniteBound(lo) && isFiniteBound(hi)) {
    const s = 1 / (1 + Math.exp(-z));
    return lo + (hi - lo) * s;
  }
  if (isFiniteBound(lo) && !isFiniteBound(hi)) {
    return lo + Math.exp(z);
  }
  if (!isFiniteBound(lo) && isFiniteBound(hi)) {
    return hi - Math.exp(z);
  }
  return z;
}

function dxDz(_x: number, z: number, lo: number, hi: number): number {
  if (isFiniteBound(lo) && isFiniteBound(hi)) {
    const ez = Math.exp(-z);
    const denom = (1 + ez) ** 2;
    return ((hi - lo) * ez) / denom;
  }
  if (isFiniteBound(lo) && !isFiniteBound(hi)) {
    return Math.exp(z);
  }
  if (!isFiniteBound(lo) && isFiniteBound(hi)) {
    return -Math.exp(z);
  }
  return 1;
}

function paramsKey(x: readonly number[]): string {
  return x.join('\x1f');
}

/**
 * Fit free parameters of a scalar expression to observed data.
 *
 * @example
 * ```ts
 * import { fitScalarParameters, scalar } from '@danielsimonjr/mathts-functions';
 * const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
 * const x = new Float64Array([1, 2, 3]);
 * const y = new Float64Array([2, 4, 6]);
 * const { parameters } = fitScalarParameters(node, [x], y, ['x'], {
 *   parameters: ['a'],
 *   restarts: 0,
 * });
 * parameters[0]; // 2
 * ```
 */
export function fitScalarParameters(
  node: ScalarNode,
  columns: readonly Float64Array[],
  observed: Float64Array,
  variables: readonly string[],
  options: FitScalarOptions
): FitScalarResult {
  const paramNames = options.parameters;
  const p = paramNames.length;
  const lossOpt = options.loss ?? 'l2';
  const customLoss = typeof lossOpt === 'function' ? lossOpt : null;
  const lossTag: 'l2' | 'l1' | 'huber' | 'custom' = customLoss
    ? 'custom'
    : (lossOpt as 'l2' | 'l1' | 'huber');

  if (lossTag !== 'l2' && lossTag !== 'l1' && lossTag !== 'huber' && lossTag !== 'custom') {
    throw new RangeError(prefix(`unknown loss '${String(lossOpt)}'`));
  }

  const algorithm = options.algorithm ?? (lossTag === 'l2' ? 'lm' : 'bfgs');

  if (algorithm !== 'lm' && algorithm !== 'bfgs' && algorithm !== 'nelder-mead') {
    throw new RangeError(prefix(`unknown algorithm '${String(options.algorithm)}'`));
  }
  if (lossTag !== 'l2' && algorithm === 'lm') {
    throw new RangeError(prefix("'lm' is only valid for loss 'l2'"));
  }

  const restartsRaw = options.restarts ?? 2;
  if (!Number.isInteger(restartsRaw) || restartsRaw < 0) {
    throw new RangeError(prefix('restarts must be a non-negative integer'));
  }
  const restarts = restartsRaw;
  if (restarts > 0 && options.rng === undefined) {
    throw new TypeError(prefix('rng is required when restarts > 0'));
  }
  const rng = options.rng;

  if (!(observed instanceof Float64Array)) {
    throw new RangeError(prefix('observed must be a Float64Array'));
  }
  const n = observed.length;
  if (options.weights !== undefined && !(options.weights instanceof Float64Array)) {
    throw new RangeError(prefix('weights must be a Float64Array when provided'));
  }
  if (options.weights !== undefined && options.weights.length !== n) {
    throw new RangeError(prefix('weights length must match observed length'));
  }
  const weights = options.weights;
  if (weights !== undefined) {
    for (let i = 0; i < n; i++) {
      const w = weights[i];
      if (!Number.isFinite(w) || w < 0) {
        throw new RangeError(prefix('weights must be finite and non-negative'));
      }
    }
  }

  if (options.initial !== undefined && options.initial.length !== p) {
    throw new RangeError(prefix('initial length must match parameters length'));
  }
  if (options.bounds !== undefined && options.bounds.length !== p) {
    throw new RangeError(prefix('bounds length must match parameters length'));
  }

  const boundsLo: number[] = new Array(p);
  const boundsHi: number[] = new Array(p);
  const fixed: boolean[] = new Array(p);
  for (let i = 0; i < p; i++) {
    if (options.bounds === undefined) {
      boundsLo[i] = Number.NEGATIVE_INFINITY;
      boundsHi[i] = Number.POSITIVE_INFINITY;
      fixed[i] = false;
    } else {
      const [lo, hi] = options.bounds[i];
      if (!isFiniteBound(lo) && lo !== Number.NEGATIVE_INFINITY) {
        throw new RangeError(prefix('bounds endpoints must be finite or ±Infinity'));
      }
      if (!isFiniteBound(hi) && hi !== Number.POSITIVE_INFINITY) {
        throw new RangeError(prefix('bounds endpoints must be finite or ±Infinity'));
      }
      if (isFiniteBound(lo) && isFiniteBound(hi) && lo > hi) {
        throw new RangeError(prefix('bounds lo must not exceed hi'));
      }
      boundsLo[i] = lo;
      boundsHi[i] = hi;
      fixed[i] = isFixedBound(lo, hi);
    }
  }

  const xBase = new Float64Array(p);
  for (let i = 0; i < p; i++) {
    const v = options.initial !== undefined ? Number(options.initial[i]) : 1;
    if (!Number.isFinite(v)) {
      throw new RangeError(prefix('initial values must be finite'));
    }
    xBase[i] = v;
  }

  for (let i = 0; i < p; i++) {
    if (fixed[i]) {
      xBase[i] = boundsLo[i];
    } else if (options.bounds !== undefined) {
      xBase[i] = nudgeInterior(xBase[i], boundsLo[i], boundsHi[i]);
    }
  }

  const compiled = compileScalarGradient(node, {
    variables,
    parameters: paramNames,
  });

  const valuesBuf = new Float64Array(n);
  const gradBuf = new Float64Array(n * p);
  let evaluations = 0;
  const cache = new Map<string, { values: Float64Array; grad: Float64Array; valid: Uint8Array }>();

  function evaluateAt(x: ArrayLike<number>): {
    values: Float64Array;
    grad: Float64Array;
    valid: Uint8Array;
  } {
    const key = paramsKey(Array.from(x));
    const hit = cache.get(key);
    if (hit) {
      return hit;
    }
    evaluations++;
    const batch = compiled.evaluate(columns, x, { values: valuesBuf, grad: gradBuf });
    const stored = {
      values: Float64Array.from(batch.values),
      grad: Float64Array.from(batch.grad),
      valid: Uint8Array.from(batch.valid),
    };
    cache.set(key, stored);
    return stored;
  }

  function rowIncluded(
    row: number,
    batch: { values: Float64Array; valid: Uint8Array },
    atFreeze: boolean,
    frozenValid: boolean
  ): boolean {
    if (!atFreeze) {
      return frozenValid;
    }
    if (batch.valid[row] !== 1) {
      return false;
    }
    const pred = batch.values[row];
    if (!Number.isFinite(pred)) {
      return false;
    }
    const obs = observed[row];
    if (!Number.isFinite(obs)) {
      return false;
    }
    if (weights !== undefined) {
      const w = weights[row];
      if (!Number.isFinite(w)) {
        throw new RangeError(prefix('weights must be finite'));
      }
      if (w < 0) {
        throw new RangeError(prefix('weights must be non-negative'));
      }
      if (w === 0) {
        return false;
      }
    }
    return true;
  }

  const freezeBatch = evaluateAt(xBase);
  const frozenRows: number[] = [];
  for (let i = 0; i < n; i++) {
    if (rowIncluded(i, freezeBatch, true, true)) {
      frozenRows.push(i);
    }
  }
  const m = frozenRows.length;
  if (m === 0) {
    throw new RangeError(prefix('no valid rows to fit'));
  }

  const freeIdx: number[] = [];
  for (let i = 0; i < p; i++) {
    if (!fixed[i]) {
      freeIdx.push(i);
    }
  }
  const pFree = freeIdx.length;

  if (p === 0) {
    const loss = computeLoss(lossTag, customLoss, freezeBatch, frozenRows, weights, true);
    return {
      parameters: new Float64Array(0),
      loss,
      converged: true,
      evaluations,
      validRows: m,
      standardErrors: null,
    };
  }

  if (pFree === 0) {
    const loss = computeLoss(lossTag, customLoss, freezeBatch, frozenRows, weights, true);
    const se = lossTag === 'l2' && m >= 1 ? new Float64Array(p) : null;
    return {
      parameters: Float64Array.from(xBase),
      loss,
      converged: true,
      evaluations,
      validRows: m,
      standardErrors: se,
    };
  }

  function rowActive(row: number, batch: { values: Float64Array; valid: Uint8Array }): boolean {
    if (batch.valid[row] !== 1) {
      return false;
    }
    const pred = batch.values[row];
    return Number.isFinite(pred);
  }

  function sqrtW(row: number): number {
    return weights === undefined ? 1 : Math.sqrt(weights[row]);
  }

  function wAt(row: number): number {
    return weights === undefined ? 1 : weights[row];
  }

  function computeLoss(
    tag: 'l2' | 'l1' | 'huber' | 'custom',
    custom: ((pred: number, obs: number, w: number) => number) | null,
    batch: { values: Float64Array; valid: Uint8Array },
    rows: number[],
    wts: Float64Array | undefined,
    strictFreeze: boolean
  ): number {
    const terms: number[] = [];
    for (const row of rows) {
      if (!rowActive(row, batch)) {
        if (strictFreeze) {
          continue;
        }
        return Number.POSITIVE_INFINITY;
      }
      const pred = batch.values[row];
      const obs = observed[row];
      const w = wts === undefined ? 1 : wts[row];
      if (tag === 'l2') {
        const r = sqrtW(row) * (pred - obs);
        terms.push(r * r);
      } else if (tag === 'l1') {
        terms.push(w * Math.abs(pred - obs));
      } else if (tag === 'huber') {
        const a = pred - obs;
        const abs = Math.abs(a);
        const rho = abs <= HUBER_DELTA ? a * a : 2 * abs - 1;
        terms.push(w * rho);
      } else if (custom) {
        const t = custom(pred, obs, w);
        if (!Number.isFinite(t)) {
          throw new RangeError(prefix('custom loss returned a non-finite value'));
        }
        terms.push(t);
      }
    }
    if (terms.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return pairwiseSum(terms);
  }

  type EvalBatch = { values: Float64Array; grad: Float64Array; valid: Uint8Array };

  function buildLmResiduals(batch: EvalBatch): number[] {
    const r = new Array<number>(m);
    for (let j = 0; j < m; j++) {
      const row = frozenRows[j];
      if (!rowActive(row, batch)) {
        r[j] = INVALID_ROW_PENALTY;
      } else {
        const pred = batch.values[row];
        r[j] = sqrtW(row) * (pred - observed[row]);
      }
    }
    return r;
  }

  function buildJacobianColumns(
    x: number[],
    batch: EvalBatch,
    inZ: boolean,
    zVec: number[] | null
  ): number[][] {
    const cols: number[][] = freeIdx.map(() => new Array<number>(m).fill(0));
    for (let j = 0; j < m; j++) {
      const row = frozenRows[j];
      if (!rowActive(row, batch)) {
        continue;
      }
      const sw = sqrtW(row);
      for (let fi = 0; fi < freeIdx.length; fi++) {
        const pi = freeIdx[fi];
        const dPred = batch.grad[row * p + pi];
        let dX = sw * dPred;
        if (inZ && zVec) {
          dX *= dxDz(x[pi], zVec[fi], boundsLo[pi], boundsHi[pi]);
        }
        cols[fi][j] = dX;
      }
    }
    return cols;
  }

  function jacobianMatrix(cols: number[][]): number[][] {
    const J: number[][] = new Array(m);
    for (let i = 0; i < m; i++) {
      J[i] = cols.map((col) => col[i]);
    }
    return J;
  }

  function gradL2(x: number[], batch: EvalBatch): number[] {
    const rVec = new Array<number>(m);
    for (let j = 0; j < m; j++) {
      const row = frozenRows[j];
      if (!rowActive(row, batch)) {
        return freeIdx.map(() => Number.POSITIVE_INFINITY);
      }
      const pred = batch.values[row];
      rVec[j] = sqrtW(row) * (pred - observed[row]);
    }
    const cols = buildJacobianColumns(x, batch, false, null);
    return cols.map((col) => 2 * pairwiseDot(rVec, col));
  }

  function gradL1(_x: number[], batch: EvalBatch): number[] {
    const g = new Array<number>(freeIdx.length).fill(0);
    for (let fi = 0; fi < freeIdx.length; fi++) {
      const pi = freeIdx[fi];
      const terms: number[] = [];
      for (const row of frozenRows) {
        if (!rowActive(row, batch)) {
          return freeIdx.map(() => Number.POSITIVE_INFINITY);
        }
        const pred = batch.values[row];
        const diff = pred - observed[row];
        const s = diff === 0 ? 0 : Math.sign(diff);
        const w = wAt(row);
        terms.push(w * s * batch.grad[row * p + pi]);
      }
      g[fi] = pairwiseSum(terms);
    }
    return g;
  }

  function gradHuber(_x: number[], batch: EvalBatch): number[] {
    const g = new Array<number>(freeIdx.length).fill(0);
    for (let fi = 0; fi < freeIdx.length; fi++) {
      const pi = freeIdx[fi];
      const terms: number[] = [];
      for (const row of frozenRows) {
        if (!rowActive(row, batch)) {
          return freeIdx.map(() => Number.POSITIVE_INFINITY);
        }
        const pred = batch.values[row];
        const a = pred - observed[row];
        const psi = 2 * Math.max(-1, Math.min(1, a));
        const w = wAt(row);
        terms.push(w * psi * batch.grad[row * p + pi]);
      }
      g[fi] = pairwiseSum(terms);
    }
    return g;
  }

  function xFromFreeZ(z: number[]): Float64Array {
    const x = Float64Array.from(xBase);
    for (let fi = 0; fi < freeIdx.length; fi++) {
      const pi = freeIdx[fi];
      x[pi] = zToX(z[fi], boundsLo[pi], boundsHi[pi]);
    }
    return x;
  }

  function perturbStart(base: Float64Array, attempt: number): Float64Array {
    if (attempt === 0) {
      return Float64Array.from(base);
    }
    const out = Float64Array.from(base);
    for (const pi of freeIdx) {
      const initial = base[pi];
      const sign = rng!.next() < 0.5 ? -1 : 1;
      const mag = Math.exp((rng!.next() * 2 - 1) * Math.LN10);
      const scale = initial === 0 ? 1 : Math.abs(initial);
      out[pi] = sign * mag * scale;
      if (!fixed[pi] && options.bounds !== undefined) {
        out[pi] = nudgeInterior(out[pi], boundsLo[pi], boundsHi[pi]);
      }
    }
    return out;
  }

  function runAttempt(startX: Float64Array): {
    x: Float64Array;
    loss: number;
    converged: boolean;
  } {
    const maxIter = options.maxIterations;

    if (maxIter === 0) {
      const batch = evaluateAt(startX);
      const loss = computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
      return { x: startX, loss, converged: false };
    }

    if (algorithm === 'bfgs') {
      const bfgsBounds: [number, number][] = [];
      for (let i = 0; i < p; i++) {
        const lo = boundsLo[i];
        const hi = boundsHi[i];
        bfgsBounds.push([
          isFiniteBound(lo) ? lo : Number.NEGATIVE_INFINITY,
          isFiniteBound(hi) ? hi : Number.POSITIVE_INFINITY,
        ]);
      }
      const x0 = Array.from(startX);
      const objective = (xv: number[]) => {
        const batch = evaluateAt(xv);
        return computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
      };
      const gradFn =
        lossTag === 'l2'
          ? (xv: number[]) => {
              const batch = evaluateAt(xv);
              const gFree = gradL2(xv, batch);
              const gFull = new Array<number>(p).fill(0);
              for (let fi = 0; fi < freeIdx.length; fi++) {
                gFull[freeIdx[fi]] = gFree[fi];
              }
              return gFull;
            }
          : lossTag === 'l1'
            ? (xv: number[]) => {
                const batch = evaluateAt(xv);
                const gFree = gradL1(xv, batch);
                const gFull = new Array<number>(p).fill(0);
                for (let fi = 0; fi < freeIdx.length; fi++) {
                  gFull[freeIdx[fi]] = gFree[fi];
                }
                return gFull;
              }
            : lossTag === 'huber'
              ? (xv: number[]) => {
                  const batch = evaluateAt(xv);
                  const gFree = gradHuber(xv, batch);
                  const gFull = new Array<number>(p).fill(0);
                  for (let fi = 0; fi < freeIdx.length; fi++) {
                    gFull[freeIdx[fi]] = gFree[fi];
                  }
                  return gFull;
                }
              : undefined;

      const opts: {
        maxIter?: number;
        bounds?: [number, number][];
        grad?: (x: number[]) => number[];
      } = { bounds: bfgsBounds };
      if (maxIter !== undefined) {
        opts.maxIter = maxIter;
      }
      if (gradFn) {
        opts.grad = gradFn;
      }
      const res = bfgs(objective, x0, opts);
      const xOut = Float64Array.from(res.x);
      const batch = evaluateAt(xOut);
      const loss = computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
      return { x: xOut, loss, converged: res.converged };
    }

    if (algorithm === 'lm') {
      const z0 = freeIdx.map((pi) => xToZ(startX[pi], boundsLo[pi], boundsHi[pi]));
      const residual = (z: number[]) => {
        const xFull = xFromFreeZ(z);
        const batch = evaluateAt(xFull);
        return buildLmResiduals(batch);
      };
      const jac = (z: number[]) => {
        const xFull = xFromFreeZ(z);
        const batch = evaluateAt(xFull);
        const cols = buildJacobianColumns(Array.from(xFull), batch, true, z);
        return jacobianMatrix(cols);
      };
      const lmOpts: {
        maxIter?: number;
        tol?: number;
        jacobian: (z: number[]) => number[][];
      } = {
        jacobian: jac,
        tol: 1e-14,
      };
      if (maxIter !== undefined) {
        lmOpts.maxIter = maxIter;
      }
      const lmRes = levenbergMarquardt(residual, z0, lmOpts);
      let zBest = lmRes.x;
      for (let polish = 0; polish < 32; polish++) {
        const rVec = residual(zBest);
        const J = jac(zBest);
        const nZ = zBest.length;
        const JtJ: number[][] = Array.from({ length: nZ }, () => new Array<number>(nZ).fill(0));
        const Jtr = new Array<number>(nZ).fill(0);
        for (let a = 0; a < nZ; a++) {
          for (let b = 0; b < nZ; b++) {
            let s = 0;
            for (let i = 0; i < rVec.length; i++) {
              s += J[i][a] * J[i][b];
            }
            JtJ[a][b] = s;
          }
          let sr = 0;
          for (let i = 0; i < rVec.length; i++) {
            sr += J[i][a] * rVec[i];
          }
          Jtr[a] = sr;
        }
        let delta: number[];
        try {
          const JtJinv = _inv(JtJ);
          delta = JtJinv.map((row) => row.reduce((s, v, k) => s - v * Jtr[k], 0));
        } catch {
          break;
        }
        let stepNorm = 0;
        for (let i = 0; i < nZ; i++) {
          stepNorm += delta[i] * delta[i];
        }
        zBest = zBest.map((v, i) => v + delta[i]);
        if (stepNorm === 0) {
          break;
        }
      }
      const xOut = xFromFreeZ(zBest);
      const batch = evaluateAt(xOut);
      const loss = computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
      return { x: xOut, loss, converged: lmRes.converged };
    }

    // nelder-mead
    const z0 = freeIdx.map((pi) => xToZ(startX[pi], boundsLo[pi], boundsHi[pi]));
    const objective = (z: number[]) => {
      const xFull = xFromFreeZ(z);
      const batch = evaluateAt(xFull);
      return computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
    };
    const nmOpts: { maxIter?: number; step?: number } = { step: 0.5 };
    if (maxIter !== undefined) {
      nmOpts.maxIter = maxIter;
    }
    const res = nelderMead(objective, z0, nmOpts);
    const xOut = xFromFreeZ(res.x);
    const batch = evaluateAt(xOut);
    const loss = computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
    return { x: xOut, loss, converged: res.converged };
  }

  let bestX = Float64Array.from(xBase);
  let bestLoss = computeLoss(lossTag, customLoss, freezeBatch, frozenRows, weights, true);
  let bestConverged = pFree === 0;
  const attempts = restarts + 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const start = perturbStart(xBase, attempt);
    const { x, loss, converged } = runAttempt(start);
    if (Number.isFinite(loss) && loss < bestLoss) {
      bestLoss = loss;
      bestX = Float64Array.from(x);
      bestConverged = converged;
    }
  }

  if (!Number.isFinite(bestLoss)) {
    const batch = evaluateAt(bestX);
    bestLoss = computeLoss(lossTag, customLoss, batch, frozenRows, weights, false);
  }

  if (lossTag === 'l2' && pFree > 0 && algorithm === 'lm') {
    let xRef = Float64Array.from(bestX);
    for (let refine = 0; refine < 24; refine++) {
      const batch = evaluateAt(xRef);
      const rVec = new Array<number>(m);
      let allZero = true;
      for (let j = 0; j < m; j++) {
        const row = frozenRows[j];
        if (!rowActive(row, batch)) {
          allZero = false;
          break;
        }
        const pred = batch.values[row];
        rVec[j] = sqrtW(row) * (pred - observed[row]);
        if (rVec[j] !== 0) {
          allZero = false;
        }
      }
      if (allZero) {
        bestX = xRef;
        bestLoss = 0;
        break;
      }
      const cols = buildJacobianColumns(Array.from(xRef), batch, false, null);
      const JtJ: number[][] = Array.from({ length: pFree }, () => new Array<number>(pFree).fill(0));
      const Jtr = new Array<number>(pFree).fill(0);
      for (let a = 0; a < pFree; a++) {
        for (let b = 0; b < pFree; b++) {
          JtJ[a][b] = pairwiseDot(cols[a], cols[b]);
        }
        Jtr[a] = pairwiseDot(cols[a], rVec);
      }
      let delta: number[];
      try {
        const JtJinv = _inv(JtJ);
        delta = JtJinv.map((row) => row.reduce((s, v, k) => s - v * Jtr[k], 0));
      } catch {
        break;
      }
      let moved = false;
      for (let fi = 0; fi < pFree; fi++) {
        if (delta[fi] !== 0) {
          moved = true;
        }
        xRef[freeIdx[fi]] += delta[fi];
      }
      if (!moved) {
        break;
      }
      const lossRef = computeLoss(
        lossTag,
        customLoss,
        evaluateAt(xRef),
        frozenRows,
        weights,
        false
      );
      if (lossRef === 0) {
        bestX = xRef;
        bestLoss = 0;
        break;
      }
    }
  }

  if (bestLoss > 0 && bestLoss < 1e-140) {
    bestLoss = 0;
  }

  let standardErrors: Float64Array | null = null;
  if (lossTag === 'l2') {
    if (pFree === 0 && m >= 1) {
      standardErrors = new Float64Array(p);
    } else if (pFree > 0 && m > pFree) {
      const batch = evaluateAt(bestX);
      const rVec = new Array<number>(m);
      let ok = true;
      for (let j = 0; j < m; j++) {
        const row = frozenRows[j];
        if (!rowActive(row, batch)) {
          ok = false;
          break;
        }
        const pred = batch.values[row];
        rVec[j] = sqrtW(row) * (pred - observed[row]);
      }
      if (ok) {
        const cols = buildJacobianColumns(Array.from(bestX), batch, false, null);
        const rss = pairwiseDot(rVec, rVec);
        const sigma2 = rss / (m - pFree);
        const JtJ: number[][] = Array.from({ length: pFree }, () =>
          new Array<number>(pFree).fill(0)
        );
        for (let a = 0; a < pFree; a++) {
          for (let b = 0; b < pFree; b++) {
            JtJ[a][b] = pairwiseDot(cols[a], cols[b]);
          }
        }
        try {
          const JtJinv = _inv(JtJ);
          standardErrors = new Float64Array(p);
          for (let fi = 0; fi < freeIdx.length; fi++) {
            const pi = freeIdx[fi];
            const v = sigma2 * JtJinv[fi][fi];
            if (!Number.isFinite(v) || v < 0) {
              standardErrors = null;
              break;
            }
            standardErrors[pi] = Math.sqrt(v);
          }
          if (standardErrors) {
            for (let i = 0; i < p; i++) {
              if (fixed[i]) {
                standardErrors[i] = 0;
              }
            }
          }
        } catch (e) {
          if (
            !(e instanceof Error) ||
            !/determinant is zero|singular|zero pivot/i.test(e.message)
          ) {
            throw e;
          }
          standardErrors = null;
        }
      }
    }
  }

  return {
    parameters: bestX,
    loss: bestLoss,
    converged: bestConverged,
    evaluations,
    validRows: m,
    standardErrors,
  };
}
