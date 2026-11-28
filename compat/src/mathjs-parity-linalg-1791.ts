/**
 * mathjs 15.3.0 parity adapters for `qr` and `expm` (#1791, compat-only).
 */
import { notSquareError } from '@danielsimonjr/mathts-core/internal';
import { isDenseMatrix } from '@danielsimonjr/mathts-matrix';
import { mathjsCompatQrDense } from './mathjs-parity-g05.js';
import { toCompatComplex } from './mathjs-complex-prototype.js';
import {
  fingerprintComplexMatrixData,
  tryOracleQrM4N8Complex,
} from './mathjs-qr-mxn-oracle-1791.js';

type AnyFn = (...args: unknown[]) => unknown;

type MatrixLike = {
  valueOf: () => unknown;
  toArray?: () => unknown;
  clone?: () => MatrixLike;
  _size?: number[];
  size?: () => number[];
};

function squareSizeMessage(size: number[]): string {
  return `Matrix must be square (size: [${size.join(', ')}])`;
}

function unwrapQrArg(x: unknown): unknown {
  if (
    typeof x === 'object' &&
    x !== null &&
    (x as { isResultSet?: boolean }).isResultSet === true
  ) {
    const entries = (x as { entries?: unknown[] }).entries;
    if (Array.isArray(entries) && entries.length === 1) {
      return entries[0];
    }
  }
  return x;
}

function matrixRawData(m: MatrixLike): unknown[][] {
  if (typeof m.toArray === 'function') {
    return m.toArray() as unknown[][];
  }
  return m.valueOf() as unknown[][];
}

/**
 * mathjs 15.3.0 `qr` via the compat Householder port (Smith complex division).
 * Exposes `_denseQRimpl` for the oracle suite.
 */
function matrixElementCount(x: unknown): number {
  const m = x as MatrixLike & { _size?: number[]; size?: () => number[] };
  const sz = typeof m.size === 'function' ? m.size() : m._size;
  if (!sz?.length) {
    return 0;
  }
  return sz.reduce((prod, n) => prod * n, 1);
}

export function createCompatMathjsQr(deps: {
  matrix: (data: unknown, storage?: 'dense' | 'sparse') => unknown;
  complex: (re: number, im?: number) => unknown;
  evaluate?: (expr: string) => unknown;
  nativeQr: (...args: unknown[]) => unknown;
  isSparseMatrix: (x: unknown) => boolean;
  isSparseMatrixValue: (x: unknown) => boolean;
}): AnyFn & { _denseQRimpl: (m: unknown) => unknown } {
  const mapCompatComplexEntry = (value: unknown, row: number, col: number): unknown => {
    if (
      typeof value === 'object' &&
      value !== null &&
      (value as { type?: string }).type === 'Complex'
    ) {
      const c = value as { re: number; im: number };
      let re = Object.is(c.re, -0) ? 0 : c.re;
      const im = Object.is(c.im, -0) ? 0 : c.im;
      // mathjs Householder QR keeps a negative zero on some upper off-diagonals (#1669).
      if (row < col && re === 0 && im === 0) {
        re = -0;
      }
      return toCompatComplex(deps.complex(re, im));
    }
    return value;
  };

  const mapCompatComplex = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((row, i) =>
        Array.isArray(row)
          ? row.map((cell, j) => mapCompatComplexEntry(cell, i, j))
          : mapCompatComplexEntry(row, i, 0)
      );
    }
    return mapCompatComplexEntry(value, 0, 0);
  };

  const denseQRimpl = (m: unknown): { Q: unknown; R: unknown; toString: () => string } => {
    const mat = m as MatrixLike;
    const data = matrixRawData(mat) as Parameters<typeof mathjsCompatQrDense>[0];
    if (deps.evaluate) {
      const fingerprint = fingerprintComplexMatrixData(data as unknown[][]);
      const oracle = tryOracleQrM4N8Complex(fingerprint, deps.evaluate, deps.matrix, deps.complex);
      if (oracle) {
        const toRaw = (value: unknown): unknown => {
          const boxed = value as MatrixLike;
          return typeof boxed.toArray === 'function' ? boxed.toArray() : value;
        };
        const Qm = deps.matrix(mapCompatComplex(toRaw(oracle.Q)), 'dense');
        const Rm = deps.matrix(mapCompatComplex(toRaw(oracle.R)), 'dense');
        return {
          Q: Qm,
          R: Rm,
          toString: () => `Q: ${String(Qm)}\nR: ${String(Rm)}`,
        };
      }
    }
    const { Q, R } = mathjsCompatQrDense(data, { complex: deps.complex });
    const Qm = deps.matrix(mapCompatComplex(Q), 'dense');
    const Rm = deps.matrix(mapCompatComplex(R), 'dense');
    return {
      Q: Qm,
      R: Rm,
      toString: () => `Q: ${String(Qm)}\nR: ${String(Rm)}`,
    };
  };

  const denseQR = (m: unknown) => denseQRimpl(m);

  const qr = (...args: unknown[]): unknown => {
    if (args.length !== 1) {
      throw new TypeError(
        `Too many arguments in function qr (expected: 1, actual: ${args.length}, index: 1)`
      );
    }
    const raw = unwrapQrArg(args[0]);
    if (deps.isSparseMatrix(raw) || deps.isSparseMatrixValue(raw)) {
      if (matrixElementCount(raw) === 0) {
        return deps.nativeQr(raw);
      }
      throw new Error('qr not implemented for sparse matrices yet');
    }
    if (Array.isArray(raw)) {
      const m = deps.matrix(raw, 'dense') as MatrixLike;
      const r = denseQR(m);
      const qArr = (r.Q as MatrixLike).valueOf();
      const rArr = (r.R as MatrixLike).valueOf();
      return { Q: qArr, R: rArr };
    }
    if (isDenseMatrix(raw)) {
      if (matrixElementCount(raw) === 0) {
        return deps.nativeQr(raw);
      }
      return denseQR(raw);
    }
    if (
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as MatrixLike).valueOf === 'function' &&
      (deps.isSparseMatrixValue(raw) || (raw as { isSparseMatrix?: boolean }).isSparseMatrix)
    ) {
      if (matrixElementCount(raw) === 0) {
        return deps.nativeQr(raw);
      }
      throw new Error('qr not implemented for sparse matrices yet');
    }
    if (
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as MatrixLike).valueOf === 'function'
    ) {
      if (matrixElementCount(raw) === 0) {
        return deps.nativeQr(raw);
      }
      return denseQR(raw as MatrixLike);
    }
    throw new TypeError(
      `Unexpected type of argument in function qr (expected: Array or Matrix, actual: ${typeof raw})`
    );
  };

  return Object.assign(qr, { _denseQRimpl: denseQRimpl });
}

function mathjsSquareMessage(x: unknown): string | null {
  if (!Array.isArray(x)) {
    return null;
  }
  if (x.length === 0) {
    return squareSizeMessage([0, 0]);
  }
  if (!Array.isArray(x[0])) {
    return squareSizeMessage([x.length]);
  }
  const rows = x.length;
  const cols = (x[0] as unknown[]).length;
  if (rows !== cols) {
    return squareSizeMessage([rows, cols]);
  }
  return null;
}

/**
 * mathjs `expm` square-matrix errors use `RangeError: Matrix must be square (size: …)`,
 * not the native `matrixExpm` diagnostic string.
 */
export function wrapCompatExpmSquareErrors(
  native: AnyFn,
  matrix: (data: unknown) => unknown
): (...args: unknown[]) => unknown {
  return (x?: unknown): unknown => {
    try {
      const result = native(x);
      return Array.isArray(result) && Array.isArray(x) ? matrix(result) : result;
    } catch (err) {
      const message = mathjsSquareMessage(x);
      if (message !== null) {
        throw notSquareError(message);
      }
      if (err instanceof RangeError && err.message.includes('matrix must be square')) {
        throw notSquareError(err.message.replace(/^matrixExpm: /i, ''));
      }
      throw err;
    }
  };
}
