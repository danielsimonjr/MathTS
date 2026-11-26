/**
 * G09 — indexed assignment parity (#1557): assignment return shape (F1) and zero-sized
 * index validation (F2). Compat-only: the bridge matrix and subset factory keep their
 * native behavior; these adapters match mathjs 15.3.0 at the public compat surface.
 */

import { DimensionError } from '@danielsimonjr/mathts-core';
import {
  arraySize,
  broadcastTo,
  isEmptyIndex,
  unsqueeze,
} from '@danielsimonjr/mathts-core/internal';

type UnaryLike = (...args: never[]) => unknown;

type IndexLike = {
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
};

const SHAPE_MISMATCH_ZERO_INDEX =
  'shape mismatch: mismatch is found in arg with shape (1) not possible to broadcast dimension 1 with size 1 to size 0';

const G09_MATRIX_SUBSET_PATCHED = Symbol('g09MatrixSubsetPatched');

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
    obj.constructor?.name === 'MathJSDenseMatrix' &&
    Array.isArray(obj._size)
  );
}

function isMatrixValue(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { isMatrix?: boolean }).isMatrix === 'boolean' &&
    (value as { isMatrix?: boolean }).isMatrix === true
  );
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

/**
 * mathjs mutates the assignment RHS in place (unsqueeze/broadcast) before `_setSubset`.
 * The bridge keeps a private copy for arrays; we reshape the caller's matrix or array here.
 */
export function reshapeG09AssignmentRhsInPlace(index: IndexLike, replacement: unknown): void {
  if (index.isScalar()) return;
  const selection = index.size();
  if (replacement === null || replacement === undefined) return;

  let rep: unknown;
  let repSize: number[];

  if (isBridgeDenseMatrix(replacement)) {
    rep = replacement.toArray();
    repSize = replacement.size();
  } else if (Array.isArray(replacement)) {
    rep = replacement;
    repSize = arraySize(replacement);
  } else if (
    typeof replacement === 'object' &&
    typeof (replacement as { toArray?: () => unknown }).toArray === 'function'
  ) {
    rep = (replacement as { toArray(): unknown }).toArray();
    repSize = arraySize(rep as unknown[]);
  } else {
    return;
  }

  const sameSize = (size: number[]): boolean => sizesEqual(size, selection);
  if (!sameSize(repSize)) {
    try {
      rep = broadcastTo(rep, selection);
      repSize = arraySize(rep as unknown[]);
    } catch {
      // Dimension check below reports the mismatch.
    }
  }
  const trailOneAxes = (() => {
    let trailingOnes = 0;
    for (let i = selection.length - 1; i >= 0 && selection[i] === 1; i--) trailingOnes++;
    return trailingOnes;
  })();

  const needsNest =
    isBridgeDenseMatrix(replacement) &&
    replacement._size.length === 1 &&
    repSize.length === 1 &&
    repSize.length < selection.length &&
    trailOneAxes > 0;

  if (needsNest) {
    const flat = rep as number[];
    if (flat.every((x) => typeof x === 'number')) {
      replacement._data =
        trailOneAxes >= 2
          ? (flat.map((x) => [[x]]) as unknown as BridgeMatrixMutable['_data'])
          : (flat.map((x) => [x]) as BridgeMatrixMutable['_data']);
    }
  } else if (repSize.length < selection.length) {
    let k = 0;
    while (k < selection.length && selection[k] === 1 && repSize[k] === 1) k++;
    let outer = 0;
    for (; k < selection.length && selection[k] === 1; k++) outer++;
    rep = unsqueeze(rep as never, selection.length, outer, repSize);
    if (isBridgeDenseMatrix(replacement)) {
      replacement._data = rep as BridgeMatrixMutable['_data'];
    }
  }

  if (Array.isArray(replacement) && !needsNest && rep !== replacement) {
    replacement.length = 0;
    if (Array.isArray(rep)) {
      for (const entry of rep) replacement.push(entry);
    }
  }
}

function throwMathjsScalarZeroIndex(index: IndexLike): never {
  const iSize = index.size();
  if (iSize.length === 1 && iSize[0] === 0) {
    throw new Error(SHAPE_MISMATCH_ZERO_INDEX);
  }
  throw new DimensionError(iSize, [1, 1], '>');
}

function validateG09ZeroSizedSet(index: IndexLike, replacement: unknown): void {
  if (index.isScalar()) return;
  const iSize = index.size();
  if (!iSize.some((d) => d === 0)) return;

  if (isScalarReplacement(replacement)) {
    throwMathjsScalarZeroIndex(index);
  }
  throw new DimensionError(iSize, arraySize(replacement as unknown[]), '>');
}

function shouldDeferEmptyIndexNoop(index: IndexLike, isSet: boolean): boolean {
  if (!isSet) return false;
  const size = index.size();
  return size.length > 0 && size.some((d) => d === 0);
}

/** Patch bridge `DenseMatrix#subset` once so RHS values reshape like mathjs before `_setSubset`. */
export function installG09BridgeMatrixSubsetPatch(sampleMatrix: BridgeMatrixMutable): void {
  const ctor = sampleMatrix.constructor as unknown as {
    prototype: BridgeMatrixMutable & {
      subset: (index: unknown, replacement?: unknown, defaultValue?: unknown) => unknown;
    };
    [key: symbol]: boolean;
  };
  if (ctor[G09_MATRIX_SUBSET_PATCHED]) return;
  const proto = ctor.prototype as BridgeMatrixMutable & {
    subset: (index: unknown, replacement?: unknown, defaultValue?: unknown) => unknown;
  };
  const original = proto.subset;
  proto.subset = function (
    this: BridgeMatrixMutable,
    index: unknown,
    replacement?: unknown,
    defaultValue?: unknown
  ): unknown {
    if (replacement !== undefined && index && typeof (index as IndexLike).size === 'function') {
      const idx = index as IndexLike;
      validateG09ZeroSizedSet(idx, replacement);
      reshapeG09AssignmentRhsInPlace(idx, replacement);
    }
    return original.call(this, index, replacement, defaultValue);
  };
  Object.defineProperty(ctor, G09_MATRIX_SUBSET_PATCHED, { value: true, configurable: true });
}

/** Wrap `subset` so zero-length selections throw and empty-index no-ops match mathjs 15.3.0. */
export function createCompatSubsetG09(
  subset: UnaryLike,
  _deps: G09SubsetDeps
): (...args: unknown[]) => unknown {
  return keepSurface(subset, (...args: unknown[]): unknown => {
    if (args.length >= 3) {
      const value = args[0];
      const index = args[1] as IndexLike;
      const replacement = args[2];
      if (isMatrixValue(value) && index && typeof index.size === 'function') {
        const isSet = true;
        if (isEmptyIndex(index as never) && !shouldDeferEmptyIndexNoop(index, isSet)) {
          return value;
        }
        validateG09ZeroSizedSet(index, replacement);
      }
    } else if (args.length === 2) {
      const index = args[1] as IndexLike;
      if (isEmptyIndex(index as never)) {
        if (isMatrixValue(args[0])) {
          return apply(subset, args);
        }
      }
    }
    return apply(subset, args);
  });
}
