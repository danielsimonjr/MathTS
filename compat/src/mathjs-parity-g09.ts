/**
 * G09 — indexed assignment parity (#1557): assignment return shape (F1) and zero-sized
 * index validation (F2). Compat-only: the bridge matrix and subset factory keep their
 * native behavior; these adapters match mathjs 15.3.0 at the public compat surface.
 */

import { DimensionError } from '@danielsimonjr/mathts-core';
import {
  applyCompatLegacySubsetGet,
  forwardSubsetArgs,
  applySubsetGetMatrixShape,
} from './mathjs-parity-1785-surfaces.js';
import {
  arraySize,
  broadcastTo,
  isEmptyIndex,
  isIndex,
  unsqueeze,
  type Index,
  type NestedArray,
} from '@danielsimonjr/mathts-core/internal';

type UnaryLike = (...args: never[]) => unknown;

/** Runtime Index used by subset: structural `Index` plus `size` / `isScalar`. */
type RuntimeIndex = Index & {
  isScalar: () => boolean;
  size: () => number[];
};

/** The two Index methods `reshapeG09AssignmentRhsInPlace` actually reads. */
export type G09AssignmentIndex = {
  isScalar: () => boolean;
  size: () => number[];
};

type BridgeMatrixMutable = {
  _data: unknown;
  _size: number[];
  toArray: () => unknown;
  size: () => number[];
  subset: (index: unknown, replacement?: unknown, defaultValue?: unknown) => unknown;
};

type G09SubsetDeps = {
  add: (...args: unknown[]) => unknown;
  zeros: (dims: number | number[]) => unknown;
  matrix: (...args: unknown[]) => unknown;
};

const SHAPE_MISMATCH_ZERO_INDEX =
  'shape mismatch: mismatch is found in arg with shape (1) not possible to broadcast dimension 1 with size 1 to size 0';

/** Marker on a dense matrix prototype once `installG09BridgeMatrixSubsetPatch` ran (#1557 / #1785). */
export const G09_MATRIX_SUBSET_PATCHED = Symbol('g09MatrixSubsetPatched');

const MATHJS_DENSE_MATRIX_NAME = 'MathJSDenseMatrix';

function apply(fn: UnaryLike, args: unknown[]): unknown {
  return (fn as (...args: unknown[]) => unknown)(...args);
}

function keepSurface<T extends (...args: unknown[]) => unknown>(from: UnaryLike, to: T): T {
  try {
    Object.defineProperty(to, 'name', { value: from.name, configurable: true });
    Object.defineProperty(to, 'length', { value: from.length, configurable: true });
  } catch {
    // exotic functions may refuse a name/length redefine
  }
  for (const key of Reflect.ownKeys(from)) {
    if (key === 'prototype' || Object.prototype.hasOwnProperty.call(to, key)) continue;
    const desc = Object.getOwnPropertyDescriptor(from, key);
    if (!desc) continue;
    try {
      Object.defineProperty(to, key, desc);
    } catch {
      // skip non-configurable exotic keys
    }
  }
  return to;
}

function isBridgeDenseMatrix(value: unknown): value is BridgeMatrixMutable {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as BridgeMatrixMutable & {
    constructor?: { name?: string };
    isMatrix?: boolean;
  };
  return (
    obj.isMatrix === true &&
    typeof obj.subset === 'function' &&
    obj.constructor?.name === MATHJS_DENSE_MATRIX_NAME &&
    Array.isArray(obj._size)
  );
}

function isMatrixValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as { isMatrix?: boolean };
  return obj.isMatrix === true;
}

function isRuntimeIndex(value: unknown): value is RuntimeIndex {
  if (!isIndex(value)) return false;
  const obj = value as Index & { isScalar?: unknown; size?: unknown };
  return typeof obj.isScalar === 'function' && typeof obj.size === 'function';
}

type ScalarIndexDims = { _dimensions?: number[] };

function tryArraySubsetWithNullDefault(args: readonly unknown[]): unknown | undefined {
  if (args.length !== 4 || args[3] !== null || !Array.isArray(args[0])) {
    return undefined;
  }
  const index = args[1];
  if (!isRuntimeIndex(index) || !index.isScalar()) {
    return undefined;
  }
  const dims = (index as unknown as ScalarIndexDims)._dimensions;
  if (!Array.isArray(dims) || dims.length !== 1 || typeof dims[0] !== 'number') {
    return undefined;
  }
  const position = dims[0];
  const out: unknown[] = (args[0] as unknown[]).slice();
  while (out.length < position) {
    out.push(null);
  }
  out[position] = args[2];
  return out;
}

function isScalarReplacement(replacement: unknown): boolean {
  if (replacement === null || replacement === undefined) return true;
  if (Array.isArray(replacement)) return false;
  if (isMatrixValue(replacement)) return false;
  return typeof replacement !== 'object' || replacement instanceof Date;
}

function sizesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

function replacementSize(replacement: unknown): number[] {
  if (isBridgeDenseMatrix(replacement)) return replacement.size();
  if (Array.isArray(replacement)) return arraySize(replacement);
  if (
    typeof replacement === 'object' &&
    replacement !== null &&
    typeof (replacement as { toArray?: unknown }).toArray === 'function'
  ) {
    return arraySize((replacement as { toArray: () => NestedArray<unknown> }).toArray());
  }
  return arraySize(replacement as NestedArray<unknown>);
}

/**
 * mathjs mutates the assignment RHS in place (unsqueeze/broadcast) before `_setSubset`.
 * The bridge keeps a private copy for arrays; we reshape the caller's matrix or array here.
 */
export function reshapeG09AssignmentRhsInPlace(
  index: G09AssignmentIndex,
  replacement: unknown
): void {
  if (index.isScalar()) return;
  const selection = index.size();
  if (replacement === null || replacement === undefined) return;

  let rep: NestedArray<unknown>;
  let repSize: number[];

  if (isBridgeDenseMatrix(replacement)) {
    rep = replacement.toArray();
    repSize = replacement.size();
  } else if (Array.isArray(replacement)) {
    rep = replacement;
    repSize = arraySize(replacement);
  } else if (
    typeof replacement === 'object' &&
    typeof (replacement as { toArray?: unknown }).toArray === 'function'
  ) {
    rep = (replacement as { toArray: () => NestedArray<unknown> }).toArray();
    repSize = arraySize(rep);
  } else {
    return;
  }

  const sameSize = (size: number[]): boolean => sizesEqual(size, selection);
  if (!sameSize(repSize)) {
    try {
      rep = broadcastTo(rep, selection);
      repSize = arraySize(rep);
    } catch {
      // Dimension check below reports the mismatch.
    }
  }
  let trailOneAxes = 0;
  for (let i = selection.length - 1; i >= 0 && selection[i] === 1; i--) trailOneAxes++;

  const needsNest =
    isBridgeDenseMatrix(replacement) &&
    replacement._size.length === 1 &&
    repSize.length === 1 &&
    repSize.length < selection.length &&
    trailOneAxes > 0;

  if (needsNest) {
    const flat = Array.isArray(rep) ? rep : null;
    if (flat && flat.every((x) => typeof x === 'number')) {
      replacement._data = trailOneAxes >= 2 ? flat.map((x) => [[x]]) : flat.map((x) => [x]);
      replacement._size = [...selection];
    }
  } else if (repSize.length < selection.length) {
    let k = 0;
    while (k < selection.length && selection[k] === 1 && repSize[k] === 1) k++;
    let outer = 0;
    for (; k < selection.length && selection[k] === 1; k++) outer++;
    rep = unsqueeze(rep, selection.length, outer, repSize);
    if (isBridgeDenseMatrix(replacement)) {
      replacement._data = rep;
      replacement._size = [...selection];
    }
  }

  if (Array.isArray(replacement) && !needsNest && rep !== replacement) {
    replacement.length = 0;
    if (Array.isArray(rep)) {
      for (const entry of rep) replacement.push(entry);
    }
  }
}

function throwMathjsScalarZeroIndex(index: RuntimeIndex): never {
  const iSize = index.size();
  if (iSize.length === 1 && iSize[0] === 0) {
    throw new Error(SHAPE_MISMATCH_ZERO_INDEX);
  }
  throw new DimensionError(iSize, [1, 1], '>');
}

function validateG09ZeroSizedSet(index: RuntimeIndex, replacement: unknown): void {
  if (index.isScalar()) return;
  const iSize = index.size();
  if (!iSize.some((d: number) => d === 0)) return;

  if (isScalarReplacement(replacement)) {
    throwMathjsScalarZeroIndex(index);
  }
  throw new DimensionError(iSize, replacementSize(replacement), '>');
}

function shouldDeferEmptyIndexNoop(index: RuntimeIndex, isSet: boolean): boolean {
  if (!isSet) return false;
  const size = index.size();
  return size.length > 0 && size.some((d: number) => d === 0);
}

type SubsetPatchedCtor = {
  name?: string;
  prototype: BridgeMatrixMutable;
  [G09_MATRIX_SUBSET_PATCHED]?: boolean;
};

type SubsetPatchedProto = BridgeMatrixMutable & {
  subset(index: unknown, replacement?: unknown, defaultValue?: unknown): unknown;
  [G09_MATRIX_SUBSET_PATCHED]?: boolean;
};

/** Patch bridge `DenseMatrix#subset` once so RHS values reshape like mathjs before `_setSubset`. */
export function installG09BridgeMatrixSubsetPatch(sampleMatrix: unknown): void {
  if (!isBridgeDenseMatrix(sampleMatrix)) return;
  const ctor = sampleMatrix.constructor as SubsetPatchedCtor;
  if (ctor.name !== MATHJS_DENSE_MATRIX_NAME) return;
  const proto = Object.getPrototypeOf(sampleMatrix) as SubsetPatchedProto;
  if (proto[G09_MATRIX_SUBSET_PATCHED]) return;
  const original = proto.subset;
  proto.subset = function (
    this: BridgeMatrixMutable,
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ): unknown {
    if (replacement !== undefined && isRuntimeIndex(index)) {
      validateG09ZeroSizedSet(index, replacement);
      reshapeG09AssignmentRhsInPlace(index, replacement);
    }
    return original.call(this, index, replacement, defaultValue);
  };
  Object.defineProperty(proto, G09_MATRIX_SUBSET_PATCHED, { value: true, configurable: true });
}

/** Wrap `subset` so zero-length selections throw and empty-index no-ops match mathjs 15.3.0. */
export function createCompatSubsetG09(
  subset: UnaryLike,
  deps: G09SubsetDeps,
  getLegacySubset: () => boolean = () => false
): (...args: unknown[]) => unknown {
  const matrixFromScalar = (value: unknown): unknown => deps.matrix([value]);
  return keepSurface(subset, (...args: unknown[]): unknown => {
    const arrayNull = tryArraySubsetWithNullDefault(args);
    if (arrayNull !== undefined) {
      return arrayNull;
    }
    if (args.length >= 3) {
      const value = args[0];
      const index = args[1];
      const replacement = args[2];
      if (isRuntimeIndex(index) && shouldDeferEmptyIndexNoop(index, true)) {
        if (Array.isArray(value) || isBridgeDenseMatrix(value)) {
          return value;
        }
      }
      // Sparse matrices keep their own subset contract (do not mutate the caller
      // replacement). G09 reshape/throw applies to the dense bridge used by
      // indexed assignment, not to SparseMatrix.
      if (isBridgeDenseMatrix(value) && isRuntimeIndex(index)) {
        if (isEmptyIndex(index) && !shouldDeferEmptyIndexNoop(index, true)) {
          return value;
        }
        validateG09ZeroSizedSet(index, replacement);
        reshapeG09AssignmentRhsInPlace(index, replacement);
      }
    } else if (args.length === 2) {
      const index = args[1];
      if (isRuntimeIndex(index) && isEmptyIndex(index) && isBridgeDenseMatrix(args[0])) {
        return apply(subset, args);
      }
    }
    const result = forwardSubsetArgs(subset as (...a: unknown[]) => unknown, ...args);
    if (args.length === 2) {
      if (Array.isArray(args[0])) {
        if (
          typeof result === 'object' &&
          result !== null &&
          (result as { isMatrix?: boolean }).isMatrix === true &&
          typeof (result as { valueOf?: () => unknown }).valueOf === 'function'
        ) {
          const flat = (result as { valueOf: () => unknown }).valueOf();
          return flat;
        }
        return result;
      }
      const legacy = getLegacySubset();
      const adjusted = applyCompatLegacySubsetGet(result, args[1], legacy, matrixFromScalar);
      return applySubsetGetMatrixShape(adjusted, args[1], legacy, (data) => deps.matrix(data));
    }
    return result;
  });
}
