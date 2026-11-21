/**
 * One reader of the right-hand side `b` of a linear solve (`linsolve`, `lstsq`). Each rule of
 * "what is a vector, what is a matrix, which entry is a number" has one place here.
 */

import { isNumberTypedArray, typeOf } from '@danielsimonjr/mathts-core/internal';
import { isDenseMatrix } from '../types/DenseMatrix.js';
import { densifyForSolver } from './densify.js';
import { implicitNumber, isTypedScalar } from './entry-rule.js';

/**
 * A right-hand side read as a vector (one entry per row of `A`) or as a matrix (`m x k`). When
 * `typedEntry` is `undefined`, every entry is a number. Otherwise `typedEntry` names the type of
 * the first BigNumber, Fraction or Complex entry, and the entries are numbers and such values.
 */
export type RightHandSide =
  | { readonly kind: 'vector'; readonly typedEntry: undefined; readonly values: number[] }
  | { readonly kind: 'matrix'; readonly typedEntry: undefined; readonly rows: number[][] }
  | { readonly kind: 'vector'; readonly typedEntry: string; readonly values: unknown[] }
  | { readonly kind: 'matrix'; readonly typedEntry: string; readonly rows: unknown[][] };

/** Reads the entries of `b` and remembers the type of the first typed entry. */
class EntryReader {
  typedEntry: string | undefined = undefined;

  constructor(private readonly name: string) {}

  /**
   * Read one entry with the implicit rule of mathjs (`implicitNumber`). A BigNumber, Fraction or
   * Complex entry keeps its type. Every other value (an array, an object) throws a `TypeError`
   * with its position.
   */
  read(value: unknown, at: string): unknown {
    const n = implicitNumber(value);
    if (n !== undefined) return n;
    if (isTypedScalar(value)) {
      this.typedEntry ??= typeOf(value);
      return value;
    }
    throw new TypeError(`${this.name}: b${at} is a ${typeOf(value)}, expected a number`);
  }
}

/**
 * Read a nested array. The kind comes from the structure: when entry 0 is an array, `b` is a
 * matrix, and every row must be an array of the length of row 0; otherwise `b` is a vector, and
 * no entry may be an array. The entry type never decides the kind.
 */
function readNested(name: string, b: readonly unknown[]): RightHandSide {
  const reader = new EntryReader(name);
  if (b.length === 0 || !Array.isArray(b[0])) {
    const values = new Array<unknown>(b.length);
    for (let i = 0; i < b.length; i++) values[i] = reader.read(b[i], `[${i}]`);
    return { kind: 'vector', typedEntry: reader.typedEntry, values } as RightHandSide;
  }
  const k = (b[0] as unknown[]).length;
  const rows = new Array<unknown[]>(b.length);
  for (let i = 0; i < b.length; i++) {
    const row: unknown = b[i];
    if (!Array.isArray(row) || row.length !== k) {
      throw new TypeError(`${name}: b must be a vector or a rectangular matrix`);
    }
    const out = new Array<unknown>(k);
    for (let j = 0; j < k; j++) out[j] = reader.read(row[j], `[${i}][${j}]`);
    rows[i] = out;
  }
  return { kind: 'matrix', typedEntry: reader.typedEntry, rows } as RightHandSide;
}

/**
 * Read the right-hand side of a solve with `m` equations.
 *
 * - A typed array of numbers (`isNumberTypedArray`) and a 1-D array are a vector.
 * - A nested array is a matrix (see `readNested`).
 * - A matrix-package `SparseMatrix` is densified (`densifyForSolver`) and read as a `DenseMatrix`.
 * - A `DenseMatrix` is a matrix, except a `DenseMatrix` with one row when `A` has another row
 *   count: that is a 1-D `DenseMatrix` (a 1 x n row), so it is a vector.
 * - An object with a `toArray` method (the MathJS matrix; this package cannot import it) is read
 *   through `toArray`.
 *
 * @param name - The name of the solver, for the error message.
 * @param b - The right-hand side.
 * @param m - The row count of `A`.
 * @returns The vector or the matrix. Entries follow the implicit rule of mathjs (see
 *   `implicitNumber`); a BigNumber, Fraction or Complex entry keeps its type and sets `typedEntry`.
 * @throws {TypeError} if `b` is not one of these types, is not rectangular, or has an entry that
 *   is neither convertible to a number nor a BigNumber, Fraction or Complex. The caller checks the
 *   length against `m`.
 */
export function readRightHandSide(name: string, b: unknown, m: number): RightHandSide {
  if (isNumberTypedArray(b))
    return { kind: 'vector', typedEntry: undefined, values: Array.from(b) };
  if (Array.isArray(b)) return readNested(name, b);
  const dense = densifyForSolver(b) ?? b;
  if (isDenseMatrix(dense)) {
    // A 1-D DenseMatrix is a 1 x n row, so a single row that does not match the row count of `A`
    // is a vector. The caller checks the length.
    if (dense.rows === 1 && dense.rows !== m) {
      return { kind: 'vector', typedEntry: undefined, values: dense.toArray()[0] };
    }
    return { kind: 'matrix', typedEntry: undefined, rows: dense.toArray() };
  }
  const duck = b as { toArray?: unknown } | null;
  if (typeof duck === 'object' && duck !== null && typeof duck.toArray === 'function') {
    const nested: unknown = (duck as { toArray(): unknown }).toArray();
    if (Array.isArray(nested)) return readNested(name, nested);
  }
  throw new TypeError(
    `${name}: b must be a vector, a nested array, a typed array of numbers, a DenseMatrix, a SparseMatrix or a matrix with toArray (got ${typeOf(b)})`
  );
}
