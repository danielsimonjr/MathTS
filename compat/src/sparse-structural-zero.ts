/**
 * Sparse-matrix structural zero helpers for compat (#1582).
 *
 * Storage uses an exact number zero test (=== 0), matching native MathTS and mathjs
 * sparse construction for number matrices. Every other datatype follows mathjs `isZero`.
 */

import { BigNumber, Fraction, Complex } from '@danielsimonjr/mathts-core';
import { isMathjsFraction } from './mathjs-fraction-class.js';
import { DEFAULT_CONFIG, nearlyEqualBigNumber } from '@danielsimonjr/mathts-core/internal';

const VALUELESS_UNIT_ERROR = 'Signature not found (signature: isZero(null))';

function isBigNumberLike(value: unknown): value is BigNumber {
  return value !== null && typeof value === 'object' && (value as BigNumber).isBigNumber === true;
}

function isComplexParts(value: object): value is { re: number; im: number } {
  return (
    typeof (value as { re?: unknown }).re === 'number' &&
    typeof (value as { im?: unknown }).im === 'number'
  );
}

function isUnitLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return (
    (value as { constructor?: { prototype?: { isUnit?: boolean } } }).constructor?.prototype
      ?.isUnit === true
  );
}

function nearlyEqual(a: number, b: number, relTol: number, absTol: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  if (diff <= absTol) return true;
  const largest = Math.max(Math.abs(a), Math.abs(b));
  return diff <= largest * relTol;
}

/** mathjs `isZero` surface (relTol/absTol on numbers) for sparse arithmetic / map. */
export function isCompatZeroScalar(value: unknown): boolean {
  const relTol = DEFAULT_CONFIG.relTol;
  const absTol = DEFAULT_CONFIG.absTol;
  if (typeof value === 'number') {
    return nearlyEqual(value, 0, relTol, absTol);
  }
  if (typeof value === 'boolean') return value === false;
  if (typeof value === 'bigint') return value === 0n;
  if (typeof value === 'string') return nearlyEqual(Number(value), 0, relTol, absTol);
  if (value !== null && typeof value === 'object') {
    if (isBigNumberLike(value)) {
      return value.isZero() || nearlyEqualBigNumber(value, BigNumber.fromNumber(0), relTol, absTol);
    }
    if (isComplexParts(value)) {
      return nearlyEqual(value.re, 0, relTol, absTol) && nearlyEqual(value.im, 0, relTol, absTol);
    }
    if (value instanceof Fraction) return value.isZero();
    if (isMathjsFraction(value)) {
      const n = typeof value.n === 'bigint' ? value.n : BigInt(value.n as number);
      return n === 0n;
    }
    if (isUnitLike(value)) {
      const unit = value as { value: unknown };
      if (unit.value === null) throw new TypeError(VALUELESS_UNIT_ERROR);
      return isCompatZeroScalar(unit.value);
    }
    const maybeZero = value as { isZero?: () => boolean; n?: unknown };
    if (typeof maybeZero.isZero === 'function') return maybeZero.isZero();
    if ('n' in maybeZero) return Number(maybeZero.n) === 0;
  }
  return false;
}

/**
 * Whether a value is a structural zero that mathjs sparse storage does not keep (#1582).
 * Numbers use exact `=== 0` so tiny entries such as 1e-100 stay stored.
 */
export function isSparseStructuralZero(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return value === 0;
  if (typeof value === 'boolean') return value === false;
  if (typeof value === 'bigint') return value === 0n;
  if (value instanceof Complex) return value.isZero();
  if (value instanceof Fraction) return value.isZero();
  if (isMathjsFraction(value)) {
    const n = typeof value.n === 'bigint' ? value.n : BigInt(value.n as number);
    return n === 0n;
  }
  if (isBigNumberLike(value)) return value.isZero();
  if (isUnitLike(value)) {
    const unit = value as { value: unknown };
    if (unit.value === null) return false;
    if (unit.value === undefined) return true;
    return isSparseStructuralZero(unit.value);
  }
  if (typeof value === 'object') {
    const maybeZero = value as { isZero?: () => boolean };
    if (typeof maybeZero.isZero === 'function') return maybeZero.isZero();
  }
  return false;
}

/** Reject valueless units before sparse construction, as mathjs 15.3.0 does. */
export function assertSparseCellStorable(value: unknown): void {
  if (!isUnitLike(value)) return;
  const unit = value as { value: unknown };
  if (unit.value === null) throw new TypeError(VALUELESS_UNIT_ERROR);
}

/** Drop structural zeros from a dense 2-D nest before the native sparse constructor runs. */
export function sanitizeDenseSparseInput(data: unknown[][]): unknown[][] {
  return data.map((row) => {
    if (!Array.isArray(row)) {
      assertSparseCellStorable(row);
      return isSparseStructuralZero(row) ? (undefined as unknown as unknown[]) : row;
    }
    return row.map((cell) => {
      assertSparseCellStorable(cell);
      return isSparseStructuralZero(cell) ? undefined : cell;
    });
  });
}
